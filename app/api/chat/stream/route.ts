import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getLLM } from "@/lib/llm/getAdapter";
import { assembleContext } from "@/lib/context/assembleContext";
import { encodeSSE } from "@/lib/llm/utils";

export async function POST(req: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const body = await req.json();
    const { 
      chatId, 
      parentMessageId, 
      userText, 
      messages = [],
      inclusionOverride,
      attachments = [],
    } = body;

    if (!userText?.trim()) {
      return new NextResponse("User text is required", { status: 400 });
    }

    // Assemble context from messages
    const { system, contextMessages, citations } = await assembleContext({
      messages,
      includeIds: inclusionOverride?.includeIds,
      excludeIds: inclusionOverride?.excludeIds,
      attachments,
    });

    // Get LLM adapter
    const llm = getLLM();

    // Create a TransformStream for SSE
    const encoder = new TextEncoder();
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();

    // Start streaming in the background
    (async () => {
      try {
        let fullText = "";
        let isFirst = true;

        // Stream tokens from LLM
        for await (const chunk of llm.stream({
          system,
          contextMessages,
          user: userText,
        })) {
          // Send token to client
          await writer.write(
            encoder.encode(
              encodeSSE({
                type: "token",
                content: chunk.token,
              })
            )
          );

          fullText += chunk.token;

          // Send periodic progress updates
          if (isFirst) {
            isFirst = false;
            await writer.write(
              encoder.encode(
                encodeSSE({
                  type: "start",
                  messageId: `temp_${Date.now()}`,
                })
              )
            );
          }
        }

        // Add citations if available
        if (citations.length > 0) {
          fullText += `\n\n**Sources:**\n${citations.join("\n")}`;
        }

        // Send completion event
        await writer.write(
          encoder.encode(
            encodeSSE({
              type: "complete",
              content: fullText,
              messageId: `msg_${Date.now()}`,
              tokenCount: fullText.split(" ").length,
            })
          )
        );

        // Send done event
        await writer.write(
          encoder.encode("data: [DONE]\n\n")
        );
      } catch (error) {
        console.error("Streaming error:", error);
        await writer.write(
          encoder.encode(
            encodeSSE({
              type: "error",
              error: error instanceof Error ? error.message : "Unknown error",
            })
          )
        );
      } finally {
        await writer.close();
      }
    })();

    // Return the stream as SSE
    return new NextResponse(stream.readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (error) {
    console.error("Chat stream error:", error);
    return new NextResponse(
      error instanceof Error ? error.message : "Internal server error",
      { status: 500 }
    );
  }
}
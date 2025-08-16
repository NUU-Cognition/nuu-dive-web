// Prefer Node runtime for NextAuth + outbound streaming behavior
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Strongly discourage caching or static optimization
export const fetchCache = "force-no-store";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getLLM } from "@/lib/llm/getAdapter";
import { assembleContext } from "@/lib/context/assembleContext";
import { encodeSSE } from "@/lib/llm/utils";

export async function POST(req: NextRequest) {
  try {
    // Check authentication (allow bypass in dev)
    const session = await getServerSession(authOptions);
    const allowDevNoAuth = process.env.ALLOW_DEV_NO_AUTH === "1" || process.env.NODE_ENV === "development";
    if (!session && !allowDevNoAuth) {
      console.log("Authentication required. Set ALLOW_DEV_NO_AUTH=1 in .env.local for development.");
      return new NextResponse("Unauthorized - Set ALLOW_DEV_NO_AUTH=1 for development", { status: 401 });
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
    
    // Optional keepalive ping (some proxies close silent SSE)
    const keepAlive = setInterval(() => {
      try {
        writer.write(encoder.encode(": keepalive\n\n"));
      } catch {}
    }, 15000);

    // Start streaming in the background
    (async () => {
      try {
        let fullText = "";
        const startId = `temp_${Date.now()}`;

        // Announce stream start before any tokens
        await writer.write(
          encoder.encode(
            encodeSSE({
              type: "start",
              messageId: startId,
            })
          )
        );

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
              tokenCount: (fullText.trim().match(/\S+/g) || []).length,
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
        clearInterval(keepAlive);
        await writer.close();
      }
    })();

    // Return the stream as SSE
    return new NextResponse(stream.readable, {
      headers: {
        "Content-Type": "text/event-stream",
        // Prevent buffering and content transformation by proxies/CDNs
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
        // Helps with Nginx/Vercel proxy buffering of long-lived responses
        "X-Accel-Buffering": "no",
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
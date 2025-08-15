export function parseEventSource(line: string) {
  if (line.startsWith("data: ")) {
    const data = line.slice(6);
    if (data === "[DONE]") {
      return { done: true };
    }
    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  }
  return null;
}

export function encodeSSE(data: any): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}
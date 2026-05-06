export interface JsonAction {
  tool: string;
  arguments: Record<string, unknown>;
}

export function parseJsonAction(content: string | null | undefined): JsonAction | null {
  if (!content) {
    return null;
  }

  const candidates = [
    content.trim(),
    ...Array.from(content.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi), (match) => match[1].trim())
  ];

  for (const candidate of candidates) {
    try {
      const value = JSON.parse(candidate) as unknown;
      if (isJsonAction(value)) {
        return value;
      }
    } catch {
      // Try the next candidate.
    }
  }

  const firstBrace = content.indexOf("{");
  const lastBrace = content.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    try {
      const value = JSON.parse(content.slice(firstBrace, lastBrace + 1)) as unknown;
      if (isJsonAction(value)) {
        return value;
      }
    } catch {
      return null;
    }
  }

  return null;
}

function isJsonAction(value: unknown): value is JsonAction {
  return Boolean(
    value &&
      typeof value === "object" &&
      "tool" in value &&
      typeof (value as { tool: unknown }).tool === "string" &&
      "arguments" in value &&
      typeof (value as { arguments: unknown }).arguments === "object" &&
      (value as { arguments: unknown }).arguments !== null
  );
}

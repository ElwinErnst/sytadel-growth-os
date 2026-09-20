import { z } from 'zod';

/** Raised when model output cannot be parsed/validated into the target schema. */
export class InvalidModelOutputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidModelOutputError';
  }
}

/**
 * Extract the first top-level JSON object from a model response. Models often
 * wrap JSON in prose or ```json fences; we tolerate that but nothing more
 * elaborate — anything we cannot cleanly isolate is a hard error.
 */
export function extractJsonObject(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced?.[1] ?? text).trim();

  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new InvalidModelOutputError('No JSON object found in model output');
  }
  return candidate.slice(start, end + 1);
}

/** Parse + schema-validate model output. Throws InvalidModelOutputError. */
export function parseModelJson<T>(text: string, schema: z.ZodType<T>): T {
  const raw = extractJsonObject(text);
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new InvalidModelOutputError('Model output is not valid JSON');
  }
  const result = schema.safeParse(parsed);
  if (!result.success) {
    const issue = result.error.issues[0];
    const where = issue?.path.join('.') || '(root)';
    throw new InvalidModelOutputError(
      `Model output failed schema validation at ${where}: ${issue?.message ?? 'unknown'}`,
    );
  }
  return result.data;
}

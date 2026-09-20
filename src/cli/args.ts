/**
 * Minimal, dependency-free argument parser for the Growth OS CLI. Supports
 * `--flag value` and repeated/space-separated list values
 * (`--evidence a b c` or `--evidence a --evidence b`). Bare `--flag` becomes
 * the string 'true'.
 */
export type ParsedArgs = {
  command: string | undefined;
  values: Map<string, string[]>;
};

export function parseArgs(argv: string[]): ParsedArgs {
  const [command, ...rest] = argv;
  const values = new Map<string, string[]>();
  let current: string | undefined;

  for (const token of rest) {
    if (token.startsWith('--')) {
      current = token.slice(2);
      if (!values.has(current)) values.set(current, []);
    } else if (current) {
      values.get(current)!.push(token);
    }
  }
  // Bare flags (no following value) read as boolean-true.
  for (const [k, v] of values) {
    if (v.length === 0) values.set(k, ['true']);
  }

  return { command, values };
}

export function getOne(args: ParsedArgs, key: string): string | undefined {
  return args.values.get(key)?.[0];
}

export function getMany(args: ParsedArgs, key: string): string[] {
  return args.values.get(key) ?? [];
}

export function requireOne(args: ParsedArgs, key: string): string {
  const value = getOne(args, key);
  if (value === undefined || value.trim() === '') {
    throw new CliUsageError(`Missing required flag --${key}`);
  }
  return value;
}

export class CliUsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CliUsageError';
  }
}

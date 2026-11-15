export type ParsedArgs = {
  command: string | undefined;
  flags: Map<string, string | true>;
  /** Everything after a standalone `--` (used by `eit run`). */
  passthrough: string[];
};

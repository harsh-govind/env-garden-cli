export type ParsedArgs = {
  command: string | undefined;
  /** Words after the command, e.g. `create my-project` in `eit project create my-project`. */
  positionals: string[];
  flags: Map<string, string | true>;
  /** Everything after a standalone `--` (used by `eit run`). */
  passthrough: string[];
};

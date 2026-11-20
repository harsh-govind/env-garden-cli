export type ParsedArgs = {
  command: string | undefined;
  positionals: string[];
  flags: Map<string, string | true>;
  passthrough: string[];
};

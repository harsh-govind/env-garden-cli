import { HISTORY_DEFAULT_LIMIT } from "../constants/index.js";
import { stringFlag } from "../lib/args.js";
import { createCommandContext } from "../lib/command-context.js";
import { formatDateTime } from "../lib/format.js";
import { resolveWorkspace } from "../lib/resolve.js";
import type { HistoryEntry, ManageCommandInput } from "../types/manage.js";

export async function historyCommand(input: ManageCommandInput): Promise<void> {
  const api = await createCommandContext(input);
  const workspace = await resolveWorkspace(api, stringFlag(input.parsed, "--workspace"));
  const limit = Number.parseInt(stringFlag(input.parsed, "--limit") ?? String(HISTORY_DEFAULT_LIMIT), 10);

  if (!Number.isInteger(limit) || limit < 1) {
    throw new Error("--limit must be a positive number.");
  }

  const entries: HistoryEntry[] = [];
  let cursor: string | undefined;

  while (entries.length < limit) {
    const page = await api.getHistory(workspace.id, stringFlag(input.parsed, "--search"), cursor);
    entries.push(...page.history);

    if (!page.hasMore || !page.nextCursor) {
      break;
    }

    cursor = page.nextCursor;
  }

  if (entries.length === 0) {
    console.log(`No history in ${workspace.name}.`);
    return;
  }

  for (const entry of entries.slice(0, limit)) {
    console.log(`${formatDateTime(entry.createdAt)}  ${entry.message}`);
  }
}

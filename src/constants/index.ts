export const CLI_VERSION = "0.3.0";
export const CLI_USER_AGENT = `@env-garden/cli/${CLI_VERSION}`;
export const DEFAULT_API_URL = "https://env.garden";
export const LOGIN_TIMEOUT_MS = 10 * 60 * 1000;
export const LOGIN_EXPIRY_GRACE_MS = 5_000;
export const REQUEST_TIMEOUT_MS = 15_000;
export const MAX_POLLING_INTERVAL_SECONDS = 10;
export const CONFIG_APPLICATION_NAME = "env-garden";
export const CREDENTIALS_FILENAME = "credentials.json";
export const TOKEN_PATTERN = /^eit_[A-Za-z0-9_-]{43}$/;
export const PROJECT_CONFIG_FILENAME = ".eit.json";
export const DEFAULT_ENV_FILENAME = ".env";
export const ENV_KEY_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;
export const PROJECT_LINK_FIELDS = [
  "workspaceId",
  "workspaceName",
  "projectId",
  "projectName",
  "envFileId",
  "envFileName",
] as const;
export const CLI_VALUE_FLAGS = new Set([
  "--api-url",
  "--workspace",
  "--project",
  "--env",
  "--environment",
  "--environments",
  "--description",
  "--role",
  "--projects",
  "--project-role",
  "--search",
  "--limit",
  "--output",
  "-o",
  "--file",
  "-f",
]);
export const ENVIRONMENT_TYPES = [
  "PRODUCTION",
  "STAGING",
  "BETA",
  "DEVELOPMENT",
  "QA",
  "TESTING",
  "UAT",
  "SANDBOX",
  "PREVIEW",
  "DEMO",
  "CANARY",
  "LOCAL",
] as const;
export const ASSIGNABLE_WORKSPACE_ROLES = ["ADMIN", "MEMBER"] as const;
export const ASSIGNABLE_PROJECT_ROLES = ["VIEWER", "CONTRIBUTOR"] as const;
export const HISTORY_DEFAULT_LIMIT = 20;
export const COMMAND_USAGE = {
  workspace: "eit workspace <list|show|create|rename|delete>",
  project: "eit project <list|show|create|rename|delete> [--workspace <name>]",
  envFile: "eit env <list|create|rename|delete> [--workspace <name>] [--project <name>]",
  member: "eit member <list|invite|update|remove> [--workspace <name>]",
} as const;
export const MANAGE_COMMANDS = [
  "workspace",
  "workspaces",
  "project",
  "projects",
  "env",
  "envs",
  "member",
  "members",
  "invite",
  "history",
] as const;
export const MANAGE_FLAGS = ["--workspace", "--project", "--description", "--yes", "-y"] as const;

# Env Garden CLI

The command-line client for [Env Garden](https://env.garden). Pull, push and run with your team's environment variables without passing `.env` files around.

## Install

```bash
pnpm add --global @env-garden/cli
# or run without installing
npx @env-garden/cli <command>
```

## Quick start

```bash
eit login          # approve this device in the browser
eit link           # pick a workspace, project and env file for this folder
eit pull           # write the variables to .env
eit run -- npm run dev   # or inject them without writing a file
```

## Commands

| Command | What it does |
| --- | --- |
| `eit login [--api-url <url>] [--no-browser]` | Sign in. Opens Env Garden to approve the device. |
| `eit logout [--local]` | Revoke this device's session and remove local credentials. `--local` only removes the local file. |
| `eit status` | Show the account, session expiry and the folder's linked env file. |
| `eit link [--workspace <name>] [--project <name>] [--env <name>]` | Link the current folder to an env file. Prompts for anything not passed. |
| `eit unlink` | Remove the folder link. |
| `eit list` | List workspaces, projects and env files you can access. |
| `eit pull [--env <name>] [-o <file>] [--force]` | Download variables into `.env` (or `-o`). Asks before overwriting a different file. |
| `eit push [--env <name>] [-f <file>] [--yes]` | Upload a local file, replacing the env file on Env Garden. Shows a diff and asks first. |
| `eit run [--env <name>] -- <command>` | Run a command with the variables injected. Nothing is written to disk. |

`--env` accepts an env file name (`.env.production`), its environment (`production`) or its id, and overrides the linked env file for that one command.

## Comments and commented-out variables

Comments survive a round trip:

```bash
# Primary database          ← stored as the note on DATABASE_URL
DATABASE_URL="postgres://…"
# LEGACY_FLAG=on            ← stored as a commented-out variable
PORT=3000 # web port        ← inline comments are kept too
```

`eit run` skips commented-out variables.

## Sessions and security

- A login lasts **7 days**. After that, run `eit login` again.
- See and revoke CLI sessions anytime from your **Profile** page on Env Garden. A revoked device is rejected immediately.
- The token is generated locally; only its SHA-256 hash is sent to the server.
- Credentials are stored in your config directory (`~/.config/env-garden`) with user-only permissions.
- `.eit.json` (the folder link) contains only ids and names, no secrets, so it's safe to commit.
- `eit pull` writes `.env` with `0600` permissions and warns if it isn't gitignored.

## Environment variables

| Variable | Purpose |
| --- | --- |
| `EIT_API_URL` | Env Garden URL (for self-hosted instances) |
| `EIT_TOKEN_NAME` | Device name shown on the approval screen and in your profile |
| `EIT_CONFIG_DIR` | Override where credentials are stored |

## Development

```bash
pnpm install
pnpm run typecheck
pnpm run test
pnpm run build
```

For a local Env Garden server: `eit login --api-url http://localhost:3000`.

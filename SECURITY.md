# Security policy

Please **don't** open a public issue for security problems in the CLI.

Report privately through GitHub: **[Report a vulnerability](https://github.com/harsh-govind/env-garden-cli/security/advisories/new)**. For issues in the web app or API, use the [env-garden repository](https://github.com/harsh-govind/env-garden/security/advisories/new).

## How the CLI handles credentials

- `eit login` generates the token locally; only its SHA-256 hash is sent to Env Garden.
- Tokens expire after 7 days and can be revoked from Settings → Sessions or with `eit logout`.
- Credentials are stored with user-only permissions (`0600`, directory `0700`).
- `eit pull` writes `.env` with `0600` permissions and warns if it isn't gitignored.

Only the latest published version receives fixes.

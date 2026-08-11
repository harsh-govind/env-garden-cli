# Env Garden CLI

The command-line client for Env Garden.

## Install

```bash
pnpm add --global @env-garden/cli
```

## Login

Run the login command:

```bash
eit login
```

`eit` opens Env Garden in your browser. Sign in if needed, approve the device,
and return to the terminal. The CLI generates and stores its token automatically.

Without installing globally:

```bash
pnpm dlx @env-garden/cli login
# or
npx @env-garden/cli login
```

For local development or self-hosted Env Garden instances:

```bash
eit login --api-url http://localhost:3000
```

The token is verified before it is stored. Credentials are written to the
platform configuration directory with user-only file permissions.

## Development

```bash
pnpm install
pnpm run typecheck
pnpm run test
pnpm run build
```

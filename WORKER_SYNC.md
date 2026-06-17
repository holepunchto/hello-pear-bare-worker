# Worker Sync

`workers/main.js` is shared across these boilerplates:

- `holepunchto/hello-pear-bare-worker`
- `holepunchto/hello-pear-bare`
- `holepunchto/hello-pear-electron`

The worker is intentionally copied into each boilerplate instead of being consumed as a submodule or installed package. That keeps each template self-contained and editable after a user clones it.

## How It Works

- The canonical worker source lives in this repo at `workers/main.js`.
- Worker-managed dependency versions live in `worker-managed-deps.json`.
- Downstream boilerplate repos stay self-contained and continue to own their root `package.json` and `package-lock.json`.
- A sync workflow opens PRs in each downstream repo when the canonical worker or worker dependency manifest changes.

## Why Not Submodules

- Boilerplate users should get a normal editable file, not a linked dependency.
- `git clone` and `npm install` should work without extra submodule steps.
- Root dependency ownership in each boilerplate is simpler than nested installs.

## Maintainer Flow

1. Edit `workers/main.js` in this repo.
2. If imports changed, update `worker-managed-deps.json`.
3. Merge to `main` or run the sync workflow manually.
4. Review and merge the generated downstream PRs.

## Managed Dependencies

Only the dependency names listed in `worker-managed-deps.json` are managed by sync automation.

- Those dependencies are added or updated in downstream root `package.json`.
- Managed dependencies removed from `worker-managed-deps.json` are removed from downstream root `package.json`.
- Unrelated dependencies in downstream repos are preserved.

## Add Or Remove A Downstream Repo

Edit `worker-sync.config.json`.

- Add a new `{ "repo": "owner/name", "branch": "main" }` entry to include a boilerplate.
- Remove an entry to stop opening PRs for that boilerplate.

## Validation

Run a local drift check against local clones:

```sh
node scripts/sync-worker.js check ../hello-pear-bare-worker ../hello-pear-bare ../hello-pear-electron
```

Run a local sync:

```sh
node scripts/sync-worker.js sync ../hello-pear-bare-worker ../hello-pear-bare ../hello-pear-electron
```

The sync is idempotent. If a repo is already up to date, the script leaves it unchanged.

## GitHub Setup

The workflow requires a secret named `WORKER_SYNC_TOKEN`.

- Use a fine-grained personal access token.
- Grant access to `holepunchto/hello-pear-bare-worker`, `holepunchto/hello-pear-bare`, and `holepunchto/hello-pear-electron`.
- Required permissions: contents write, pull requests write, metadata read.

The default `GITHUB_TOKEN` is not enough for pushing branches and opening PRs in other repositories.

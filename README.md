# DartCounter

A local-first darts scoring app built with Nuxt. Bun is the runtime and package manager.

## Setup

Install [mise](https://mise.jdx.dev/getting-started.html), then install the Bun version pinned in `mise.toml` and the project dependencies:

```bash
mise trust
mise install bun
mise exec -- bun install --frozen-lockfile
```

With mise shell activation enabled, you can run `bun` directly. Otherwise, prefix commands with `mise exec --` as shown below.

## Development

Start the app at http://localhost:3000:

```bash
mise exec -- bun run dev
```

## Checks

### App icons

Edit `public/logo.svg`, then regenerate the favicon, Apple touch icon, and PWA icons:

```bash
mise exec -- bun run pwa-assets:generate
```

The generator uses `minimal2023Preset` from `@vite-pwa/assets-generator`, following [line-learner](https://github.com/ChristopheCVB/line-learner/blob/main/pwa-assets.config.ts). Commit the generated files in `public/` with the SVG source. Builds use these committed assets without regenerating them. This configures icons only; the app has no PWA manifest or service worker.

### Validation

Install Chromium and its system dependencies once before running browser tests:

```bash
mise exec -- bunx --bun playwright-core install --with-deps chromium
```

The system dependency installation may request sudo. Run all checks with:

```bash
mise exec -- bun run lint
mise exec -- bun run test
mise exec -- bun run typecheck
mise exec -- bun run build
```

Vitest runs three projects in order: pure unit tests, Nuxt component tests using happy-dom, and Chromium E2E tests against a production build. Each browser test uses a fresh context. To run one project or watch tests:

```bash
mise exec -- bun run test:unit
mise exec -- bun run test:nuxt
mise exec -- bun run test:e2e
mise exec -- bun run test:watch
```

Test paths mirror the source tree beneath each suite: `tests/unit/app/composables/`, `tests/nuxt/app/components/`, and `tests/e2e/app/pages/`. `bun run typecheck` checks every suite: unit and Nuxt tests use the app TypeScript project, and E2E tests use the Node project. Root TypeScript configs and tooling scripts are also checked, with JavaScript checking enabled for the tooling project. `bun run lint` covers all project JavaScript, TypeScript, and Vue files.

Use `mise exec -- bun run lint:fix` to apply automatic lint corrections. The ESLint config uses Nuxt's recommended rules without additional formatting rules.

The E2E harness uses the Node server preset because Nuxt test utilities launch the server with Node. Docker and the normal production build use Bun. Keep Node 24 available for the E2E harness.

## Production

Build and start the Bun server:

```bash
mise exec -- bun run build
mise exec -- bun run start
```

Use `mise exec -- bun run preview` to preview the production build locally.

### Docker

```bash
docker build -t dartscounter .
docker run --rm -p 3000:3000 dartscounter
```

The multistage image builds with Bun 1.4.3 and contains the production `.output` directory, the Bun runtime, and `curl` for Coolify's HTTP health checks. It listens on port 3000. Configure Coolify's HTTP health check to use port 3000 and path `/`. Matches and settings remain in each browser's localStorage; the container needs no database or volume.

## GitHub Actions and releases

The workflows follow [line-learner](https://github.com/ChristopheCVB/line-learner/tree/main/.github/workflows):

- Pull requests targeting `main` run lint, typecheck, and all test projects, then validate the Docker build. The workflow also supports manual runs. Images are not published.
- Pushes to `main` run Release Please. Conventional commits such as `feat:` and `fix:` produce a release PR with version and changelog updates; merging that PR creates a release and calls the deployment workflow directly.
- Deploy can also be run manually from `main`, with an optional force redeploy. It waits up to 600 seconds for Coolify.

Before enabling the workflows, configure this repository:

1. Register a Linux self-hosted runner with Bash, Node 24, and Docker/Buildx access. Use a current GitHub Actions runner compatible with the referenced actions. CI installs the pinned Bun version automatically. The runner must be able to install Chromium system packages via apt/sudo and reach package registries and the Playwright download service.
2. Under **Settings → Actions → General → Workflow permissions**, enable **Allow GitHub Actions to create and approve pull requests**. The release workflow requests write permissions for contents and pull requests.
3. Create a Coolify application using this repository's Dockerfile, branch `main`, and container port 3000. Disable independent push-triggered deployments if deployments should happen only after a release or manual dispatch.
4. Add the Actions secret `COOLIFY_API_TOKEN` and repository variables `COOLIFY_DOMAIN` and `COOLIFY_APP_UUID` for this application.
5. Create the labels `dependencies`, `bun`, `docker`, and `github-actions` for Dependabot PRs.

Runner registration and Coolify settings are managed outside this repository. Avoid cancelling an in-progress deploy; release-job concurrency only cancels superseded release processing.

## Dependency updates

```bash
mise exec -- bun update --latest
```

Commit `package.json` and `bun.lock` together. When upgrading Bun, keep the exact version in `mise.toml`, `packageManager`, and the Dockerfile's `BUN_VERSION` in sync, and update `engines.bun` to the minimum verified version. Actions read Bun's version from `mise.toml`.

Dependabot checks Bun packages, Docker base images, and GitHub Actions daily at 10:00 UTC, with a six-day cooldown. Minor and patch updates are grouped per ecosystem; major updates remain separate.

TypeScript stays on version 6 because `vue-tsc` currently requires its JavaScript compiler API, which TypeScript 7 no longer provides. Dependabot ignores TypeScript 7 and above. The typecheck command preloads `scripts/vue-tsc-bun.cjs`, adapted from line-learner, so vue-tsc's compiler patch works under Bun and Vue files are checked. Vitest uses its threads pool because the default forks pool hangs under Bun.

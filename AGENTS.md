# AGENTS.md

Conventions for anyone, human or coding agent, changing this repository. `README.md` explains what the project does; this file explains how to change it without breaking its guarantees.

## What this is

An httpbin-style HTTP testing service on Cloudflare Workers. A TypeScript Worker (`src/`) answers the API; a static web UI (`public/`) is served by Workers Static Assets without invoking the Worker. There is no build step for the UI and no runtime dependency.

## Commands

| Command              | Use it                                                                 |
| -------------------- | ---------------------------------------------------------------------- |
| `npm run dev`        | Local server on <http://localhost:8787>                                |
| `npm run check`      | Before every commit: generated types current, type-check, all tests    |
| `npm test`           | Tests only (Vitest inside the Workers runtime)                         |
| `npm run typecheck`  | Type-check `src/` and `test/`                                          |
| `npm run cf-typegen` | After any change to bindings or flags in `wrangler.jsonc`              |
| `npm run deploy`     | `wrangler deploy`. Only when asked to deploy                           |

Requires Node.js 22.12 or later.

## Rules that keep the project coherent

1. **The route table is the single source of truth.** An endpoint is one entry in a `RouteGroup` under `src/routes/`. That entry feeds the router, `GET /endpoints`, the 404 help and the web UI. Never list endpoints by hand in the UI or the Worker.
2. **Keep `README.md` current in the same change.** Update the endpoint table, usage examples, limits and behaviour notes whenever they change. `test/docs.test.ts` fails when the endpoint table or the quoted limits drift from the code. Usage examples must be runnable as written: run them against `npm run dev` before committing.
3. **Limits live in `src/lib/limits.ts`.** The Worker, `GET /endpoints`, the web page and the README all quote them, and tests compare all four. Change the number there, then update the README text and the defaults in `public/index.html`.
4. **Errors are thrown, not built.** Throw `HttpError(status, message, headers?, details?)` from a handler. `src/index.ts` turns it into JSON and logs anything unexpected. Never return a stack trace or internal message to the client.
5. **No endpoint without a test.** Cover the happy path and the failure the endpoint exists to demonstrate.

## Workers best practices

Follow <https://developers.cloudflare.com/workers/best-practices/workers-best-practices/>. The points that matter most here:

- **No request state at module scope.** Isolates are reused across requests. Module scope holds only immutable data (the compiled router, constants). Pass everything else through `RouteContext`.
- **No floating promises.** `await` it, `return` it, or pass it to `ctx.waitUntil()`. Streaming responses use the pull-based `timedStream` helper instead of a detached writer loop.
- **Do not buffer what you can stream, and bound what you must buffer.** Request bodies are read through `readBody()`, which enforces `LIMITS.bodyBytes`.
- **Bindings, not REST calls.** Assets are read through `env.ASSETS`.
- **`Env` is generated.** Never hand-write it. Run `npm run cf-typegen` and commit `worker-configuration.d.ts`.
- **Web Crypto for anything secret-like.** Compare credentials with `safeEqual()` (`crypto.subtle.timingSafeEqual` over hashes), never `===`.
- **Structured logs.** `console.error(JSON.stringify({ message, ... }))`, so entries are searchable in Workers Logs.
- **Configuration.** Keep `compatibility_date` recent, keep `nodejs_compat`, `upload_source_maps` and `observability` on, and keep secrets out of `wrangler.jsonc` and the repository.
- **Pre-compressed bodies** need `encodeBody: 'manual'`. Do not re-wrap such a Response (`new Response(body, response)` drops the option); mutate its headers instead, as `applyCommonHeaders` does.

Cloudflare's products change quickly. Check the current documentation before relying on memory: any docs page is available as Markdown by appending `index.md` to its URL, and <https://developers.cloudflare.com/workers/llms.txt> indexes them.

## Running behind Cloudflare

- **`/cdn-cgi/` belongs to Cloudflare.** On a deployed Worker, Cloudflare answers every `/cdn-cgi/*` request itself, so `src/routes/cloudflare.ts` only runs locally and in tests. Do not build features that depend on the Worker seeing those paths.
- **Cloudflare adds request headers and cookies.** `src/lib/cloudflare.ts` defines which ones. They are echoed by default and removed when the client passes `?show_env=0`. Route every echo of request headers through `requestHeaders()` so the switch works everywhere.
- **URLs arrive normalized** (repeated slashes merged, possibly more depending on zone settings). Do not write logic or tests that depend on receiving a non-normalized path.
- **The UI's Content Security Policy is strict** (`public/_headers`): same-origin scripts and styles only. No inline `<script>`, `<style>`, `style=""` or `on*=""` attributes, and no third-party assets. `test/assets.test.ts` enforces this. `_headers` applies to static assets only; Worker responses set their headers in `src/lib/cors.ts`.

References: [HTTP headers](https://developers.cloudflare.com/fundamentals/reference/http-headers/), [cookies](https://developers.cloudflare.com/fundamentals/reference/policies-compliances/cloudflare-cookies/), [CSP](https://developers.cloudflare.com/fundamentals/reference/policies-compliances/content-security-policies/), [connection limits](https://developers.cloudflare.com/fundamentals/reference/connection-limits/), [error responses](https://developers.cloudflare.com/fundamentals/reference/error-responses/), [URL normalization](https://developers.cloudflare.com/rules/normalization/), [`/cdn-cgi/`](https://developers.cloudflare.com/fundamentals/reference/cdn-cgi-endpoint/).

## Local development and debugging

- **Local Explorer** is built into the dev server at <http://localhost:8787/cdn-cgi/local/explorer> (Wrangler 4.118 or later). It shows the logs and traces of every local request, which is the fastest way to see why one failed. Its API, described by an OpenAPI document at `/cdn-cgi/local/explorer/api`, exposes the same data to scripts and agents; for example `POST /cdn-cgi/local/explorer/api/local/observability/query` runs read-only SQL over captured traces and logs. See <https://developers.cloudflare.com/workers/local-development/local-explorer/>.
- **Breakpoints:** `.vscode/launch.json` has launch and attach configurations for `wrangler dev`.
- **Local differences:** there is no Cloudflare edge in front of `wrangler dev`, so Cloudflare-added headers are mostly absent, `CF-Connecting-IP` may be missing (`origin` falls back to `unknown`), and `/cdn-cgi/trace` comes from the Worker fallback.

## Testing

Tests run in `workerd` through `@cloudflare/vitest-plugin`, with the real `wrangler.jsonc`. See <https://developers.cloudflare.com/workers/testing/vitest-integration/>.

- Use `call()` from `test/helpers.ts` by default. It goes through `exports.default.fetch`, the entry point Cloudflare invokes, and does not follow redirects.
- Use `direct()` only when the fetch path would hide what you are testing. It returns the Response exactly as the handler built it, which is how the compression tests prove the bytes are really encoded.
- Storage is isolated per test file and files run concurrently. This Worker is stateless, so tests need no setup or ordering; keep it that way.
- The plugin injects `nodejs_compat` whether or not the config has it. The config does, and must keep it: `node:buffer`, `node:crypto` and `node:zlib` are used at runtime.
- Assert on behaviour a client can observe (status, headers, body), with realistic inputs: malformed headers, oversized bodies, repeated keys, percent-encoding.

## Web UI

- Plain HTML, CSS and native ES modules. No framework, bundler or CDN.
- Colours are declared once in `public/css/theme.css` as `light-dark(<light>, <dark>)`. Add or change tokens there; do not hard-code colours in `app.css`. Check both themes.
- All sizes are in `rem`. The root size steps up on very wide screens, so the layout scales to 4K. Verify changes at phone (375px), tablet (768px), desktop (1440px) and 4K (3840px) widths, with no horizontal scrolling.
- Text from the network is inserted with `textContent` through `el()` in `public/js/dom.js`. Never use `innerHTML` with response data.
- The request builder only talks to its own origin, and a shared link (`/#GET:/path`) only fills in the form. Keep both properties: nothing may be sent just because a page was opened.
- External links open in a new tab with `rel="noopener noreferrer"`.

## Commits, pull requests and privacy

- Write plain, descriptive commit messages and pull request descriptions about the change itself. Do not add tool, assistant or co-author attribution lines.
- This repository is public. Never commit account IDs, zone IDs, API tokens, email addresses, real client IP addresses, or the hostnames of private deployments. Use `example.com` and the documentation ranges (`203.0.113.0/24`, `2001:db8::/32`) in examples and tests.
- `wrangler.jsonc` stays deployable by anyone: no account-specific routes or IDs. Deployment-specific settings belong in the dashboard or in local, uncommitted configuration.
- Keep the disclaimer in `README.md` and the short version in the page footer intact.

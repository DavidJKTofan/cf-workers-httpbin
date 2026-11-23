# httpbin on Cloudflare Workers

An [httpbin](https://httpbin.org)-style HTTP request and response testing service, built on Cloudflare Workers with TypeScript and Workers Static Assets.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/DavidJKTofan/cf-workers-httpbin)

> [!IMPORTANT]
> This is a personal project and not an official Cloudflare product. Read the [disclaimer](#disclaimer) before using or deploying it.

## Features

- Echoes requests back as JSON: method, URL, query arguments, headers, body, form fields and file uploads.
- Returns any status code, redirect chain, cookie, cache header or custom response header you ask for.
- Tests authentication clients: Basic, hidden Basic, Bearer and Digest.
- Serves sample JSON, HTML, XML, UTF-8, real PNG, JPEG, WebP and SVG images, and bodies that really are gzip, deflate or Brotli encoded.
- Simulates slow and streaming responses: delays, drip, newline-delimited JSON, byte ranges.
- Shows what Cloudflare adds to a request, and can hide it again with `?show_env=0`.
- Includes a web UI with a request builder, curl command generator, shareable request links, and light and dark themes.

### Implemented endpoints

Each group links to the file that implements it. The same list is served live at `GET /endpoints` and drives the web UI, so the three cannot drift apart: a test fails if an endpoint is missing from this table.

**[HTTP methods](src/routes/methods.ts)**

| Method | Path | Description |
| --- | --- | --- |
| GET | `/get` | Echo a GET request |
| POST | `/post` | Echo a POST request |
| PUT | `/put` | Echo a PUT request |
| PATCH | `/patch` | Echo a PATCH request |
| DELETE | `/delete` | Echo a DELETE request |
| HEAD | `/head` | Respond to HEAD with headers only |
| ANY | `/anything/*` | Echo any method on any sub-path |

**[Status codes](src/routes/status.ts)**

| Method | Path | Description |
| --- | --- | --- |
| ANY | `/status/:code` | Respond with the given status code (200-599) |

**[Request inspection](src/routes/inspect.ts)**

| Method | Path | Description |
| --- | --- | --- |
| GET | `/headers` | Return the request headers (?show_env=0 hides those Cloudflare adds) |
| GET | `/ip` | Return the caller's IP address |
| GET | `/user-agent` | Return the User-Agent header |

**[Response formats](src/routes/formats.ts)**

| Method | Path | Description |
| --- | --- | --- |
| GET | `/json` | A sample JSON document |
| GET | `/html` | A sample HTML document |
| GET | `/xml` | A sample XML document |
| GET | `/robots.txt` | A robots.txt that disallows /deny |
| GET | `/deny` | The page robots.txt asks crawlers to skip |
| GET | `/encoding/utf8` | A UTF-8 encoded HTML page |
| GET | `/gzip` | A gzip-encoded JSON response |
| GET | `/deflate` | A deflate-encoded JSON response |
| GET | `/brotli` | A Brotli-encoded JSON response |

**[Authentication](src/routes/auth.ts)**

| Method | Path | Description |
| --- | --- | --- |
| GET | `/basic-auth/:user/:passwd` | Challenge with HTTP Basic auth (401 on failure) |
| GET | `/hidden-basic-auth/:user/:passwd` | Basic auth that answers 404 instead of challenging |
| GET | `/bearer` | Require an Authorization: Bearer token |
| GET | `/digest-auth/:qop/:user/:passwd` | Challenge with HTTP Digest auth (MD5) |

**[Cookies](src/routes/cookies.ts)**

| Method | Path | Description |
| --- | --- | --- |
| GET | `/cookies` | Return the cookies sent with the request |
| GET | `/cookies/set` | Set cookies from the query string, then redirect to /cookies |
| GET | `/cookies/set/:name/:value` | Set a single cookie, then redirect to /cookies |
| GET | `/cookies/delete` | Delete the cookies named in the query string |

**[Redirects](src/routes/redirects.ts)**

| Method | Path | Description |
| --- | --- | --- |
| GET | `/redirect/:n` | Redirect n times, then land on /get |
| GET | `/relative-redirect/:n` | Redirect n times using relative Location headers |
| GET | `/absolute-redirect/:n` | Redirect n times using absolute Location headers |
| ANY | `/redirect-to` | Redirect to ?url= with an optional ?status_code= |

**[Dynamic data](src/routes/dynamic.ts)**

| Method | Path | Description |
| --- | --- | --- |
| GET | `/uuid` | Generate a random UUID v4 |
| GET | `/base64/encode/:text` | Base64-encode UTF-8 text from the path or ?text= |
| GET | `/base64/decode/:data` | Decode base64 from the path or ?data= |
| ANY | `/delay/:seconds` | Wait up to 10 seconds, then echo the request |
| GET | `/bytes/:n` | Return n random bytes (max 100,000) |
| GET | `/stream/:n` | Stream n JSON lines (max 100) |
| GET | `/range/:n` | Serve n bytes with Range request support |
| GET | `/drip` | Drip ?numbytes= over ?duration= seconds after an optional ?delay= |
| GET | `/links/:n/:offset` | An HTML page with n links to itself |

**[Caching and response headers](src/routes/cache.ts)**

| Method | Path | Description |
| --- | --- | --- |
| GET | `/cache` | 304 when sent a conditional header, otherwise 200 with validators |
| GET | `/cache/:seconds` | Set Cache-Control: public, max-age=seconds |
| GET | `/etag/:etag` | Honour If-None-Match (304) and If-Match (412) for the given ETag |
| GET, POST | `/response-headers` | Return the query string as response headers |

**[Images](src/routes/images.ts)**

| Method | Path | Description |
| --- | --- | --- |
| GET | `/image` | An image in the format the Accept header asks for |
| GET | `/image/png` | A PNG image |
| GET | `/image/jpeg` | A JPEG image |
| GET | `/image/webp` | A WebP image |
| GET | `/image/svg` | An SVG image |

**[Forms](src/routes/forms.ts)**

| Method | Path | Description |
| --- | --- | --- |
| GET, POST | `/forms/post` | An HTML form (GET) that posts back to this endpoint (POST) |

**[Cloudflare](src/routes/cloudflare.ts)**

| Method | Path | Description |
| --- | --- | --- |
| GET | `/cdn-cgi/trace` | Cloudflare's own trace of your connection: data center, protocol, TLS |

**[Service](src/routes/index.ts)**

| Method | Path | Description |
| --- | --- | --- |
| GET | `/endpoints` | This catalogue of endpoints and limits as JSON |

## Quick start

Requires Node.js 22.12 or later.

```bash
npm install
npm run dev
```

Open <http://localhost:8787>.

## Usage examples

The examples use a local `npm run dev`. Set `HTTPBIN` to your own deployment to run them there.

```bash
export HTTPBIN=http://localhost:8787

# Inspect what your client sends
curl "$HTTPBIN/get?search=cloudflare&page=2"
curl "$HTTPBIN/headers?show_env=0"    # only the headers your client sent

# Send a JSON body, or a file as multipart form data, and read it back
curl -X POST "$HTTPBIN/post" -H 'Content-Type: application/json' -d '{"name": "Ada"}'
curl -F 'note=hello' -F 'file=@package.json' "$HTTPBIN/post"

# See how a client copes with errors, redirects and slow responses
curl -i "$HTTPBIN/status/503"
curl -sL -o /dev/null -w '%{num_redirects} redirects, final status %{http_code}\n' "$HTTPBIN/redirect/3"
curl --max-time 2 "$HTTPBIN/delay/5"    # curl gives up after 2 seconds

# Authentication
curl -u user:passwd "$HTTPBIN/basic-auth/user/passwd"
curl --digest -u user:passwd "$HTTPBIN/digest-auth/auth/user/passwd"
curl -H 'Authorization: Bearer my-token' "$HTTPBIN/bearer"

# Cookies: -c turns on curl's cookie engine, so the cookie survives the redirect
curl -sL -c /dev/null "$HTTPBIN/cookies/set?session=abc123"

# Caching, conditional and range requests
curl -i "$HTTPBIN/cache/60"
curl -i -H 'If-None-Match: "abc123"' "$HTTPBIN/etag/abc123"    # 304 Not Modified
curl -i -r 0-99 "$HTTPBIN/range/1024"                          # 206 Partial Content

# Compression and streaming
curl --compressed "$HTTPBIN/brotli"
curl -N "$HTTPBIN/stream/5"

# The connection as Cloudflare sees it
curl "$HTTPBIN/cdn-cgi/trace"
```

From JavaScript:

```js
const base = 'http://localhost:8787';

// Echo a JSON body
const response = await fetch(`${base}/post`, {
	method: 'POST',
	headers: { 'Content-Type': 'application/json' },
	body: JSON.stringify({ name: 'Ada' }),
});
const echo = await response.json();
console.log(echo.json); // { name: 'Ada' }

// Check that your code handles a failing upstream
const failing = await fetch(`${base}/status/503`);
console.log(failing.ok, failing.status); // false 503

// Check that your client-side timeout works
try {
	await fetch(`${base}/delay/5`, { signal: AbortSignal.timeout(2000) });
} catch (error) {
	console.log(error.name); // TimeoutError
}
```

### Response format

The echo endpoints (`/get`, `/post`, `/anything` and the others that describe your request) answer with the same shape as the original httpbin:

```json
{
  "args": { "page": "2" },
  "data": "{\"name\": \"Ada\"}",
  "files": {},
  "form": {},
  "headers": { "content-type": "application/json", "user-agent": "curl/8.7.1" },
  "json": { "name": "Ada" },
  "method": "POST",
  "origin": "203.0.113.7",
  "url": "https://httpbin.example.com/post?page=2"
}
```

`data` is the raw body and `json` its parsed value. Repeated query or form keys become arrays. A body that is not valid UTF-8 comes back as a base64 `data:` URL, and uploaded files are summarised by name, size and type.

Errors are JSON too, for example `{ "error": "Request body too large", "status": 413, "limit_bytes": 1048576 }`.

## Usage limits

- Request bodies can be up to 1 MiB. A larger body gets `413`.
- Anything you can scale is capped rather than rejected: `/delay` at 10 seconds, `/bytes` and `/range` at 100,000 bytes, `/stream` at 100 lines, `/drip` at 100,000 bytes over 10 seconds, `/links` at 200 links and redirect chains at 20 hops. The live values are in `GET /endpoints` under `limits`, and come from [`src/lib/limits.ts`](src/lib/limits.ts).
- A malformed request gets a 4xx JSON response that says why.
- The service sets no rate limit of its own. Whoever operates a deployment can add one at the Cloudflare edge, for example with [rate limiting rules](https://developers.cloudflare.com/waf/rate-limiting-rules/). A client that is limited or blocked there gets `429 Too Many Requests` (wait for `Retry-After` when it is sent) or a challenge page, which API clients cannot solve.
- In front of the service, Cloudflare accepts URLs up to 16 KB and request headers up to 128 KB in total. See [Connection limits](https://developers.cloudflare.com/fundamentals/reference/connection-limits/).

## Behind Cloudflare

Every request passes through Cloudflare before it reaches the Worker. That changes a few things an HTTP testing service would otherwise show you verbatim.

- **Request headers.** `/headers` and the `headers` field of every echo include what Cloudflare adds, such as `CF-Connecting-IP`, `CF-IPCountry`, `CF-Ray`, `CF-Visitor`, `CDN-Loop`, `X-Forwarded-For` and `X-Forwarded-Proto`. Cloudflare also sets `Accept-Encoding` to `br, gzip` whatever the client sent. Unlike httpbin.org, which hides proxy headers until you add `?show_env=1`, this service shows them by default. Add `?show_env=0` to any echo endpoint to see only what the client sent. The bot signals that the [Add bot protection headers](https://developers.cloudflare.com/rules/transform/managed-transforms/reference/) Managed Transform can add (`cf-bot-score`, `cf-verified-bot`, `cf-ja3-hash`, `cf-ja4`, and `cf-threat-score`) are never echoed. See [Cloudflare HTTP headers](https://developers.cloudflare.com/fundamentals/reference/http-headers/).
- **Response headers.** Cloudflare adds `CF-Ray` and removes a few headers before the client sees them, including `Alt-Svc`, `Cache-Tag` and the `X-Accel-*` family, so setting those through `/response-headers` has no visible effect.
- **Cookies.** Cloudflare features enabled on the zone can set their own cookies, for example `__cf_bm` or `cf_clearance`. A client with a cookie jar sends them back, so they appear in `/cookies` unless you add `?show_env=0`. See [Cloudflare cookies](https://developers.cloudflare.com/fundamentals/reference/policies-compliances/cloudflare-cookies/).
- **URLs.** Cloudflare normalizes URLs before the Worker sees them. Repeated slashes are always merged; depending on zone settings, dot segments and percent-encoding are normalized too. `/anything` can therefore echo a slightly different path from the one you sent. See [URL normalization](https://developers.cloudflare.com/rules/normalization/).
- **Errors.** The service answers its own errors in JSON. Errors generated by Cloudflare itself (1xxx codes and its own 5xx) are HTML unless the client asks for `application/json` or `text/markdown` in `Accept`. See [Error responses](https://developers.cloudflare.com/fundamentals/reference/error-responses/).
- **`/cdn-cgi/trace`.** On a deployed Worker this path is answered by Cloudflare, not by this code, and reports the data center, HTTP version and TLS version of the connection. Locally and in tests the Worker returns the same `key=value` format from what the runtime knows, marked with `X-Trace-Source: worker-fallback`. `/robots.txt` disallows `/cdn-cgi/`, as Cloudflare recommends. See [The /cdn-cgi/ endpoint](https://developers.cloudflare.com/fundamentals/reference/cdn-cgi-endpoint/).
- **Content Security Policy.** [`public/_headers`](public/_headers) gives the web UI a strict policy that only allows same-origin scripts and styles. If you enable a Cloudflare feature that injects scripts into pages, such as Web Analytics or Rocket Loader, extend the policy as described in [Content Security Policies](https://developers.cloudflare.com/fundamentals/reference/policies-compliances/content-security-policies/).

## Scripts

| Command              | What it does                                                      |
| -------------------- | ----------------------------------------------------------------- |
| `npm run dev`        | Run the Worker and static assets locally with Wrangler            |
| `npm test`           | Run the test suite inside the Workers runtime                     |
| `npm run smoke`      | Send every endpoint example to a running server over HTTP         |
| `npm run lint`       | Lint with oxlint, type-aware, so unawaited promises fail          |
| `npm run format`     | Format with Prettier (`format:check` only reports)                |
| `npm run typecheck`  | Type-check the Worker and the tests                               |
| `npm run cf-typegen` | Regenerate `worker-configuration.d.ts` after changing bindings    |
| `npm run check`      | Generated types, lint, formatting, type-check and tests in one go |
| `npm run deploy`     | Deploy with Wrangler                                              |

## Deploy

Use the button above, or deploy from a clone:

```bash
npx wrangler login
npm run deploy
```

The button also connects your copy of the repository to [Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/), which then deploys every push to `main` with `npx wrangler deploy`. In that setup, merging a pull request is the deploy, so merge only when its checks pass. GitHub Actions never deploy: they only check.

`wrangler.jsonc` turns the `workers.dev` URL and Preview URLs off, so a fresh deployment has no public URL until you give it one. Add a custom domain on a zone in the same account, either in the dashboard or in `wrangler.jsonc`:

```jsonc
"routes": [{ "pattern": "httpbin.example.com", "custom_domain": true }]
```

To use the `workers.dev` URL instead, set `"workers_dev": true`. Without routes in the file, Wrangler leaves domains you added in the dashboard alone.

## Continuous integration

GitHub Actions workflows in [`.github/workflows/`](.github/workflows) check every push to `main` and every pull request. They run on standard GitHub-hosted runners, which are free for public repositories, and need no secrets or Cloudflare account. A pull request from someone without write access gets the same checks once a maintainer approves the run: GitHub holds those runs until then. None of the workflows deploys.

Only people with write access to the repository, the owner and collaborators, can start a workflow by hand or re-run one. Nobody else can start the security audit.

| Workflow | When | What it checks |
| --- | --- | --- |
| [CI](.github/workflows/ci.yml) | Push to `main`, pull requests | Generated types, oxlint, Prettier, TypeScript and actionlint. The test suite on Node.js 22.12, 24 and 26. A `wrangler deploy --dry-run` bundle and a `wrangler check startup` profile, uploaded as the `worker-bundle` artifact. `npm run smoke` against `wrangler dev` |
| [Security](.github/workflows/security.yml) | Push to `main`, pull requests, weekly | CodeQL for the code and the workflows, zizmor for workflow security, dependency review on pull requests, npm registry signatures and runtime dependency advisories |
| [Security audit](.github/workflows/security-audit.yml) | By hand, weekly, `main` only | A full audit with Cloudflare's [security-audit skill](https://github.com/cloudflare/security-audit-skill), run by OpenCode through Cloudflare AI Gateway, with Workers AI's gpt-oss-120b by default. The report is encrypted with OpenSSL so only you can read it. Skipped until you add a Cloudflare API token, and fails if the rest of its configuration is missing, see below |

[Dependabot](.github/dependabot.yml) proposes npm and GitHub Actions updates once a week, grouped, and only for releases at least a week old. Every action is pinned to a full commit SHA, which Dependabot keeps current.

`npm run check` runs the same lint, format, type and test checks locally.

### Security audit

The audit runs Cloudflare's security-audit skill with the [OpenCode](https://opencode.ai) agent, and every model call goes through [Cloudflare AI Gateway](https://developers.cloudflare.com/ai-gateway/). GitHub holds a Cloudflare API token, never a provider key. The default model is Workers AI's [`@cf/openai/gpt-oss-120b`](https://developers.cloudflare.com/workers-ai/models/gpt-oss-120b/). Anthropic and OpenAI models work through the same gateway, paid with [Unified Billing](https://developers.cloudflare.com/ai-gateway/features/unified-billing/) credits. The agent is OpenCode rather than Claude Code because Claude Code speaks only the Anthropic Messages API, which AI Gateway does not offer for Workers AI models.

This is the one workflow that costs money. GitHub runs it for free, but its model calls are billed to your Cloudflare account, and a full audit is long and makes many of them.

#### When it runs

- **By hand**, from `main`. See [Run it](#run-it).
- **Weekly**, every Monday at 03:17 UTC, on `main`, with the `standard` profile, gpt-oss-120b and `high` reasoning effort. GitHub turns off scheduled workflows in a public repository after 60 days without activity; turn it back on under **Actions**. To stop the weekly run, remove the `schedule` trigger from the workflow, or turn the workflow off:

  ```bash
  gh workflow disable security-audit.yml
  ```

- **Never** on pushes or pull requests. Started on any branch other than `main`, the job is skipped.
- **Only by the owner and collaborators.** Starting a workflow by hand needs write access, which GitHub checks. The audit's secrets are in an environment limited to `main`, so neither a fork nor another branch receives them.

Each run checks its configuration first. Without `CLOUDFLARE_API_TOKEN`, the job is skipped. With the token but another setting missing, an unusable certificate, or a gateway that rejects a first small request, it fails in its first steps, before the audit starts.

#### Run it

Under **Actions > Security audit > Run workflow**, keep the branch on `main` and choose:

| Input | Default | What it sets |
| --- | --- | --- |
| `profile` | `standard` | How thoroughly the skill covers the code: `quick`, `standard` or `deep` |
| `model` | `workers-ai/@cf/openai/gpt-oss-120b` | The model, named as AI Gateway names it |
| `reasoning` | `high` | Reasoning effort: `low`, `medium` or `high` |
| `agent_budget` | empty | The most agent runs the skill may plan for. Empty lets it choose |

Or start it from a terminal, then follow the run:

```bash
gh workflow run security-audit.yml --ref main -f profile=quick
```

```bash
gh run watch "$(gh run list --workflow security-audit.yml --limit 1 --json databaseId --jq '.[0].databaseId')"
```

A run takes up to two hours. Its log shows only the configuration checks, the certificate fingerprint and OpenCode's exit status. The findings are in the encrypted artifact: see [Read the report](#read-the-report).

Models are named as AI Gateway names them: `workers-ai/@cf/openai/gpt-oss-120b`, `anthropic/claude-opus-5-5` or `openai/gpt-5.5`. If OpenCode's built-in catalogue does not know a model, add it with its context and output limits under `provider.cloudflare-ai-gateway.models` in [`.github/security-audit/opencode.json`](.github/security-audit/opencode.json), as gpt-oss-120b is. Mark a model that supports reasoning effort with `"reasoning": true`: without it OpenCode offers no `reasoning` levels for it. gpt-oss-120b is much smaller than frontier models and has a 128,000-token context window, so expect a shallower audit, and try the `quick` profile first.

#### Set it up

1. In the dashboard under **AI > AI Gateway**, create a gateway for the audit, for example `security-audit`, or reuse one. Keep authentication on, and add a [spend limit](https://developers.cloudflare.com/ai-gateway/features/spend-limits/), for example 10 US dollars a week. Every audit request carries the [custom metadata](https://developers.cloudflare.com/ai-gateway/observability/custom-metadata/) `app: security-audit`, so on a shared gateway, limit the rule to that value (**Limit by metadata**, key `app`, **Filter by value**). To use Anthropic or OpenAI models, also load AI Gateway credits.

   A [DLP](https://developers.cloudflare.com/ai-gateway/features/dlp/) policy set to **Block** can stop the audit partway, with error `2029` or `2030`, because audit prompts quote the code and discuss credentials, cookies and IP addresses: set such policies to **Flag** on this gateway. The audit's requests ask the gateway not to [log](https://developers.cloudflare.com/ai-gateway/observability/logging/) them (`cf-aig-collect-log: false`), so findings stay out of the gateway's logs while its other traffic is still logged.

2. [Create a Cloudflare API token](https://developers.cloudflare.com/fundamentals/api/get-started/create-token/) with **Account > Workers AI > Read** and **Account > AI Gateway > Run**, and give it an expiry date. AI Gateway permissions cannot be limited to one gateway, so the token works with every gateway in the account.
3. Under **Settings > Environments**, create an environment named `security-audit` and limit its deployment branches to `main`. Store the token, your account ID and the gateway name in it. The first two commands ask for the value. The account ID is a secret only so that GitHub masks it in the log.

   ```bash
   gh secret set CLOUDFLARE_API_TOKEN --env security-audit
   ```

   ```bash
   gh secret set CLOUDFLARE_ACCOUNT_ID --env security-audit
   ```

   ```bash
   gh variable set SECURITY_AUDIT_GATEWAY_ID --env security-audit --body security-audit
   ```

4. Create an RSA key pair and a self-signed certificate with OpenSSL, and store the certificate, the public half, in the environment as the `SECURITY_AUDIT_RECIPIENT_CERT` secret. The workflow encrypts every report to it. The first command asks for a passphrase that protects the private key, and the second asks for it again.

   ```bash
   mkdir -p -m 700 ~/.config/security-audit
   ```

   ```bash
   openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:4096 -aes-256-cbc -out ~/.config/security-audit/key.pem
   ```

   ```bash
   openssl req -x509 -new -key ~/.config/security-audit/key.pem -sha256 -days 3650 -subj "/CN=security-audit" -out ~/.config/security-audit/cert.pem
   ```

   ```bash
   gh secret set SECURITY_AUDIT_RECIPIENT_CERT --env security-audit < ~/.config/security-audit/cert.pem
   ```

   Keep `key.pem` and its passphrase safe: without them no report can be read. These commands need OpenSSL 3.0 or later (`openssl version`). The LibreSSL that macOS installs as `/usr/bin/openssl` cannot decrypt these reports.

   Each run prints the SHA-256 fingerprint of the certificate it encrypted to. To check that it is yours, compare it with:

   ```bash
   openssl x509 -in ~/.config/security-audit/cert.pem -noout -fingerprint -sha256
   ```

#### Read the report

Download the latest run's artifact and decrypt it into `.security-audit/`, which git ignores:

```bash
gh run download "$(gh run list --workflow security-audit.yml --limit 1 --json databaseId --jq '.[0].databaseId')" --name security-audit
```

```bash
mkdir -p .security-audit
```

```bash
openssl cms -decrypt -binary -inform DER -in security-audit.tar.gz.cms -recip ~/.config/security-audit/cert.pem -inkey ~/.config/security-audit/key.pem | tar -xzf - -C .security-audit
```

Start with `.security-audit/report/REPORT.md`. The agent's event log is in `.security-audit/log/`. File confirmed findings as [draft private security advisories](https://docs.github.com/en/code-security/security-advisories/working-with-repository-security-advisories/creating-a-repository-security-advisory), never as issues or pull request comments.

#### How it is protected

- **Trusted code only.** The agent reads the code it audits, and text in that code could try to instruct it. So the workflow never runs on pull requests, and runs only on `main`. [`.github/security-audit/opencode.json`](.github/security-audit/opencode.json) denies everything by default, then lets the agent read the checkout, write only to `.security-audit/` and run only the skill's two validators. Sub-agents get the same rules, and web, LSP and question tools stay off. No other configuration can add to it. As the skill requires without a sandbox, the agent installs no dependencies and runs none of the project's code.
- **Few new dependencies.** The workflow downloads OpenCode 1.19.4, the version that Cloudflare's Sandbox guide pins, from the npm registry and checks it against a pinned SHA-512 before use. ripgrep comes from Ubuntu's signed archive, so OpenCode does not download it from GitHub. OpenCode's update check, model catalogue fetch, background plugin install and LSP downloads are off. The skill is pinned to a commit. Dependabot does not track the OpenCode and skill pins, so update them by hand.
- **Findings stay private.** The agent's output and event log never reach the workflow log, the gateway does not log the audit's requests, and the agent cannot post anything. Before upload, the runner's own OpenSSL encrypts the report and the event log as CMS with AES-256-GCM and RSA-OAEP, and the plain report never leaves the runner. Anyone can download the `security-audit` artifact of a public repository during its 7 days, but only your private key opens it. Without `SECURITY_AUDIT_RECIPIENT_CERT`, the run fails before the audit starts.
- **Spending has four limits.** Cloudflare enforces the gateway's spend limit whatever the runner does: once it is reached, the gateway answers `429`. A rule filtered on `app: security-audit` caps the audit alone. It is eventually consistent, so a run can pass it slightly. Agent steps in `opencode.json` stop the main agent after 300 and each sub-agent after 100. The optional agent budget makes the skill plan within that many agent runs and still finish with a report. The audit step stops after 110 minutes and the job after 120, and whatever report exists by then is still uploaded.

### Repository settings

- Under **Settings > Advanced Security**, leave CodeQL **default setup** off. The Security workflow is an advanced setup, and GitHub rejects its results while default setup is on.
- On the same page, turn on **Dependabot alerts** and **Dependabot security updates**. Alerts list known vulnerabilities in the dependencies. Security updates open pull requests that fix them, without waiting for the weekly schedule.
- Also turn on **Private vulnerability reporting**, so that anyone can report a vulnerability privately. Reports arrive as draft security advisories, where confirmed audit findings go too.
- Under **Settings > Actions > General**, keep the workflow permissions at **Read repository contents and packages permissions**, and keep GitHub Actions from creating or approving pull requests. Each workflow asks for anything more itself.
- On the same page, set approval for fork pull request workflows to **Require approval for all external contributors**. CI and Security then run on a pull request from someone without write access only after you approve it, under the pull request's **Checks** tab.
- Under **Settings > Rules > Rulesets**, a ruleset for `main` requires a pull request, the eleven CI and Security jobs, and no new CodeQL or zizmor alert of high severity or above. It also blocks force pushes and deleting `main`. Where Workers Builds deploys `main`, a failing check therefore also blocks a deploy. When a job is renamed or added, update the ruleset's required checks to match, after the job has run once.

## Project structure

```
src/
  index.ts          Entry point: error boundary, CORS, structured error logging
  router.ts         Matches method and path against the route table
  catalogue.ts      Builds the public endpoint list from the route table
  types.ts          Route and handler types
  routes/           One file per endpoint group; index.ts lists the groups
  lib/              Shared helpers: responses, request echo, auth, streams, limits
public/
  index.html        Web UI
  css/theme.css     Design tokens for the light and dark themes
  css/app.css       Layout and components
  js/               UI as native ES modules (no build step)
  images/           Sample images served by /image/*
  _headers          Security headers for static assets
test/               Vitest tests that run in the Workers runtime
scripts/smoke.mjs   Smoke test against a running server
.github/            CI and security workflows, Dependabot and security audit configuration
AGENTS.md           Conventions for contributors and coding agents
```

### Add an endpoint

Add a route to the matching file in `src/routes/` (or add a new group file and list it in `src/routes/index.ts`):

```ts
{
	methods: ['GET'],
	path: '/hello/:name',
	summary: 'Greet someone',
	example: { path: '/hello/world' },
	handler: ({ params }) => json({ hello: params.name }),
}
```

That single entry registers the route and adds it to `GET /endpoints`, the 404 help and the web UI. Then add it to the table above: `npm test` fails until you do.

### Testing

Tests run with [Vitest inside the Workers runtime](https://developers.cloudflare.com/workers/testing/vitest-integration/), using the real `wrangler.jsonc`.

- `test/routes.test.ts` and `test/service.test.ts` send requests through the Worker's default export, the entry point Cloudflare invokes.
- `test/assets.test.ts` checks the web UI through the static assets binding: security headers, broken references, external links.
- `test/ui.test.ts` covers the UI's pure helpers, such as the shell quoting in the curl generator.
- `test/docs.test.ts` keeps this README in step with the route table.

`npm run smoke` is separate from the suite. With `npm run dev` running, it reads `GET /endpoints`, sends every endpoint's example request over real HTTP and fails on any 5xx, timeout or missing security header. Point `HTTPBIN` at a deployment to check that instead, for example `HTTPBIN=https://httpbin.example.com npm run smoke`.

### Debugging

- `npm run dev`, then open <http://localhost:8787/cdn-cgi/local/explorer>. [Local Explorer](https://developers.cloudflare.com/workers/local-development/local-explorer/) shows the logs and traces of every local request.
- For breakpoints, use the **Launch Wrangler** or **Attach to Wrangler** configuration in `.vscode/launch.json`.
- Unhandled errors are logged as structured JSON (message, stack, method, path, Ray ID) and never returned to the client.
- Source maps are uploaded on deploy, so stack traces in Workers Logs point at the TypeScript source.

## Design notes

- `/response-headers` cannot override `Content-Type` or framing headers, so the JSON body is never rendered as HTML.
- `/redirect-to` is an open redirect by design. If you host this publicly and that concerns you, restrict it with a WAF rule.
- `/status/:code` accepts 200 to 599. A Worker cannot send a 1xx as its final response.
- Every Worker response carries permissive CORS headers. The service holds no credentials or user data.
- A link such as `/#GET:/status/418` fills in the request form in the web UI. It never sends anything by itself, and the fragment is not transmitted to the server.

## Disclaimer

This is a personal project for educational and informational purposes only. It is not an official Cloudflare product, and its content does not represent official Cloudflare guidance or the views of the author's employer. It is not affiliated with, or endorsed by, the original httpbin project.

The software and any hosted instance of it are provided "as is", without warranty of any kind, express or implied, including fitness for a particular purpose, availability, accuracy or security. They may be incomplete, outdated, or unsuitable for your environment, plan, or compliance requirements. Endpoints may change or disappear without notice. Always validate behaviour against the official [Cloudflare documentation](https://developers.cloudflare.com/) before relying on it.

This is a testing tool. Do not send passwords, API keys, tokens, personal data, or any other sensitive information to it. Requests and responses, including headers, bodies and IP addresses, may be logged. Several endpoints are intentionally permissive (open CORS, arbitrary redirects, reflected headers) and are not a model for production services.

The author and contributors are not responsible or liable for any damage, outage, security incident, data loss, cost, or other consequence arising from the use of, or reliance on, this repository, its code, or any deployment of it. You use it, and deploy it to your own account, at your own risk.

Cloudflare and related marks are trademarks of Cloudflare, Inc. All other trademarks belong to their respective owners.

## License

[MIT](LICENSE). Inspired by [httpbin.org](https://httpbin.org).

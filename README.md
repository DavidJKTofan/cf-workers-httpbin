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

- **Request headers.** `/headers` and the `headers` field of every echo include what Cloudflare adds, such as `CF-Connecting-IP`, `CF-IPCountry`, `CF-Ray`, `CF-Visitor`, `CDN-Loop`, `X-Forwarded-For` and `X-Forwarded-Proto`. Cloudflare also sets `Accept-Encoding` to `br, gzip` whatever the client sent. Unlike httpbin.org, which hides proxy headers until you add `?show_env=1`, this service shows them by default. Add `?show_env=0` to any echo endpoint to see only what the client sent. See [Cloudflare HTTP headers](https://developers.cloudflare.com/fundamentals/reference/http-headers/).
- **Response headers.** Cloudflare adds `CF-Ray` and removes a few headers before the client sees them, including `Alt-Svc`, `Cache-Tag` and the `X-Accel-*` family, so setting those through `/response-headers` has no visible effect.
- **Cookies.** Cloudflare features enabled on the zone can set their own cookies, for example `__cf_bm` or `cf_clearance`. A client with a cookie jar sends them back, so they appear in `/cookies` unless you add `?show_env=0`. See [Cloudflare cookies](https://developers.cloudflare.com/fundamentals/reference/policies-compliances/cloudflare-cookies/).
- **URLs.** Cloudflare normalizes URLs before the Worker sees them. Repeated slashes are always merged; depending on zone settings, dot segments and percent-encoding are normalized too. `/anything` can therefore echo a slightly different path from the one you sent. See [URL normalization](https://developers.cloudflare.com/rules/normalization/).
- **Errors.** The service answers its own errors in JSON. Errors generated by Cloudflare itself (1xxx codes and its own 5xx) are HTML unless the client asks for `application/json` or `text/markdown` in `Accept`. See [Error responses](https://developers.cloudflare.com/fundamentals/reference/error-responses/).
- **`/cdn-cgi/trace`.** On a deployed Worker this path is answered by Cloudflare, not by this code, and reports the data center, HTTP version and TLS version of the connection. Locally and in tests the Worker returns the same `key=value` format from what the runtime knows, marked with `X-Trace-Source: worker-fallback`. `/robots.txt` disallows `/cdn-cgi/`, as Cloudflare recommends. See [The /cdn-cgi/ endpoint](https://developers.cloudflare.com/fundamentals/reference/cdn-cgi-endpoint/).
- **Content Security Policy.** [`public/_headers`](public/_headers) gives the web UI a strict policy that only allows same-origin scripts and styles. If you enable a Cloudflare feature that injects scripts into pages, such as Web Analytics or Rocket Loader, extend the policy as described in [Content Security Policies](https://developers.cloudflare.com/fundamentals/reference/policies-compliances/content-security-policies/).

## Scripts

| Command              | What it does                                                   |
| -------------------- | -------------------------------------------------------------- |
| `npm run dev`        | Run the Worker and static assets locally with Wrangler         |
| `npm test`           | Run the test suite inside the Workers runtime                  |
| `npm run typecheck`  | Type-check the Worker and the tests                            |
| `npm run cf-typegen` | Regenerate `worker-configuration.d.ts` after changing bindings |
| `npm run check`      | Verify generated types, type-check and test in one go          |
| `npm run deploy`     | Deploy with Wrangler                                           |

## Deploy

Use the button above, or deploy from a clone:

```bash
npx wrangler login
npm run deploy
```

With no routes configured, the Worker is served from its `workers.dev` subdomain. To use your own hostname, add a custom domain on a zone in the same account, either in the dashboard or in `wrangler.jsonc`:

```jsonc
"routes": [{ "pattern": "httpbin.example.com", "custom_domain": true }]
```

Defining routes turns the `workers.dev` URL off unless `workers_dev` is set to `true`. Without routes in the file, Wrangler leaves domains you added in the dashboard alone and keeps `workers.dev` on.

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

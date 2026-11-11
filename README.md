# HttpBin on Cloudflare Workers

A comprehensive HTTP Request & Response testing service built on Cloudflare Workers with TypeScript and Workers Static Assets.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/cf-vnkr/cf-workers-httpbin)

## Features

### ✅ Implemented Endpoints

**HTTP Methods**

- `GET /get` - Returns GET request data
- `POST /post` - Returns POST request data
- `PUT /put` - Returns PUT request data
- `DELETE /delete` - Returns DELETE request data
- `PATCH /patch` - Returns PATCH request data
- `ANY /anything` - Accepts any HTTP method

**Status Codes**

- `GET /status/{code}` - Returns specified HTTP status code (100-599)

**Request Inspection**

- `GET /headers` - Returns request headers
- `GET /ip` - Returns origin IP address
- `GET /user-agent` - Returns user agent string

**Response Formats**

- `GET /json` - Returns sample JSON data
- `GET /html` - Returns HTML document
- `GET /xml` - Returns XML data
- `GET /robots.txt` - Returns robots.txt file

**Authentication**

- `GET /basic-auth/{user}/{pass}` - Basic authentication challenge
- `GET /bearer` - Bearer token authentication

**Cookies**

- `GET /cookies` - Returns all cookies
- `GET /cookies/set?name=value` - Sets cookies via query params
- `GET /cookies/delete?name` - Deletes cookies

**Redirects**

- `GET /redirect/{n}` - 302 redirect n times
- `GET /absolute-redirect/1` - Absolute URL redirect
- `GET /relative-redirect/1` - Relative path redirect

**Dynamic Data**

- `GET /uuid` - Returns a UUID v4
- `GET /base64/encode?text={text}` - Encodes text to base64
- `GET /base64/decode?data={data}` - Decodes base64 to text
- `GET /delay/{n}` - Delayed response (max 10 seconds)

**Images**

- `GET /image/png` - Returns PNG image (SVG placeholder)
- `GET /image/jpeg` - Returns JPEG image (SVG placeholder)
- `GET /image/svg` - Returns SVG image
- `GET /image/webp` - Returns WebP image (SVG placeholder)

**Response Inspection**

- `GET /response-headers?key=value` - Returns custom response headers
- `GET /cache` - Returns 304 if If-Modified-Since or If-None-Match headers present

**Other**

- `GET /bytes/{n}` - Returns n random bytes (max 100KB)
- `GET /stream/{n}` - Streams n JSON responses
- `GET|POST /forms/post` - HTML form submission test

## Project Structure

```
httpbin-worker/
├── src/
│   └── worker.ts          # Main Worker code
├── public/
│   └── index.html         # Frontend UI
├── wrangler.toml          # Cloudflare Workers config
├── package.json           # Dependencies
├── tsconfig.json          # TypeScript config
└── README.md             # This file
```

## Setup Instructions

### Prerequisites

- Node.js 18+ installed
- Cloudflare account (free tier works)
- Wrangler CLI

### Installation

1. **Install dependencies:**

```bash
npm install
```

2. **Login to Cloudflare:**

```bash
npx wrangler login
```

3. **Run locally:**

```bash
npm run dev
```

Visit `http://localhost:8787` to see your HttpBin instance!

### Deployment

1. **Deploy to Cloudflare Workers:**

```bash
npm run deploy
```

2. Your service will be available at:
   - `https://httpbin-worker.YOUR-SUBDOMAIN.workers.dev`

## Usage Examples

### Using the Web Interface

Navigate to your deployed URL and use the interactive tester to make requests.

### Using cURL

```bash
# GET request
curl https://your-worker.workers.dev/get

# POST with JSON
curl -X POST https://your-worker.workers.dev/post \
  -H "Content-Type: application/json" \
  -d '{"key": "value"}'

# Basic auth
curl -u user:pass https://your-worker.workers.dev/basic-auth/user/pass

# Custom status code
curl https://your-worker.workers.dev/status/418

# Get UUID
curl https://your-worker.workers.dev/uuid

# Delayed response
curl https://your-worker.workers.dev/delay/3
```

### Using JavaScript/Fetch

```javascript
// GET request
const response = await fetch('https://your-worker.workers.dev/get');
const data = await response.json();
console.log(data);

// POST with JSON
const response = await fetch('https://your-worker.workers.dev/post', {
	method: 'POST',
	headers: { 'Content-Type': 'application/json' },
	body: JSON.stringify({ test: 'data' }),
});

// Bearer auth
const response = await fetch('https://your-worker.workers.dev/bearer', {
	headers: { Authorization: 'Bearer mytoken123' },
});
```

## Features

- ✅ Full CORS support
- ✅ All major HTTP methods
- ✅ Request/response inspection
- ✅ Multiple response formats (JSON, HTML, XML)
- ✅ Authentication testing (Basic, Bearer)
- ✅ Cookie management
- ✅ Redirect testing
- ✅ Status code testing
- ✅ Dynamic data generation
- ✅ Image responses
- ✅ Streaming responses
- ✅ Modern, responsive UI
- ✅ Interactive API tester

## API Response Format

All JSON endpoints return data in the following format:

```json
{
	"method": "GET",
	"url": "https://...",
	"headers": {
		"user-agent": "...",
		"...": "..."
	},
	"origin": "123.45.67.89",
	"args": {
		"param": "value"
	},
	"data": null
}
```

## Development

### Local Development

```bash
npm run dev
```

The worker will reload automatically when you save changes to `src/worker.ts`.

To modify the frontend, edit `public/index.html`.

### Testing Endpoints

Use the built-in API tester in the web interface or test with tools like:

- cURL
- Postman
- HTTPie
- Browser DevTools

## Contributing

Feel free to add more endpoints or enhance existing functionality!

## License

MIT License - feel free to use this for your projects!

## Credits

Inspired by [httpbin.org](https://httpbin.org).

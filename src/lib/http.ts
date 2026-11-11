/** An error that maps directly to an HTTP response. Throw it from any handler. */
export class HttpError extends Error {
	constructor(
		readonly status: number,
		message: string,
		readonly headers?: Record<string, string>,
		readonly details?: Record<string, unknown>,
	) {
		super(message);
		this.name = 'HttpError';
	}
}

type Init = number | ResponseInit;

function toInit(init: Init | undefined): ResponseInit {
	return typeof init === 'number' ? { status: init } : (init ?? {});
}

function respond(body: BodyInit | null, contentType: string, init?: Init): Response {
	const { headers, ...rest } = toInit(init);
	const merged = new Headers(headers);
	merged.set('Content-Type', contentType);
	return new Response(body, { ...rest, headers: merged });
}

/** Pretty-printed JSON, like the original httpbin. */
export function json(data: unknown, init?: Init): Response {
	return respond(JSON.stringify(data, null, 2) + '\n', 'application/json; charset=utf-8', init);
}

export function text(body: string, init?: Init): Response {
	return respond(body, 'text/plain; charset=utf-8', init);
}

export function html(body: string, init?: Init): Response {
	return respond(body, 'text/html; charset=utf-8', init);
}

export function redirect(location: string, status = 302): Response {
	return new Response(null, { status, headers: { Location: location } });
}

export function errorResponse(error: HttpError): Response {
	return json({ error: error.message, status: error.status, ...error.details }, { status: error.status, headers: error.headers });
}

/** Statuses that must not carry a body. Constructing a Response with one throws. */
export function isNullBodyStatus(status: number): boolean {
	return status === 204 || status === 205 || status === 304;
}

export const STATUS_TEXT: Readonly<Record<number, string>> = {
	200: 'OK',
	201: 'Created',
	202: 'Accepted',
	203: 'Non-Authoritative Information',
	204: 'No Content',
	205: 'Reset Content',
	206: 'Partial Content',
	300: 'Multiple Choices',
	301: 'Moved Permanently',
	302: 'Found',
	303: 'See Other',
	304: 'Not Modified',
	307: 'Temporary Redirect',
	308: 'Permanent Redirect',
	400: 'Bad Request',
	401: 'Unauthorized',
	402: 'Payment Required',
	403: 'Forbidden',
	404: 'Not Found',
	405: 'Method Not Allowed',
	406: 'Not Acceptable',
	408: 'Request Timeout',
	409: 'Conflict',
	410: 'Gone',
	411: 'Length Required',
	412: 'Precondition Failed',
	413: 'Content Too Large',
	414: 'URI Too Long',
	415: 'Unsupported Media Type',
	416: 'Range Not Satisfiable',
	418: "I'm a teapot",
	421: 'Misdirected Request',
	422: 'Unprocessable Content',
	425: 'Too Early',
	426: 'Upgrade Required',
	428: 'Precondition Required',
	429: 'Too Many Requests',
	431: 'Request Header Fields Too Large',
	451: 'Unavailable For Legal Reasons',
	500: 'Internal Server Error',
	501: 'Not Implemented',
	502: 'Bad Gateway',
	503: 'Service Unavailable',
	504: 'Gateway Timeout',
	505: 'HTTP Version Not Supported',
};

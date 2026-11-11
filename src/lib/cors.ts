const ALLOWED_METHODS = 'GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS';

/** Answer a CORS preflight. The service is public and holds no credentials, so every origin is allowed. */
export function preflight(request: Request): Response {
	return new Response(null, {
		status: 204,
		headers: {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': ALLOWED_METHODS,
			'Access-Control-Allow-Headers': request.headers.get('Access-Control-Request-Headers') ?? '*',
			'Access-Control-Max-Age': '86400',
		},
	});
}

/**
 * Headers every Worker-generated response carries. Mutates in place instead of re-wrapping
 * the Response, which would drop options such as `encodeBody: 'manual'`.
 */
export function applyCommonHeaders(response: Response): Response {
	const { headers } = response;
	headers.set('Access-Control-Allow-Origin', '*');
	headers.set('Access-Control-Expose-Headers', '*');
	headers.set('X-Content-Type-Options', 'nosniff');
	return response;
}

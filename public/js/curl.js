/** Quote a value for a POSIX shell. */
function quote(value) {
	return `'${value.replaceAll("'", `'\\''`)}'`;
}

/**
 * Build the curl command equivalent to a request.
 *
 * @param {{ method: string, url: string, headers: [string, string][], body: string | null }} request
 */
export function toCurl({ method, url, headers, body }) {
	const parts = ['curl'];
	if (method === 'HEAD') parts.push('-I');
	else if (method !== 'GET') parts.push('-X', method);
	parts.push(quote(url));

	const lines = [parts.join(' ')];
	for (const [name, value] of headers) {
		lines.push(`-H ${quote(`${name}: ${value}`)}`);
	}
	if (body !== null) {
		lines.push(`--data-raw ${quote(body)}`);
	}
	return lines.join(' \\\n  ');
}

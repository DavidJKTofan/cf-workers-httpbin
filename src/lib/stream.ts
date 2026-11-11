/**
 * A pull-based stream that emits `count` chunks, waiting `intervalMs` between them.
 *
 * Work happens only when the runtime asks for the next chunk, so there is no background
 * promise to keep alive: the Worker stays active for as long as the body is being read
 * and stops producing as soon as the client disconnects.
 */
export function timedStream(count: number, intervalMs: number, chunk: (index: number) => Uint8Array): ReadableStream<Uint8Array> {
	let index = 0;
	return new ReadableStream<Uint8Array>({
		async pull(controller) {
			if (index >= count) {
				controller.close();
				return;
			}
			if (index > 0 && intervalMs > 0) {
				await scheduler.wait(intervalMs);
			}
			controller.enqueue(chunk(index));
			index += 1;
		},
	});
}

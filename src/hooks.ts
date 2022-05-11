import type { Handle } from '@sveltejs/kit';

/** @type {import('@sveltejs/kit').Handle}
 * https://kit.svelte.dev/docs/hooks#handle
 */
export const handle: Handle = async ({ event, resolve }) => {
	const response = await resolve(event, {
		ssr: false
	});

	return response;
};

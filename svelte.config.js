// import adapter from '@sveltejs/adapter-netlify';
import adapter from '@sveltejs/adapter-static';
import preprocess from 'svelte-preprocess';
import { resolve } from 'path';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://github.com/sveltejs/svelte-preprocess
	// for more information about preprocessors
	preprocess: [
		preprocess({
			scss: {
				prependData: '@use "src/variables.scss" as *;'
			}
		})
	],

	// NOTE SSR is currently disabled in hooks.ts via handle.
	// REFERENCE https://kit.svelte.dev/docs/hooks#handle
	compilerOptions: {
		// generate: 'dom' //
	},

	kit: {
		adapter: adapter({
			// We don't need any of netlify's edge functions, etc.
			//
			// We need netlify (or something beyond github pages) because it allows us to send
			// the response headers required by SharedArrayBuffer.
			// edge: false,
			// split: false
		}),
		prerender: {
			default: true
		},

		vite: {
			resolve: {
				alias: {
					$components: resolve('./src/components'),
					$containers: resolve('./src/containers')
				}
			},

			css: {
				preprocessorOptions: {
					scss: {
						additionalData: '@use "src/variables.scss" as *;'
					}
				}
			},

			build: {
				assetsInlineLimit: 0,
				// ssr: false,
				commonjsOptions: {
					// exclude: ['./src/lib/pywasm/*.emcc.js']
				}
			},

			optimizeDeps: {
				// exclude: ['./src/lib/pywasm/*.emcc.js']
				// disabled: true
			},

			server: {
				headers: {
					// Needed to allow SharedArrayBuffer to squeak through on some browsers....
					// REFERENCE https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer#security_requirements
					'Cross-Origin-Opener-Policy': 'same-origin',
					'Cross-Origin-Embedder-Policy': 'require-corp'
				}
			}
		}
	}
};

export default config;

<script lang="ts">
	import { onMount } from 'svelte';
	import createPythonModule from '$lib/pywasm/python.emcc';
	import type { PythonModule } from '$lib/pywasm/python.emcc.d';
	import pythonMainUrl from '$lib/pywasm/python.emcc.js?url';
	import pythonWorkerUrl from '$lib/pywasm/python.worker.emcc.umd?url';
	import pythonWasmUrl from '$lib/pywasm/python.wasm?url';
	import pythonDataUrl from '$lib/pywasm/python.data?url';

	let mod: PythonModule;
	let s = 'aa';
	let err = 'aa';

	let v: number[] = [];

	let config = {
		locateFile: (p: string) => {
			return (
				{
					'python.wasm': pythonWasmUrl,
					'python.data': pythonDataUrl,
					'python.worker.emcc.umd': pythonWorkerUrl,
					'python.emcc.js': pythonMainUrl
				}[p] || p
			);
		},
		print: console.log,
		printErr: console.error,
		// stdin: () => {
		// 	if (v.length == 0) {
		// 		let out = prompt('What should they do?');

		// 		if (out == null) {
		// 			console.log('exiting');
		// 			// out = 'exit()';
		// 			mod.exit(0, true);
		// 			return undefined;
		// 		}
		// 		v = out
		// 			.split('')
		// 			.reverse()
		// 			.map((c) => c.charCodeAt(0));
		// 	}
		// 	console.log(v);
		// 	return v.pop();
		// },
		stdout: (c: number) => {
			// s = s.concat(String.fromCharCode(c));
			s = s + String.fromCharCode(c);
			console.log('stdout', s, c);
		},
		stderr: (c: number) => {
			// err = err.concat(String.fromCharCode(c));
			err = err + String.fromCharCode(c);
			console.log('stderr', err, c);
		}
	};
	onMount(async () => {
		mod = await createPythonModule(config);
		console.log(mod);
		// handleChange();

		return () => {
			mod.exit(0, true);
		};
	});

	// function handleChange(): void {
	// 	sum = mod.add(a, b);
	// }
</script>

<div class="box">
	<div class="content">
		<h2>Python module 🐍</h2>

		{#if mod}
			<button class="button" on:click={() => mod.callMain(['-i', '-'])}>Start input</button>
		{/if}
		<code>
			<pre>{s}</pre>
		</code>
		<code>
			<pre>{err}</pre>
		</code>
		{#if err.length}
			<p>We've got some stderr!</p>
		{/if}
	</div>
</div>

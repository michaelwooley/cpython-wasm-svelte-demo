<script lang="ts">
	import { onMount } from 'svelte';
	// import createAddModule from '$lib/wasm/add.emcc';
	import type { AddModule } from '$lib/wasm/add.emcc.d';
	// import workerUrl from '$lib/wasm/add.emcc.worker.js?url';
	import workerUrl from '$lib/wasm/add.emcc.worker?url';
	import wasmUrl from '$lib/wasm/add.emcc.wasm?url';
	import addMainUrl from '$lib/wasm/add.emcc.js?url';

	let a = 4;
	let b = 5;
	let sum: number;

	let mod: AddModule;
	onMount(async () => {
		console.log(workerUrl);
		const MyWorker = await (await import('$lib/wasm/add.emcc.worker?worker')).default;

		console.log(MyWorker);

		let Mod = {
			// mainScriptUrlOrBlob: addMainUrl,
			locateFile: (s: string): string => {
				return (
					{
						'add.emcc.worker.js': workerUrl, //MyWorker,
						'add.emcc.wasm': wasmUrl
					}[s] || s
				);
			}
			// onRuntimeInitialized: function () {
			// 	// Just Module._add() will work, but I'm just demontrating usage of cwrap
			// 	Module['add'] = cwrap('add', 'number', ['number', 'number']);
			// }
		};
		const createAddModule = await (await import('$lib/wasm/add.emcc')).default;
		mod = await createAddModule(Mod);

		console.log(mod);
		handleChange();
	});

	function handleChange(): void {
		sum = mod.add(a, b);
	}
</script>

<div class="box">
	<div class="content">
		<h2>Change the inputs to recompute with add!</h2>
	</div>
	<div class="columns">
		<div class="column">
			<input type="number" class="input is-large" bind:value={a} on:keyup={handleChange} />
		</div>
		<div class="column is-narrow is-size-4 has-font-weight-bold">+</div>
		<div class="column">
			<input type="number" class="input is-large" bind:value={b} on:keyup={handleChange} />
		</div>
		<div class="column is-narrow is-size-4 has-font-weight-bold">=</div>
		<div class="column">
			<input type="text" disabled class="input is-large" bind:value={sum} />
		</div>
	</div>
</div>

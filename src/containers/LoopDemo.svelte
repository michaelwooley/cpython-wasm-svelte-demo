<script lang="ts">
	import createLoopModule from '$lib/loop/loop.emcc';
	import { onMount } from 'svelte';

	let nClicks = 0;
	let mod: any;
	let printArr: string[] = [];
	onMount(async () => {
		var Module = {
			noExitRuntime: false,
			preRun: [],
			postRun: [],
			print: (function () {
				return function (text: string): void {
					if (arguments.length > 1) text = Array.prototype.slice.call(arguments).join(' ');
					printArr = printArr.concat([text]);
					console.log(text);
				};
			})()
		};
		// Module.setStatus('Downloading...');
		mod = await createLoopModule(Module);

		console.log(mod);
	});
</script>

<!-- Svelte-level tracking of clicks -->
<svelte:window
	on:click|preventDefault={() => {
		nClicks += 1;
	}}
/>

<div class="p-4">
	<div class="content">
		<h2>Click to see how events are handled!awfa</h2>
	</div>

	<div class="columns">
		<div class="column">
			<div class="box">
				<div class="content">
					<h3>WASM Output:</h3>
				</div>
				{#each printArr as el}
					<div><code>{el}</code></div>
				{/each}
			</div>
		</div>

		<div class="column">
			<div class="box">
				Total clicks frontend: {nClicks}
			</div>
			<!-- <input type="number" class="input is-large" bind:value={b} on:keyup={handleChange} /> -->
		</div>
	</div>
</div>

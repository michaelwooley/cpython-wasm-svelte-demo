<script lang="ts">
	import { onMount } from 'svelte';

	let nClicks = 0;
	let mod: any;
	let printArr: string[] = [];
	let handleClick: () => void;
	onMount(async () => {
		const LoopWorker = (await import('$lib/loop/loop.worker?worker')).default;

		const lw = new LoopWorker();
		lw.onmessage = (e) => {
			// console.log('Component received message', self.performance.now(), e.data);
			if (e.data.kind === 'print') {
				printArr = printArr.concat([e.data.text]);
			}
		};
		handleClick = handleClickFactory(lw);
	});

	const handleClickFactory = (w: Worker) => () => {
		w.postMessage({ kind: 'click', count: nClicks });
	};
</script>

<!-- https://github.com/kripken/ammo.js -->
<!-- Svelte-level tracking of clicks -->
<svelte:window
	on:click|preventDefault={() => {
		nClicks += 1;
		handleClick();
	}}
/>

<div class="p-4">
	<div class="content">
		<h1>Loop worker demo.</h1>
		<h2>Click to see how events are handled!</h2>

		<ul>
			<li>Requires Chrome!</li>
			<li>DOM event handlers don't work w/ workers (duh!)</li>
		</ul>
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

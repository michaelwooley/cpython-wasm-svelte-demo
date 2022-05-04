<script lang="ts">
	import { onMount } from 'svelte';
	import createAddModule from '$lib/wasm/add.emcc';
	import type { AddModule } from '$lib/wasm/add.emcc.d';

	let a = 4;
	let b = 5;
	let sum: number;

	let mod: AddModule;
	onMount(async () => {
		mod = await createAddModule();
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

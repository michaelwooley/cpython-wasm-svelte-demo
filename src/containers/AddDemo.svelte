<script lang="ts">
	import { onMount } from 'svelte';
	import type { AddModule } from '$lib/wasm/add';
	import createAddModule from '$lib/wasm/add.emcc';

	let mod: AddModule;
	onMount(async () => {
		mod = await createAddModule();

		console.log(mod);

		console.log(mod._add(1, 2));
		console.log(mod.add(1, 2));
	});
</script>

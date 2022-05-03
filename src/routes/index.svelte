<script lang="ts" context="module">
	export const prerender = false;
</script>

<script lang="ts">
	import { onMount } from 'svelte';

	onMount(() => {
		if (!SharedArrayBuffer) {
			alert('No shared array buffer??');
		}
	});
</script>

<h1>Welcome to SvelteKit</h1>
<p>Visit <a href="https://kit.svelte.dev">kit.svelte.dev</a> to read the documentation</p>

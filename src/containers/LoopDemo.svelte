<script lang="ts">
	import createLoopModule from '$lib/loop/loop.emcc';
	import { onMount } from 'svelte';

	let progressElement: HTMLProgressElement;
	let spinnerElement: HTMLDivElement;
	let statusElement: HTMLDivElement;
	let mod: any;
	onMount(async () => {
		var Module = {
			preRun: [],
			postRun: [],
			print: (function () {
				return function (text) {
					if (arguments.length > 1) text = Array.prototype.slice.call(arguments).join(' ');

					console.log(text);
				};
			})(),

			setStatus: function (text) {
				if (!Module.setStatus.last) Module.setStatus.last = { time: Date.now(), text: '' };
				if (text === Module.setStatus.last.text) return;
				var m = text.match(/([^(]+)\((\d+(\.\d+)?)\/(\d+)\)/);
				var now = Date.now();
				if (m && now - Module.setStatus.last.time < 30) return; // if this is a progress update, skip it if too soon
				Module.setStatus.last.time = now;
				Module.setStatus.last.text = text;
				if (m) {
					console.log(m);
					text = m[1];
					progressElement.value = parseInt(m[2]) * 100;
					progressElement.max = parseInt(m[4]) * 100;
					progressElement.hidden = false;
					spinnerElement.hidden = false;
				} else {
					// progressElement.hidden = true;
					// progressElement.value = null;
					// progressElement.max = null;
					// if (!text) spinnerElement.style.display = 'none';
				}
				statusElement.innerHTML = text;
			},
			totalDependencies: 0,
			monitorRunDependencies: function (left) {
				this.totalDependencies = Math.max(this.totalDependencies, left);
				Module.setStatus(
					left
						? 'Preparing... (' +
								(this.totalDependencies - left) +
								'/' +
								this.totalDependencies +
								')'
						: 'All downloads complete.'
				);
			}
		};
		Module.setStatus('Downloading...');
		mod = await createLoopModule(Module);

		console.log(mod);
	});
</script>

<div class="box">
	<div class="content">
		<h2>Change the inputs to recompute with add!</h2>
		<progress
			class="progress"
			value="0"
			max="100"
			id="progress"
			hidden
			bind:this={progressElement}
		/>
		<div class="spinner" id="spinner" bind:this={spinnerElement} />
		<div class="emscripten" id="status" bind:this={statusElement}>Downloading...</div>
	</div>
</div>

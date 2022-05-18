/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />
/// <reference types="emscripten" />
//loop worker

import createLoopModule from './loop.emcc';

let Module: Partial<EmscriptenModule> = {
	noExitRuntime: false,
	preRun: [],
	postRun: [],
	print: function (text: string): void {
		// console.log('In worker: ', text);
		self.postMessage({ kind: 'print', text });
	}
};

createLoopModule(Module).then((m) => {
	console.log('Module ready!');
	Module = m;
});

self.onmessage = (e) => {
	console.log('Worker received message', self.performance.now(), e.data);
};

/// <reference types="emscripten" />
/** Above will import declarations from @types/emscripten, including Module etc. */
/** It is not .ts file but declaring reference will pass TypeScript Check. */

import createPythonModule from './python.emcc';
import type { PythonModule } from './python.emcc.d';

export const init = async ({
	stdin,
	stdout,
	stderr,
	readyCallback
}: {
	stdin: () => number;
	stdout: (c: number) => void;
	stderr: (c: number) => void;
	readyCallback?: (mod: PythonModule) => void;
}): Promise<{
	mod: PythonModule;
	setSignal: (signal: number) => void;
	setInterrupt: () => void;
	main: (args: string[]) => number;
}> => {
	// eslint-disable-next-line prefer-const
	let Module =
		// Pick< PythonModule, | 'onRuntimeInitialized' // | '_Py_EMSCRIPTEN_SIGNAL_HANDLING' // | 'cwrap' // | 'HEAP8' | 'stdin' | 'stderr' | 'stdout' > =
		{
			onRuntimeInitialized: () => {
				// const cwrap = Module.cwrap;
				Module['HEAP8'][Module['_Py_EMSCRIPTEN_SIGNAL_HANDLING']] = 1;
				Module['main'] = cwrap('main', 'number', ['number', 'string']);

				if (readyCallback) {
					readyCallback(Module);
				}
			},
			stdin, //: () => 3,
			stdout, //: (c: number) => null,
			stderr //: (c: number) => null
		} as unknown as PythonModule; // YUK

	const mod = await createPythonModule(Module);

	// Alas, we actually need to pass the shared buffer back to the main thread!
	const setSignal = setPythonSignalFactory(mod);
	const setInterrupt = () => setSignal(2);

	return {
		mod,
		setSignal,
		setInterrupt,
		main: (args: string[]) => mod.main(args.length + 1, args.join(' '))
	};
};

/**
 * Factory for setting python signal/interrupt
 * https://github.com/hoodmane/pyodide/blob/318003078741360ac8fd5d4ea94823eb3b65ef93/src/js/api.ts#L404
 * @param mod
 * @returns
 */
const setPythonSignalFactory = (mod: PythonModule) => {
	// NOPE! Need to pass signalling mechanism all of the way back to the main client script.
	// The main "run" loop is going to be blocked by python whenever we want to send this signal through.
	const sb = new Uint8Array(new SharedArrayBuffer(1));
	return (signal: number): void => {
		sb[0] = signal;
		mod.HEAP8[mod._Py_EMSCRIPTEN_SIGNAL_HANDLING] = 1 * (!!sb as unknown as number);
		mod.Py_EmscriptenSignalBuffer = sb;
	};
};

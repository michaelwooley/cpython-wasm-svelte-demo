/// <reference types="emscripten" />
/** Above will import declarations from @types/emscripten, including Module etc. */

// This will merge to the existing EmscriptenModule interface from @types/emscripten
// If this doesn't work, try globalThis.EmscriptenModule instead.
export interface PythonModule extends EmscriptenModule {
	// // Module.cwrap() will be available by doing this.
	// // Requires -s "EXTRA_EXPORTED_RUNTIME_METHODS=['cwrap']"
	// cwrap: typeof cwrap;
	// // Requires "EXPORTED_FUNCTIONS=['_main']"
	// // Pretty sure this signature is correct:
	// // int main(int argc, char **argv)
	// _main(argc: number, char: string): number;
	// // or using cwrap. See below
	// main(argc: number, char: string): number;

	callMain: (args?: string[]) => void;
	exit: (status: number, implicit: boolean) => void;

	// stdin: () => number | null | undefined;
	stdout: (c: number) => void;
	stderr: (c: number) => void;

	// Signal/interrupt buffers
	// REFERENCE https://github.com/michaelwooley/cpython/blob/087d0fa5b97796560c0d8ceab4f0360fd54baf4f/Python/emscripten_signal.c#L1-L7
	Py_EmscriptenSignalBuffer: Uint8Array; //SharedArrayBuffer;
	_Py_EMSCRIPTEN_SIGNAL_HANDLING: number;
}

// TODO What does this error mea?
export default async function createPythonModule(
	mod?: Partial<PythonModule>
): Promise<PythonModule>;

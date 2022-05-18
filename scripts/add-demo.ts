import { $, cd, chalk, path, glob } from 'zx';
import { baseDir, formatDir, logWithEmoji } from './script.utils.js';

const libs = {
	loop: [
		'emcc',
		'loop.c',
		'-o',
		'loop.emcc.js',
		'-sMODULARIZE=1',
		'-sEXPORT_ES6=1',
		'-sEXPORT_NAME=createLoopModule',
		'-sENVIRONMENT=web,worker'
		// '-pthread',
		// '-sPTHREAD_POOL_SIZE_STRICT=20'
		// '-D DEV=1' // Macro flag
	],
	add: [
		// TODO Revert back to old...
		'emcc',
		'add.c',
		'-o',
		'add.emcc.js',
		'-pthread',
		'-sPTHREAD_POOL_SIZE=2',
		'-sPROXY_TO_PTHREAD',
		'-sMODULARIZE=1',
		'-sEXPORT_ES6=1',
		'-sEXPORT_NAME="create_add_module"',
		'-sENVIRONMENT=web,worker',
		'--post-js',
		'add.post.emcc.js'
	]
};

const compileLib = async (name: string, cmd: string[]): Promise<void> => {
	logWithEmoji(chalk.blue(`Compiling "${name}" wasm example.`), '🏗️');

	const addPath = glob.globbySync(`./**/${name}.c`);
	if (addPath.length === 0) {
		throw new Error(`Could not find ${name}.c!?`);
	}
	const wasmDirRelative = path.dirname(addPath[0]);
	const wasmDir = wasmDirRelative; //path.resolve(baseDir, wasmDirRelative);

	logWithEmoji(`Found "${name}.c" in "${wasmDirRelative}"`, '📁');
	cd(wasmDir);

	// Building the module
	const cmdStr = cmd.slice(1).join(' ') + ';';

	const tic = performance.now();
	await $`emcc ${cmd.slice(1)}`;
	const compileTime = (performance.now() - tic) / 1000;

	cd(baseDir);

	logWithEmoji(chalk.magenta(`Completed compilation in ${compileTime.toPrecision(3)}s.`), '⏲');

	await formatDir(wasmDir);
};

void (async function () {
	for (const [name, cmd] of Object.entries(libs)) {
		await compileLib(name, cmd);
	}

	logWithEmoji(chalk.green('Compilation complete.'), '🏁');
})();

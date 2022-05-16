import { $, cd, chalk, path, glob } from 'zx';
import { baseDir, formatDir, logWithEmoji } from './script.utils.js';

void (async function () {
	logWithEmoji(chalk.blue('Compiling "add" wasm example.'), '🏗️');

	const addPath = glob.globbySync('./**/add.c');
	if (addPath.length === 0) {
		throw new Error('Could not find add.c!?');
	}
	const wasmDirRelative = path.dirname(addPath[0]);
	const wasmDir = wasmDirRelative; //path.resolve(baseDir, wasmDirRelative);

	logWithEmoji(`Found "add.c" in "${wasmDirRelative}"`, '📁');
	cd(wasmDir);

	// Building the module
	const tic = performance.now();
	await $`emcc add.c -o add.emcc.js \
    -s EXPORTED_FUNCTIONS="['_main','_add']" \
    -pthread \
    -sPTHREAD_POOL_SIZE=1 \
    -sPROXY_TO_PTHREAD \
    -s MODULARIZE=1 \
    -s EXPORT_ES6=1 \
    -s EXPORT_NAME=createAddModule \
	-sENVIRONMENT=web,worker \
    --pre-js add.post.emcc.js \
	--post-js add.post.emcc.js`;
	const compileTime = (performance.now() - tic) / 1000;

	cd(baseDir);

	logWithEmoji(chalk.magenta(`Completed compilation in ${compileTime.toPrecision(3)}s.`), '⏲️');

	await formatDir(wasmDir);
	logWithEmoji(chalk.green('Compilation complete.'), '🏁');
})();

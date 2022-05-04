import { $, quiet, cd, chalk, path } from 'zx';

const baseDir = path.resolve('.');

const formatDir = async (dir: string): Promise<void> => {
	await quiet(
		$`npx prettier --ignore-path .gitignore --write --plugin-search-dir=${baseDir} ${dir}`
	);
};

void (async function () {
	console.log(chalk.blue('🏗️ Compiling "add" wasm example.'));
	const wasmDir = path.resolve(baseDir, './src/lib/wasm');

	cd(wasmDir);

	// Building the module
	await $`emcc add.c -o add.emcc.js \
    -s EXPORTED_FUNCTIONS="['_add']" \
    -s MODULARIZE=1 \
    -s EXPORT_ES6=1 \
    -s EXPORT_NAME="create_add_module" \
    --post-js add.post.emcc.js`;

	cd(baseDir);

	// $`npm run fmt`; // Clean up newly-created modules
	await formatDir(wasmDir);
	console.log(chalk.green('🏁 Compilation complete.'));
})();

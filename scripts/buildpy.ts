/**
 * Build python with emscripten
 *
 * TODO Add configuration for module: https://github.com/sindresorhus/conf
 * TODO Add checks for EMSDK/emscripten install
 */
import { $, chalk, path, glob, fs, question } from 'zx';
import { baseDir, formatDir, logWithEmoji } from './script.utils.js';

const DEFAULT_CPYTHON_DIR = path.join(baseDir, '.cpython'); // path.join(baseDir, '../../misc-pkg/cpython');
const DEFAULT_CPYTHON_BUILD_SUBDIR = 'build/emscripten-browser';
const DEFAULT_PY_WASM_LIB = './src/lib/pywasm';

// TODO Pull in aux scripts from ./scripts/pywasm.aux at time of copy.
void (async function () {
	logWithEmoji(chalk.blue('Compiling python w/ emscripten.'), '🏗️');

	// TODO Add these config options back in
	const wasmDir = DEFAULT_PY_WASM_LIB; // (await question(`Local dir for python wasm lib? (default: ${DEFAULT_PY_WASM_LIB}) `)) || DEFAULT_PY_WASM_LIB;

	const repoDir = DEFAULT_CPYTHON_DIR; // (await question(`cpython repo directory? (default: ${DEFAULT_CPYTHON_DIR}) `)) || DEFAULT_CPYTHON_DIR;
	const buildSubdir = DEFAULT_CPYTHON_BUILD_SUBDIR; //(await question(`Build dir within cpython? (default: ${DEFAULT_CPYTHON_BUILD_SUBDIR}) `)) || DEFAULT_CPYTHON_BUILD_SUBDIR;

	logWithEmoji(chalk.bgYellow('TODO Pull actual build commands into this script.'), '📋');
	logWithEmoji(
		chalk.magenta(`See ${repoDir}/Tools/wasm/README.md for more info about compiling.`),
		'💁'
	);

	const buildDir = path.join(repoDir, buildSubdir);
	const pyBuildFileGlob = buildDir + '/python.*';

	// TODO Ensure path exists!
	logWithEmoji(`Build files found @ ${pyBuildFileGlob}...`, '🗄️');
	const files = await glob(pyBuildFileGlob);
	await $`ls ${files} -lah`;

	if (await fs.pathExists(wasmDir)) {
		logWithEmoji(chalk.yellowBright(`Dest dir "${wasmDir}" already exists? :|`), '❓');
		const overwrite = await question(`Overwrite the dir? (y/N) `);
		if (overwrite.toLocaleLowerCase() !== 'y') {
			logWithEmoji(chalk.redBright(`Input "${overwrite}" !== "y" EXITING`), '🚪');
			process.exit(0);
		}

		await fs.remove(wasmDir);
	}

	await fs.ensureDir(wasmDir);
	await Promise.all(
		files.map((fp) => {
			let bp = path.basename(fp);
			if (bp === 'python.js') {
				bp = 'python.emcc.js';
			}
			console.log(`Writing ${path.basename(fp)} -> ${path.join(wasmDir, bp)}`);
			fs.copyFile(fp, path.join(wasmDir, bp));
		})
	);

	await formatDir(wasmDir);

	logWithEmoji(chalk.green(`Moved ${files.length} compiled files to ${wasmDir}.`), '🏁');
})();

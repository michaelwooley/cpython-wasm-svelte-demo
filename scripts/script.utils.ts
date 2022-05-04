import { $, quiet } from 'zx';

export const formatDir = async (dir: string): Promise<void> => {
	await quiet(
		$`npx prettier --ignore-path .gitignore --write --plugin-search-dir=${baseDir} ${dir}`
	);
};

export const logWithEmoji = (msg: string, emoji?: string): void =>
	console.log(((emoji || ' ') + ' '.repeat(3)).slice(0, 10) + msg);

const getBaseDir = (): string => {
	const _baseDir = process.env.npm_config_local_prefix;

	if (!_baseDir) {
		throw new Error('ENVVAR "npm_config_local_prefix" is not defined?!');
	}

	return _baseDir;
};

export const baseDir = getBaseDir();
await quiet($`cd ${baseDir}`);

import { $, quiet, path } from 'zx';

export const baseDir = path.resolve('.');

export const formatDir = async (dir: string): Promise<void> => {
	await quiet(
		$`npx prettier --ignore-path .gitignore --write --plugin-search-dir=${baseDir} ${dir}`
	);
};

export const logWithEmoji = (msg: string, emoji?: string): void =>
	console.log(((emoji || ' ') + ' '.repeat(3)).slice(0, 10) + msg);

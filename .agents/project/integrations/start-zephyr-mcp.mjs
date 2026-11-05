#!/usr/bin/env node
import { spawn } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import dotenv from 'dotenv';

// O MCP do Kiro não carrega o .env do workspace. Este launcher faz a ponte sem
// copiar o token para mcp.json, logs ou arquivos versionados.
dotenv.config({
	path: path.resolve(process.cwd(), '.env'),
	override: false,
	quiet: true,
});

const token =
	process.env.ZEPHYR_API_TOKEN?.trim() ??
	process.env.ZEPHYR_SCALE_API_TOKEN?.trim();
if (!token) {
	console.error(
		'Zephyr MCP: defina ZEPHYR_API_TOKEN no .env local (o alias ZEPHYR_SCALE_API_TOKEN também é aceito).',
	);
	process.exit(1);
}

const child = spawn('npx', ['-y', '@smartbear/mcp@latest'], {
	stdio: 'inherit',
	env: {
		...process.env,
		ZEPHYR_API_TOKEN: token,
		ZEPHYR_BASE_URL:
			process.env.ZEPHYR_BASE_URL ??
			'https://api.zephyrscale.smartbear.com/v2',
	},
});

child.once('error', (error) => {
	console.error(`Zephyr MCP: não foi possível iniciar o servidor: ${error.message}`);
	process.exit(1);
});

child.once('exit', (code) => {
	process.exit(code ?? 1);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
	process.once(signal, () => child.kill(signal));
}

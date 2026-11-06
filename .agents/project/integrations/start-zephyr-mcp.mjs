#!/usr/bin/env node
import { spawn } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

// O MCP do Kiro não carrega o .env do workspace. Este launcher faz a ponte sem
// copiar o token para mcp.json, logs ou arquivos versionados.
// O .env é localizado pela posição deste script, não pelo cwd do processo,
// porque o Kiro pode iniciar o MCP a partir de outro diretório.
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, '..', '..', '..');

dotenv.config({
	path: path.join(projectRoot, '.env'),
	override: false,
	quiet: true,
});

// Usa o primeiro valor não vazio. Um `ZEPHYR_API_TOKEN=` vazio no .env não
// pode esconder o alias `ZEPHYR_SCALE_API_TOKEN`.
const firstNonEmpty = (...names) => {
	for (const name of names) {
		const value = process.env[name]?.trim();
		if (value) return value;
	}
	return undefined;
};

const token = firstNonEmpty('ZEPHYR_API_TOKEN', 'ZEPHYR_SCALE_API_TOKEN');

if (!token) {
	console.error(
		'Zephyr MCP: defina ZEPHYR_API_TOKEN (ou ZEPHYR_SCALE_API_TOKEN) no .env local da raiz do projeto.',
	);
	process.exit(1);
}

const baseUrl =
	firstNonEmpty('ZEPHYR_BASE_URL') ?? 'https://api.zephyrscale.smartbear.com/v2';

// Versão fixada para evitar quebra por atualização automática do @latest.
// Para atualizar, troque a versão aqui e teste o MCP antes de commitar.
const SMARTBEAR_MCP_VERSION = '0.43.0';

const child = spawn('npx', ['-y', `@smartbear/mcp@${SMARTBEAR_MCP_VERSION}`], {
	stdio: 'inherit',
	env: {
		...process.env,
		ZEPHYR_API_TOKEN: token,
		ZEPHYR_BASE_URL: baseUrl,
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

#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import process from 'node:process';
import dotenv from 'dotenv';
import { parse as parseYaml } from 'yaml';
import { allowedHttpsUrl } from './lib/doctor-validation.mjs';
import { ownershipOf } from './lib/ownership.mjs';

const root = process.cwd();
const json = process.argv.includes('--json');
const cardIndex = process.argv.indexOf('--card');
const card = cardIndex >= 0 ? process.argv[cardIndex + 1]?.toUpperCase() : undefined;
const checks = [];

function add(id, severity, ok, message, remediation) {
	checks.push({ id, severity, ok, message, ...(remediation ? { remediation } : {}) });
}

function run(command, args) {
	return spawnSync(command, args, { cwd: root, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function safeRemote(value) {
	if (!value) return null;
	const scp = value.match(/^[^@]+@([^:]+):(.+)$/);
	if (scp) return `${scp[1]}/${scp[2]}`;
	try {
		const url = new URL(value);
		return `${url.hostname}${url.pathname}`;
	} catch {
		return 'configurado (formato local)';
	}
}

const configPath = path.join(root, '.agents/project/qa-project.yaml');
const rootOk = existsSync(path.join(root, 'package.json')) && existsSync(configPath);
add('workspace.root', 'error', rootOk, rootOk ? 'raiz do projeto reconhecida' : 'execute na raiz do opm-qa-automation');

let config;
if (rootOk) {
	try {
		config = parseYaml(readFileSync(configPath, 'utf-8'));
		const required = ['core_version', 'project', 'stack', 'environments', 'workflow', 'artifacts', 'jira', 'zephyr', 'git', 'evidence'];
		const missing = required.filter((key) => config[key] === undefined);
		add('config.required', 'error', missing.length === 0, missing.length ? `campos ausentes: ${missing.join(', ')}` : 'campos obrigatórios presentes');
	} catch (error) {
		add('config.parse', 'error', false, `qa-project.yaml inválido: ${error.message}`);
	}
}

const major = Number(process.versions.node.split('.')[0]);
add('tooling.node', 'error', major >= 20, `Node ${process.versions.node} (${major >= 20 ? 'compatível' : 'requer 20+'})`);
add('tooling.dependencies', 'error', existsSync(path.join(root, 'node_modules')), existsSync(path.join(root, 'node_modules')) ? 'node_modules presente' : 'dependências ausentes', 'rode npm ci');

const envFile = path.join(root, '.env');
const envExists = existsSync(envFile);
add('secrets.env-file', 'error', envExists, envExists ? '.env local encontrado' : '.env ausente', 'copie .env.example para .env');
if (envExists) dotenv.config({ path: envFile, quiet: true, override: false });
const ignored = run('git', ['check-ignore', '-q', '.env']).status === 0;
add('secrets.gitignore', 'error', ignored, ignored ? '.env ignorado pelo Git' : '.env não está ignorado pelo Git');

if (config) {
	const defaultEnvironment = config.environments?.default;
	if (card) {
		const allowedProjects = config.jira?.project_keys ?? [];
		add('card.project', 'error', allowedProjects.includes(card.split('-')[0]), `card ${card} ${allowedProjects.includes(card.split('-')[0]) ? 'permitido' : `fora dos projetos ${allowedProjects.join(', ')}`}`);
	}
	const forbidden = config.environments?.forbidden ?? [];
	const environment = config.environments?.[defaultEnvironment];
	add('environment.default', 'error', Boolean(defaultEnvironment && environment), `ambiente padrão ${defaultEnvironment ?? '(ausente)'} ${environment ? 'configurado' : 'não configurado'}`);
	add('environment.forbidden', 'error', !forbidden.includes(defaultEnvironment), `ambiente padrão não pertence à lista proibida`);
	const urls = [environment?.base_url, environment?.api_url].filter(Boolean);
	const allowedHosts = environment?.allowed_hosts ?? [];
	const unsafeUrl = urls.some((url) => !allowedHttpsUrl(url, allowedHosts));
	add('environment.urls', 'error', allowedHosts.length > 0 && !unsafeUrl, !allowedHosts.length ? 'ambiente precisa declarar allowed_hosts' : unsafeUrl ? 'URL deve usar HTTPS e host da allowlist do ambiente' : 'URLs usam HTTPS e somente hosts permitidos');

	for (const name of environment?.credentials_env ?? []) {
		const present = Boolean(process.env[name]?.trim());
		add(`secret.${name}`, 'error', present, `${name}: ${present ? 'definida' : 'ausente ou vazia'}`);
	}
	const tokenNames = [config.zephyr?.token_env, ...(config.zephyr?.token_env_aliases ?? []), 'ZEPHYR_SCALE_API_TOKEN'].filter(Boolean);
	const selectedToken = tokenNames.find((name) => process.env[name]?.trim());
	add('secret.zephyr-token', 'error', Boolean(selectedToken), selectedToken ? `token Zephyr disponível pela variável ${selectedToken}` : `token Zephyr ausente (${[...new Set(tokenNames)].join(' ou ')})`);
	if (selectedToken && selectedToken !== config.zephyr?.token_env) add('secret.zephyr-alias', 'warning', false, `token primário ${config.zephyr.token_env} não foi usado; alias ${selectedToken} está ativo`);

	const mcpPath = path.resolve(root, config.mcp ?? '');
	add('mcp.config', 'error', Boolean(config.mcp && existsSync(mcpPath)), config.mcp && existsSync(mcpPath) ? 'configuração MCP encontrada' : 'configuração MCP ausente');
	if (config.mcp && existsSync(mcpPath)) {
		try {
			const mcp = JSON.parse(readFileSync(mcpPath, 'utf-8'));
			for (const name of ['atlassian', 'playwright', 'zephyr']) add(`mcp.${name}`, 'error', Boolean(mcp.mcpServers?.[name] && !mcp.mcpServers[name].disabled), `MCP ${name} ${mcp.mcpServers?.[name] && !mcp.mcpServers[name].disabled ? 'habilitado' : 'ausente ou desabilitado'}`);
			const atlassianAllowed = config.security?.allowed_hosts?.atlassian ?? [];
			const atlassianValue = mcp.mcpServers?.atlassian?.url;
			const atlassianSafe = allowedHttpsUrl(atlassianValue, atlassianAllowed);
			let atlassianHost = null;
			try { atlassianHost = new URL(atlassianValue).hostname; } catch {}
			add('mcp.atlassian-host', 'error', atlassianSafe, atlassianSafe ? `host Atlassian permitido com HTTPS: ${atlassianHost}` : 'endpoint Atlassian deve usar HTTPS e host da allowlist');
			const zephyrAllowed = config.security?.allowed_hosts?.zephyr ?? [];
			const zephyrValue = process.env.ZEPHYR_BASE_URL ?? 'https://api.zephyrscale.smartbear.com/v2';
			const zephyrSafe = allowedHttpsUrl(zephyrValue, zephyrAllowed);
			let zephyrHost = null;
			try { zephyrHost = new URL(zephyrValue).hostname; } catch {}
			add('mcp.zephyr-host', 'error', zephyrSafe, zephyrSafe ? `host Zephyr permitido com HTTPS: ${zephyrHost}` : 'endpoint Zephyr deve usar HTTPS e host da allowlist');
			const zephyrScript = mcp.mcpServers?.zephyr?.args?.[0];
			if (zephyrScript) add('mcp.zephyr-launcher', 'error', existsSync(path.resolve(root, zephyrScript)), existsSync(path.resolve(root, zephyrScript)) ? 'launcher Zephyr encontrado' : 'launcher Zephyr ausente');
			if (mcp.mcpServers?.playwright?.args?.some((arg) => String(arg).includes('@latest'))) add('mcp.playwright-version', 'warning', false, 'Playwright MCP usa @latest; fixe uma versão para maior reprodutibilidade');
		} catch (error) { add('mcp.parse', 'error', false, `JSON do MCP inválido: ${error.message}`); }
	}

	const branch = run('git', ['branch', '--show-current']).stdout.trim();
	add('git.branch', 'error', Boolean(branch), branch ? `branch atual: ${branch}` : 'branch não identificada');
	const protectedBranch = (config.git?.protected ?? []).includes(branch);
	add('git.protected', card ? 'error' : 'warning', !protectedBranch, protectedBranch ? `branch ${branch} é protegida` : `branch ${branch} permite trabalho`, protectedBranch ? `crie ${String(config.git?.branch ?? 'qa/{CARD}-{slug}').replace('{CARD}', card ?? 'CARD').replace('{slug}', 'descricao')}` : undefined);
	const remote = run('git', ['remote', 'get-url', 'origin']);
	const originSafe = remote.status === 0 ? safeRemote(remote.stdout.trim()) : null;
	add('git.origin', 'warning', remote.status === 0, remote.status === 0 ? `origin: ${originSafe}` : 'origin não configurado');
	if (config.git?.expected_repository) {
		add('git.expected-repository', 'warning', originSafe === config.git.expected_repository, originSafe === config.git.expected_repository ? 'origin corresponde ao repositório esperado' : `origin diverge do esperado: ${config.git.expected_repository}`);
	}

	const ownershipConfigured = Boolean(ownershipOf(config));
	add('ownership.policy', 'error', ownershipConfigured, ownershipConfigured ? 'política de propriedade declarada (casos e testes do time são somente leitura)' : 'bloco ownership ausente ou incompleto no qa-project.yaml');

	const specsDir = (config.atdd?.specs_dir ?? '').replaceAll('{CARD}', 'CARD');
	const ownedPaths = config.ownership?.automation?.owned_paths ?? [];
	const atddOk = Boolean(config.atdd?.dev_guide && config.atdd?.commands?.run_scenario && specsDir && ownedPaths.some((owned) => specsDir.startsWith(`${owned}/`)));
	add('atdd.config', 'error', atddOk, atddOk ? 'ATDD configurado: testes de aceite em diretório do agente' : 'bloco atdd ausente, incompleto ou com specs_dir fora dos diretórios do agente');

	for (const repository of config.future_code_context?.repositories ?? []) {
		const name = String(repository).split('/').pop()?.replace(/\.git$/, '');
		const candidates = [path.join(root, '..', name ?? ''), path.join(root, name ?? '')];
		const present = candidates.some((candidate) => existsSync(candidate));
		add(`repository.${name}`, 'warning', present, present ? `${name} disponível localmente` : `${name} indisponível; discovery deve usar modo documental ou without-code`);
	}
}

let browserFound = false;
try {
	const { chromium } = await import('@playwright/test');
	browserFound = existsSync(chromium.executablePath());
} catch {}
add('tooling.chromium', 'error', browserFound, browserFound ? 'Chromium do Playwright instalado' : 'Chromium do Playwright ausente', 'rode npx playwright install chromium');

const sync = run(process.execPath, ['.agents/core/scripts/agents-sync.mjs', '--check']);
add('agents.sync', 'error', sync.status === 0, sync.status === 0 ? 'adaptadores dos agentes em dia' : 'adaptadores desatualizados', 'rode npm run agents:sync');

const errors = checks.filter((item) => item.severity === 'error' && !item.ok);
const warnings = checks.filter((item) => item.severity === 'warning' && !item.ok);
const result = { schemaVersion: 1, healthy: errors.length === 0, summary: { errors: errors.length, warnings: warnings.length, passed: checks.filter((item) => item.ok).length }, checks };

if (json) console.log(JSON.stringify(result, null, 2));
else {
	console.log(`qa-doctor: ${result.healthy ? 'APTO' : 'BLOQUEADO'} (${errors.length} erro(s), ${warnings.length} aviso(s))`);
	for (const item of checks) console.log(`  ${item.ok ? 'OK' : item.severity === 'error' ? 'ERRO' : 'AVISO'} ${item.id}: ${item.message}`);
}
process.exit(result.healthy ? 0 : 1);

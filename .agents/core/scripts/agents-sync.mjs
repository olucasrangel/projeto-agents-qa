#!/usr/bin/env node
/**
 * Gera os adaptadores de IDE a partir do núcleo (.agents/core) e da
 * personalização do projeto (.agents/project/qa-project.yaml):
 *
 *   .kiro/steering/qa-run.md, grill-me.md, project-context.md
 *   .kiro/skills/<skill>/        skills do núcleo, da stack e do projeto
 *   .kiro/settings/mcp.json      MCP do projeto
 *   .agents/skills/<skill>/      as mesmas skills, para o Devin
 *
 * Uso: npm run agents:sync          (escreve)
 *      npm run agents:sync -- --check  (falha se algo estiver desatualizado)
 */
import {
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	rmSync,
	statSync,
	writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';

const CORE = '.agents/core';
const PROJECT_CONFIG = '.agents/project/qa-project.yaml';
const SKILL_TARGETS = ['.kiro/skills', '.agents/skills'];
const GENERATED_NOTE =
	'Gerado por `npm run agents:sync` a partir de `.agents/core` e `.agents/project`. Não editar à mão.';

const check = process.argv.includes('--check');
const problems = [];

function fail(message) {
	console.error(`agents-sync: ${message}`);
	process.exit(1);
}

// ── Configuração ─────────────────────────────────────────────

function validate(value, schema, where) {
	if (schema.type === 'object' || schema.properties) {
		if (typeof value !== 'object' || value === null || Array.isArray(value)) {
			problems.push(`${where} deve ser um objeto`);
			return;
		}
		for (const key of schema.required ?? []) {
			if (value[key] === undefined) problems.push(`${where}.${key} é obrigatório`);
		}
		for (const [key, child] of Object.entries(schema.properties ?? {})) {
			if (value[key] !== undefined) validate(value[key], child, `${where}.${key}`);
		}
		return;
	}
	if (schema.enum && !schema.enum.includes(value)) {
		problems.push(`${where} deve ser um de: ${schema.enum.join(', ')}`);
	}
	if (schema.type === 'array' && !Array.isArray(value)) problems.push(`${where} deve ser uma lista`);
	if (schema.type === 'string' && typeof value !== 'string') problems.push(`${where} deve ser texto`);
	if (schema.type === 'integer' && !Number.isInteger(value)) problems.push(`${where} deve ser inteiro`);
	if (schema.minItems && Array.isArray(value) && value.length < schema.minItems) {
		problems.push(`${where} precisa de pelo menos ${schema.minItems} item`);
	}
}

if (!existsSync(PROJECT_CONFIG)) fail(`${PROJECT_CONFIG} não encontrado`);
const config = parse(readFileSync(PROJECT_CONFIG, 'utf-8'));
const schema = JSON.parse(readFileSync(`${CORE}/schemas/qa-project.schema.json`, 'utf-8'));
validate(config, schema, 'qa-project');

const coreVersion = readFileSync(`${CORE}/VERSION`, 'utf-8').trim();
if (config.core_version !== coreVersion) {
	problems.push(`core_version ${config.core_version} difere do núcleo instalado (${coreVersion})`);
}
const stackDir = `${CORE}/stacks/${config.stack?.id}`;
if (config.stack?.id && !existsSync(stackDir)) {
	problems.push(`stack ${config.stack.id} não existe em ${CORE}/stacks`);
}
if (config.grill_me && config.grill_me.min_questions > config.grill_me.max_questions) {
	problems.push('grill_me.min_questions não pode ser maior que max_questions');
}
for (const skill of config.skills ?? []) {
	if (!existsSync(path.join(skill, 'SKILL.md'))) problems.push(`skill ${skill} sem SKILL.md`);
}
for (const [point, agents] of Object.entries(config.extensions ?? {})) {
	for (const agent of agents) {
		if (!existsSync(agent)) problems.push(`extensions.${point}: ${agent} não encontrado`);
	}
}
if (problems.length) fail(`configuração inválida:\n  - ${problems.join('\n  - ')}`);

// ── Saídas ───────────────────────────────────────────────────

/** @type {Map<string, Buffer>} */
const outputs = new Map();

function walk(dir) {
	return readdirSync(dir).flatMap((entry) => {
		const full = path.join(dir, entry);
		return statSync(full).isDirectory() ? walk(full) : [full];
	});
}

function addDir(source, target) {
	for (const file of walk(source)) {
		outputs.set(path.join(target, path.relative(source, file)), readFileSync(file));
	}
}

const skillSources = [
	...readdirSync(`${CORE}/skills`).map((name) => path.join(CORE, 'skills', name)),
	stackDir,
	...(config.skills ?? []),
];
for (const target of SKILL_TARGETS) {
	for (const source of skillSources) addDir(source, path.join(target, path.basename(source)));
	outputs.set(
		path.join(target, 'README.md'),
		Buffer.from(
			`# Skills\n\n${GENERATED_NOTE}\n\nPara mudar uma skill, edite a origem:\n\n${skillSources
				.map((source) => `- \`${path.basename(source)}\` ← \`${source}\``)
				.join('\n')}\n`,
		),
	);
}

const fileRef = (file) => `#[[file:${file}]]`;

outputs.set(
	'.kiro/steering/qa-run.md',
	Buffer.from(`---
inclusion: manual
---

<!-- ${GENERATED_NOTE} -->

# #qa-run — agente de QA

Quando o QA escrever \`#qa-run <CARD>\`, conduza o fluxo do agente de QA para o
card informado. Siga o orquestrador e os agentes abaixo, nesta ordem de
autoridade: regras do núcleo, depois configuração e skills do projeto.

## Núcleo

${fileRef(`${CORE}/README.md`)}

${fileRef(`${CORE}/agents/orchestrator.md`)}

${fileRef(`${CORE}/agents/a1-discovery.md`)}

${fileRef(`${CORE}/agents/a2-automation.md`)}

${fileRef(`${CORE}/agents/a3-diagnosis.md`)}

${fileRef(`${CORE}/agents/a4-delivery.md`)}

## Projeto

${fileRef(PROJECT_CONFIG)}
${(config.agents ?? []).map((agent) => `\n${fileRef(agent)}\n`).join('')}
`),
);

outputs.set(
	'.kiro/steering/grill-me.md',
	Buffer.from(`---
inclusion: manual
---

<!-- ${GENERATED_NOTE} -->

# Grill Me

Faça entre ${config.grill_me.min_questions} e ${config.grill_me.max_questions} perguntas, uma por vez.

${fileRef(`${CORE}/skills/grill-me/SKILL.md`)}
${config.grill_me.extra_questions ? `\n${fileRef(config.grill_me.extra_questions)}\n` : ''}`),
);

outputs.set(
	'.kiro/steering/project-context.md',
	Buffer.from(`---
inclusion: always
---

<!-- ${GENERATED_NOTE} -->

# ${config.project.name}

${config.project.context ?? ''}

- Squad: ${config.project.squad} · Idioma: ${config.project.language}
- Stack: \`${config.stack.id}\` em \`${config.stack.root}\`
- Ambiente padrão: \`${config.environments.default}\` · Proibidos: ${config.environments.forbidden.map((env) => `\`${env}\``).join(', ')}
- Typecheck: \`${config.stack.commands.typecheck}\` · Testes de um card: \`${config.stack.commands.test_card}\`
- Jira: ${config.jira.project_keys.join(', ')} · Zephyr ${config.zephyr.edition}: ${config.zephyr.project_key}
- Fluxo do agente de QA: \`#qa-run <CARD>\`. Alinhamento avulso: \`#grill-me\`.
- Nunca relaxe assertion para o teste passar, nunca aponte para ambiente proibido
  e nunca versione segredo.
`),
);

if (config.mcp) {
	if (!existsSync(config.mcp)) fail(`mcp: ${config.mcp} não encontrado`);
	outputs.set('.kiro/settings/mcp.json', readFileSync(config.mcp));
}

// ── Escrita ou verificação ───────────────────────────────────

const stale = [];
for (const target of SKILL_TARGETS) {
	if (!existsSync(target)) continue;
	for (const file of walk(target)) if (!outputs.has(file)) stale.push(file);
}
const changed = [...outputs].filter(
	([file, content]) => !existsSync(file) || !readFileSync(file).equals(content),
);

if (check) {
	if (changed.length || stale.length) {
		fail(
			`adaptadores desatualizados; rode npm run agents:sync.\n${[
				...changed.map(([file]) => `  alterado: ${file}`),
				...stale.map((file) => `  sobrando: ${file}`),
			].join('\n')}`,
		);
	}
	console.log('agents-sync: adaptadores em dia.');
	process.exit(0);
}

for (const file of stale) rmSync(file);
for (const [file, content] of changed) {
	mkdirSync(path.dirname(file), { recursive: true });
	writeFileSync(file, content);
}
console.log(
	`agents-sync: ${changed.length} arquivo(s) atualizado(s), ${stale.length} removido(s), ${outputs.size} no total.`,
);

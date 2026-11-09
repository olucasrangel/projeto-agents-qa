#!/usr/bin/env node
/**
 * Prepara o payload de publicação no Zephyr Scale a partir do .feature do card.
 *
 * Esta fase é somente dry-run: o script lê o .feature, valida, compara com o
 * plano gravado em zephyr-dry-run.json e grava um arquivo. Não faz nenhuma
 * chamada de escrita ao Zephyr. Rodar de novo com o mesmo .feature produz o
 * mesmo arquivo byte a byte, então a etapa é idempotente.
 *
 * Uso:
 *   npm run zephyr:sync -- <CARD> [--preview] [--feature <caminho>]
 *
 * Sem --preview, exige o gate G1 registrado em qa/runs/<CARD>/state.json e que o
 * artefato aprovado no G1 não tenha mudado desde a aprovação.
 * Com --preview, gera o mesmo arquivo marcado como não aprovado, para revisão antes do G1.
 */
import { createHash } from 'node:crypto';
import {
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	statSync,
	writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';
import { ownershipOf } from '../../core/scripts/lib/ownership.mjs';

const PROJECT_ROOT = process.cwd();
const SCHEMA_VERSION = 1;

function fail(message) {
	console.error(`zephyr-sync: ${message}`);
	process.exit(1);
}

function sha256(buffer) {
	return createHash('sha256').update(buffer).digest('hex');
}

function readJson(file) {
	return JSON.parse(readFileSync(file, 'utf-8'));
}

const args = process.argv.slice(2);
const card = args.find((arg) => !arg.startsWith('--'));
const preview = args.includes('--preview');
const publish = args.includes('--publish');
const featureOption = args.indexOf('--feature');
const featureArg = featureOption >= 0 ? args[featureOption + 1] : undefined;

if (!card || !/^[A-Z][A-Z0-9]+-\d+$/.test(card)) {
	fail('informe o card no formato PROJ-123. Uso: npm run zephyr:sync -- PGPO-3266 [--preview]');
}
if (publish) {
	fail(
		'publicação real não está implementada. Exige G2 registrado, external_writes: true no qa-project.yaml e a etapa de escrita aprovada.',
	);
}

const cardRoot = path.join(PROJECT_ROOT, 'qa', 'cards', card);
const runRoot = path.join(PROJECT_ROOT, 'qa', 'runs', card);
const statePath = path.join(runRoot, 'state.json');
const dryRunPath = path.join(cardRoot, 'zephyr', 'zephyr-dry-run.json');
const payloadPath = path.join(cardRoot, 'zephyr', 'zephyr-sync-payload.json');
const projectConfigPath = path.join(PROJECT_ROOT, '.agents', 'project', 'qa-project.yaml');

function findFeature(root, fileName) {
	const found = [];
	const visit = (directory) => {
		for (const entry of readdirSync(directory)) {
			const full = path.join(directory, entry);
			if (statSync(full).isDirectory()) visit(full);
			else if (entry === fileName) found.push(full);
		}
	};
	if (existsSync(root)) visit(root);
	return found;
}

const featureFile = featureArg
	? path.resolve(PROJECT_ROOT, featureArg)
	: (() => {
			const found = findFeature(path.join(cardRoot, 'bdd'), `${card}.feature`);
			if (found.length !== 1) {
				fail(
					`esperado um arquivo ${card}.feature em qa/cards/${card}/bdd; encontrados ${found.length}.`,
				);
			}
			return found[0];
		})();

if (!existsSync(featureFile)) fail(`feature não encontrado: ${featureFile}`);
if (!existsSync(dryRunPath)) fail(`plano dry-run ausente: ${dryRunPath}. Rode o A1 antes.`);
if (!existsSync(projectConfigPath)) fail(`configuração ausente: ${projectConfigPath}`);

const featureText = readFileSync(featureFile, 'utf-8');
const featureSha = sha256(Buffer.from(featureText));
const projectConfig = parse(readFileSync(projectConfigPath, 'utf-8'));
const allowedProjects = projectConfig.jira?.project_keys ?? [];
if (allowedProjects.length && !allowedProjects.includes(card.split('-')[0])) {
	fail(`projeto do card ${card} não permitido. Use: ${allowedProjects.join(', ')}.`);
}
const ownership = ownershipOf(projectConfig);
if (!ownership) fail('bloco ownership ausente ou incompleto no qa-project.yaml.');
const folderSuffix = ownership.zephyr.automation_folder_suffix;
const ownedRegistryPath = path.join(
	PROJECT_ROOT,
	ownership.zephyr.owned_registry.replaceAll('{CARD}', card),
);
// Chaves de casos criados pelo próprio agente. Só elas podem ser atualizadas.
const ownedKeys = new Set(
	existsSync(ownedRegistryPath) ? (readJson(ownedRegistryPath).cases ?? []).map((entry) => entry.key) : [],
);
const zephyrConfig = projectConfig.zephyr ?? {};
const priorities = zephyrConfig.priorities ?? {};
const projectKey = zephyrConfig.project_key;
if (!projectKey) fail('zephyr.project_key ausente no qa-project.yaml.');
if (zephyrConfig.mode !== 'dry-run') {
	fail(`zephyr.mode está em "${zephyrConfig.mode}". Esta versão do zephyr-sync só suporta dry-run.`);
}

// ---------------------------------------------------------------- Gherkin ----

const STEP_KINDS = {
	Given: 'precondition',
	When: 'action',
	Then: 'expected',
	And: null,
	But: null,
};

function parseFeature(text) {
	const errors = [];
	const feature = { name: null, description: [] };
	const scenarios = [];
	let pendingComments = [];
	let pendingTags = [];
	let current = null;
	let inHeader = false;
	let lastKind = null;

	text.split(/\r?\n/).forEach((raw, index) => {
		const lineNo = index + 1;
		const line = raw.trim();
		if (!line) return;

		if (line.startsWith('#')) {
			pendingComments.push({ text: line.slice(1).trim(), lineNo });
			return;
		}
		if (line.startsWith('@')) {
			pendingTags.push(...line.split(/\s+/).filter((tag) => tag.startsWith('@')));
			return;
		}
		if (line.startsWith('Feature:')) {
			feature.name = line.slice('Feature:'.length).trim();
			inHeader = true;
			pendingComments = [];
			pendingTags = [];
			return;
		}
		const scenarioMatch = line.match(/^(Scenario|Scenario Outline):\s*(.+)$/);
		if (scenarioMatch) {
			inHeader = false;
			current = {
				title: scenarioMatch[2].trim(),
				tags: pendingTags,
				comments: pendingComments,
				lineNo,
				steps: [],
			};
			scenarios.push(current);
			pendingComments = [];
			pendingTags = [];
			lastKind = null;
			return;
		}
		const stepMatch = line.match(/^(Given|When|Then|And|But)\s+(.+)$/);
		if (stepMatch && current) {
			const keyword = stepMatch[1];
			const direct = STEP_KINDS[keyword];
			const kind = direct === undefined || direct === null ? lastKind : direct;
			if (!kind) {
				errors.push(`linha ${lineNo}: "${keyword}" sem Given, When ou Then antes.`);
			}
			if (direct) lastKind = direct;
			current.steps.push({ keyword, kind, text: stepMatch[2].trim(), lineNo });
			pendingComments = [];
			return;
		}
		if (inHeader && !current) {
			feature.description.push(line);
			return;
		}
		errors.push(`linha ${lineNo}: conteúdo não reconhecido: "${line}"`);
	});

	return { feature, scenarios, errors };
}

// -------------------------------------------------------------- Validation ----

const errors = [];
const warnings = [];

if (!/^# language: en\s*$/m.test(featureText)) {
	errors.push('a primeira diretiva deve ser # language: en.');
}
if (/^\s*(Funcionalidade|Contexto|Cenário|Esquema do Cenário|Exemplos|Dado|Quando|Então|E|Mas)(?:\s|:)/m.test(featureText)) {
	errors.push('use somente palavras-chave Gherkin em inglês: Feature/Scenario/Given/When/Then.');
}

const { feature, scenarios, errors: parseErrors } = parseFeature(featureText);
errors.push(...parseErrors);

if (!feature.name) errors.push('Feature sem nome.');
if (scenarios.length === 0) errors.push('Nenhum cenário encontrado.');

// Padrão do Confluence: [Chave][Aplicação][Sucesso|Falha] e título iniciado por "Validar".
const namePattern = new RegExp(`^\\[${card}\\]\\[[A-Za-zÀ-ÿ]+\\]\\[(Sucesso|Falha)\\] Validar \\S`);
const criticalityTags = Object.keys(priorities).map((level) => `@${level}`);
const names = new Map();
const keysSeen = new Map();

const items = scenarios.map((scenario, index) => {
	const label = `cenário ${index + 1} (linha ${scenario.lineNo})`;
	const cardTag = `@${card}`;
	if (!scenario.tags.includes(cardTag)) errors.push(`${label}: falta a tag ${cardTag}.`);

	const criticality = scenario.tags.filter((tag) => criticalityTags.includes(tag));
	if (criticality.length !== 1) {
		errors.push(`${label}: esperada uma criticidade (${criticalityTags.join(', ')}); encontradas ${criticality.length}.`);
	}

	if (!namePattern.test(scenario.title)) {
		errors.push(`${label}: título fora do padrão [${card}][Aplicação][Sucesso|Falha] Validar ...`);
	}
	for (const step of scenario.steps) {
		if (/\b(ou|se)\b/i.test(step.text)) {
			errors.push(`${label}: o passo "${step.keyword} ${step.text}" usa "ou" ou "se"; o padrão do Confluence pede um comportamento por cenário.`);
		}
	}
	if (!scenario.steps.some((step) => step.kind === 'precondition')) {
		errors.push(`${label}: precondição obrigatória (pelo menos um Given).`);
	}
	if (names.has(scenario.title)) {
		errors.push(`${label}: título duplicado com o cenário da linha ${names.get(scenario.title)}.`);
	}
	names.set(scenario.title, scenario.lineNo);

	const actions = scenario.steps.filter((step) => step.kind === 'action');
	const expected = scenario.steps.filter((step) => step.kind === 'expected');
	if (actions.length === 0 || expected.length === 0) {
		errors.push(`${label}: precisa de pelo menos um Quando e um Então.`);
	}

	const tagKeys = scenario.tags.filter((tag) => new RegExp(`^@${projectKey}-T\\d+$`).test(tag));
	const candidateComments = scenario.comments.filter((comment) => /Candidato:/.test(comment.text));
	const candidateKeys = candidateComments.flatMap((comment) =>
		[...comment.text.matchAll(new RegExp(`${projectKey}-T\\d+`, 'g'))].map((match) => match[0]),
	);
	if (tagKeys.length > 1) errors.push(`${label}: mais de uma chave ${projectKey} marcada.`);
	if (candidateKeys.length > 1) errors.push(`${label}: mais de um caso candidato no comentário.`);
	const tagKey = tagKeys[0]?.slice(1) ?? null;
	const candidateKey = candidateKeys[0] ?? null;
	if (tagKey && candidateKey && tagKey !== candidateKey) {
		errors.push(`${label}: tag ${tagKey} diverge do caso candidato ${candidateKey}.`);
	}
	// "Candidato: VPOS-T..." aponta para um caso do TIME: é só referência de leitura.
	// A tag @VPOS-T... só vale para caso do próprio agente, registrado em owned-cases.json.
	if (tagKey && !ownedKeys.has(tagKey)) {
		errors.push(`${label}: ${tagKey} não é um caso criado pelo agente (fora de owned-cases.json). Casos do time não podem ser alterados.`);
	}
	const key = tagKey && ownedKeys.has(tagKey) ? tagKey : null;
	const teamReference = candidateKey && candidateKey !== key ? candidateKey : null;
	for (const reference of [key, teamReference].filter(Boolean)) {
		if (keysSeen.has(reference)) errors.push(`${label}: chave ${reference} já usada no cenário ${keysSeen.get(reference)}.`);
		keysSeen.set(reference, index + 1);
	}

	const operation = key ? 'atualizar' : 'criar';
	const criticalityTag = criticality[0] ?? null;

	return {
		order: index + 1,
		name: scenario.title,
		operation,
		key,
		owned: Boolean(key),
		folder: 'automation',
		status: zephyrConfig.initial_status ?? 'Draft',
		objective: feature.name,
		teamReference: teamReference ? { key: teamReference, access: 'read-only' } : null,
		tags: [cardTag, criticalityTag].filter(Boolean),
		priorityName: criticalityTag ? priorities[criticalityTag.slice(1)] : null,
		precondition: scenario.steps.filter((s) => s.kind === 'precondition').map((s) => `${s.keyword} ${s.text}`),
		steps: buildSteps(scenario.steps),
		gherkin: [`Scenario: ${scenario.title}`, ...scenario.steps.map((s) => `  ${s.keyword} ${s.text}`)],
	};
});

function buildSteps(steps) {
	const result = [];
	let current = null;
	for (const step of steps) {
		if (step.kind === 'precondition') continue;
		if (step.kind === 'action') {
			current = { action: [], expectedResult: [] };
			result.push(current);
			current.action.push(`${step.keyword} ${step.text}`);
		} else if (step.kind === 'expected' && current) {
			current.expectedResult.push(`${step.keyword} ${step.text}`);
		} else if (step.kind === 'expected' && !current) {
			current = { action: [], expectedResult: [`${step.keyword} ${step.text}`] };
			result.push(current);
		}
	}
	return result.map((item, index) => ({
		index: index + 1,
		action: item.action.join('\n'),
		expectedResult: item.expectedResult.join('\n'),
	}));
}

// ------------------------------------------------------------- Dry-run diff ----

const dryRun = readJson(dryRunPath);
const plannedByName = new Map((dryRun.decisions ?? []).map((decision) => [decision.proposedName, decision]));
const automationFolder = dryRun.folders?.newCasesFolder;

if (!automationFolder?.name || !automationFolder.name.trim().endsWith(folderSuffix)) {
	errors.push(`o plano dry-run precisa de uma pasta própria terminada em "${folderSuffix}".`);
}
if (automationFolder?.decisionPending) {
	errors.push(`pasta do agente com decisão pendente: ${automationFolder.decisionPending}`);
}
for (const decision of dryRun.decisions ?? []) {
	if (decision.operation === 'atualizar' && !ownedKeys.has(decision.key)) {
		errors.push(`o plano dry-run manda atualizar ${decision.key}, que não é um caso do agente. Casos do time são somente leitura.`);
	}
}

for (const item of items) {
	const planned = plannedByName.get(item.name);
	if (!planned) {
		warnings.push(`cenário "${item.name}" não consta no plano dry-run.`);
		continue;
	}
	if (planned.operation !== item.operation) {
		warnings.push(`"${item.name}": o plano dry-run marca "${planned.operation}", e o .feature resulta em "${item.operation}".`);
	}
	const plannedReference = planned.teamReference?.key ?? null;
	if (plannedReference !== (item.teamReference?.key ?? null)) {
		warnings.push(`"${item.name}": referência do time diverge entre plano dry-run e .feature.`);
	}
}
const creates = items.filter((item) => item.operation === 'criar');
const updates = items.filter((item) => item.operation === 'atualizar');

// ---------------------------------------------------------------- G1 gate ----

let approval = { approved: false, reason: 'G1 não registrado' };
if (existsSync(statePath)) {
	const state = readJson(statePath);
	const g1 = state.gates?.G1;
	if (g1) {
		approval = { approved: true, by: g1.by, at: g1.at, artifact: g1.artifact ?? null, sha256: g1.sha256 ?? null };
		if (g1.artifact && g1.sha256) {
			const artifactPath = path.resolve(PROJECT_ROOT, g1.artifact);
			const current = existsSync(artifactPath) ? sha256(readFileSync(artifactPath)) : null;
			if (current !== g1.sha256) {
				errors.push(
					`o artefato aprovado no G1 (${g1.artifact}) mudou depois da aprovação. Peça nova aprovação do G1.`,
				);
			}
		}
	}
}
if (!approval.approved && !preview) {
	errors.push('G1 não registrado. Use --preview para revisar antes da aprovação.');
}

// ---------------------------------------------------------------- Output ----

if (errors.length > 0) {
	console.error('zephyr-sync: validação falhou:');
	for (const error of errors) console.error(`  - ${error}`);
	process.exit(1);
}

const payload = {
	schemaVersion: SCHEMA_VERSION,
	mode: 'dry-run',
	published: false,
	status: approval.approved ? 'approved-g1' : 'preview-not-approved',
	card,
	projectKey,
	feature: {
		file: path.relative(PROJECT_ROOT, featureFile),
		sha256: featureSha,
		name: feature.name,
		description: feature.description,
	},
	g1: approval,
	priorities,
	ownership: {
		teamCases: ownership.zephyr.team_cases,
		automationFolder: { name: automationFolder.name, parentId: automationFolder.parentId ?? null, suffix: folderSuffix },
		ownedRegistry: path.relative(PROJECT_ROOT, ownedRegistryPath),
		ownedKeys: [...ownedKeys].sort(),
	},
	summary: {
		total: items.length,
		atualizar: updates.length,
		criar: creates.length,
		referenciasDoTime: items.filter((item) => item.teamReference).length,
	},
	items,
	warnings,
};

mkdirSync(path.dirname(payloadPath), { recursive: true });
writeFileSync(payloadPath, `${JSON.stringify(payload, null, 2)}\n`);

const payloadSha = sha256(readFileSync(payloadPath));
console.log(`zephyr-sync: ${items.length} cenário(s) (${payload.summary.criar} criar, ${payload.summary.atualizar} atualizar caso do agente).`);
console.log(`  pasta do agente: ${automationFolder.name}`);
console.log(`  casos do time referenciados (somente leitura): ${payload.summary.referenciasDoTime}`);
console.log(`  status: ${payload.status}`);
console.log(`  feature sha256: ${featureSha}`);
console.log(`  payload: ${path.relative(PROJECT_ROOT, payloadPath)} (sha256 ${payloadSha})`);
for (const warning of warnings) console.log(`  aviso: ${warning}`);
console.log('  nenhuma escrita foi feita no Zephyr (dry-run).');

#!/usr/bin/env node
/**
 * Ciclo ATDD do agente: teste de aceite antes da funcionalidade.
 *
 *   npm run qa:atdd -- skeleton <CARD>                          cria o esqueleto dos testes de aceite
 *   npm run qa:atdd -- run <CARD> --phase red|green --run-id ID execução oficial (typecheck + Playwright + validação)
 *   npm run qa:atdd -- guide <CARD> --run-id ID                 guia para quem desenvolve
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import {
	isLocalRunId,
	missingEvidence,
	readRunManifest,
	renderDevGuide,
	specsHash,
	validateGreenRun,
	validateRedRun,
} from './lib/atdd.mjs';
import { readApprovals, selectedScenarioIds } from './lib/approvals.mjs';
import { loadFeatureScenarios, stepKindsOf } from './lib/atdd-feature.mjs';
import { ownershipOf } from './lib/ownership.mjs';

const ROOT = process.cwd();
const [command, card, ...rest] = process.argv.slice(2);

function fail(message) {
	console.error(`qa-atdd: ${message}`);
	process.exit(1);
}

function option(name) {
	const index = rest.indexOf(`--${name}`);
	return index >= 0 ? rest[index + 1] : undefined;
}

if (!card || !/^[A-Z][A-Z0-9]+-\d+$/.test(card)) fail('card inválido. Uso: npm run qa:atdd -- <skeleton|run|guide> PROJ-123');

const config = parseYaml(readFileSync(path.join(ROOT, '.agents/project/qa-project.yaml'), 'utf-8'));
if (!config.atdd) fail('bloco atdd ausente no qa-project.yaml.');
const ownership = ownershipOf(config);
if (!ownership) fail('bloco ownership ausente no qa-project.yaml.');
if (!(config.jira?.project_keys ?? []).includes(card.split('-')[0])) fail(`card ${card} fora dos projetos permitidos.`);

const statePath = path.join(ROOT, 'qa', 'runs', card, 'state.json');
const state = existsSync(statePath) ? JSON.parse(readFileSync(statePath, 'utf-8')) : null;
const specsDir = config.atdd.specs_dir.replaceAll('{CARD}', card);
const guidePath = path.join(ROOT, config.atdd.dev_guide.replaceAll('{CARD}', card));

function loadFeature() {
	const loaded = loadFeatureScenarios(ROOT, card, config.zephyr.priorities);
	if (loaded.error) fail(loaded.error);
	return loaded;
}

function selectedScenarios() {
	if (state?.atdd?.scenarios?.length) return state.atdd.scenarios;
	const approvals = readApprovals(ROOT, config, card);
	return approvals ? selectedScenarioIds(approvals.data) : [];
}

const escape = (value) => value.replaceAll('\\', '\\\\').replaceAll("'", "\\'");

switch (command) {
	case 'skeleton': {
		const selected = selectedScenarios();
		if (selected.length === 0) fail('nenhum cenário com decisão "automatizar" em <CARD>-APROVACOES.md.');
		const { featureName, items } = loadFeature();
		const target = path.join(ROOT, specsDir, `${card}.spec.ts`);
		const allowed = ownership.automation.owned_paths.some((owned) => specsDir.startsWith(`${owned}/`));
		if (!allowed) fail(`specs_dir (${specsDir}) está fora dos diretórios do agente (${ownership.automation.owned_paths.join(', ')}).`);
		if (existsSync(target)) fail(`${path.relative(ROOT, target)} já existe. O esqueleto nunca sobrescreve arquivo.`);
		const fixtures = path.relative(path.dirname(target), path.join(ROOT, config.stack.root, 'fixtures')).replaceAll(path.sep, '/');
		const evidence = path.relative(path.dirname(target), path.join(ROOT, 'shared', 'evidence-step')).replaceAll(path.sep, '/');
		const registryPath = path.join(ROOT, ownership.zephyr.owned_registry.replaceAll('{CARD}', card));
		const ownedCases = existsSync(registryPath) ? (JSON.parse(readFileSync(registryPath, 'utf-8')).cases ?? []) : [];
		const tests = items
			.filter((item) => selected.includes(item.id))
			.map((item) => {
				const risk = item.tags.find((tag) => ['@critical', '@high', '@medium'].includes(tag));
				const key = ownedCases.find((entry) => entry.name === item.name)?.key;
				const tags = [`@${card}`, `@${item.id}`, risk, key ? `@${key}` : null].filter(Boolean).map((tag) => `'${tag}'`).join(', ');
				const steps = item.steps
					.map((step) => `\t\tawait evidenceStep(page, '${escape(`${step.keyword} ${step.text}`)}', async () => {\n\t\t\tpending('${escape(`${step.keyword} ${step.text}`)}');\n\t\t});`)
					.join('\n');
				return `\ttest(\n\t\t'${escape(item.name)}',\n\t\t{ tag: [${tags}] },\n\t\tasync ({ page }) => {\n${steps}\n\t\t},\n\t);`;
			});
		const source = `import { test } from '${fixtures}';
import { evidenceStep } from '${evidence}';

/**
 * Testes de aceite de ${card} (ATDD), gerados por \`npm run qa:atdd -- skeleton ${card}\`.
 *
 * Cada passo precisa ser ligado a Page Objects, flows ou clientes de API existentes (apenas importando).
 * Enquanto houver PENDENTE_LIGAR, o teste falha por execução, não por asserção, e NÃO vale como prova vermelha.
 * A prova vermelha exige que o teste ligue o fluxo e falhe em um expect() de comportamento ainda não atendido.
 */
function pending(step: string): never {
\tthrow new Error(\`PENDENTE_LIGAR: \${step}\`);
}

test.describe('${escape(featureName)}', () => {
${tests.join('\n\n')}
});
`;
		mkdirSync(path.dirname(target), { recursive: true });
		writeFileSync(target, source);
		console.log(`qa-atdd: esqueleto criado em ${path.relative(ROOT, target)} (${tests.length} teste(s): ${selected.join(', ')}).`);
		console.log('  próximo passo: ligar cada passo aos Page Objects e rodar a prova vermelha.');
		break;
	}

	case 'run': {
		const phase = option('phase');
		const runId = option('run-id');
		if (!['red', 'green'].includes(phase)) fail('informe --phase red|green.');
		if (!runId || !/^[A-Za-z0-9._-]+$/.test(runId) || isLocalRunId(runId)) fail('informe --run-id oficial (sem prefixo dev-).');
		if (!state?.atdd) fail('modo ATDD não definido. Entre em AUTOMATION: qa:state advance <CARD> AUTOMATION.');
		const expectedState = phase === 'red' ? 'RED' : 'RUN';
		if (state.state !== expectedState) fail(`a fase ${phase} só roda no estado ${expectedState} (atual: ${state.state}).`);
		if (phase === 'red' && state.atdd.mode !== 'red-first') fail('fase red só existe no modo red-first.');

		const typecheck = spawnSync('npm', ['run', 'typecheck'], { cwd: ROOT, stdio: 'inherit' });
		if (typecheck.status !== 0) fail('typecheck falhou; a execução oficial não começa.');

		const ownedPaths = ownership.automation.owned_paths;
		const hash = specsHash(ROOT, ownedPaths, card);
		if (hash.files.length === 0) fail(`nenhum teste de aceite de ${card} em ${ownedPaths.join(', ')}. Rode o skeleton primeiro.`);
		console.log(`qa-atdd: executando fase ${phase} (${runId}) em ${specsDir}`);
		const playwright = spawnSync('npx', ['playwright', 'test', specsDir], {
			cwd: ROOT,
			stdio: 'inherit',
			env: {
				...process.env,
				E2E_RUN_ID: runId,
				E2E_ATDD_PHASE: phase,
				E2E_TYPECHECK_STATUS: 'passed',
				E2E_RUNNER: 'qa-atdd',
				E2E_SPECS_SHA256: hash.sha256,
			},
		});
		if (playwright.error) fail(`não foi possível executar o Playwright: ${playwright.error.message}`);

		const loaded = readRunManifest(ROOT, config, card, runId);
		if (loaded.error) fail(`execução sem evidência: ${loaded.error}. Os testes precisam das tags @${card} e @Sxx.`);
		if (phase === 'red') {
			const result = validateRedRun(loaded.manifest, state.atdd.scenarios, stepKindsOf(loadFeature().items));
			const noEvidence = missingEvidence(ROOT, config, card, runId, loaded.manifest, 'FAIL');
			if (noEvidence.length) {
				result.valid = false;
				result.checks.push({ id: 'atdd.red.evidence', ok: false, message: `evidência ausente: ${noEvidence.join('; ')}` });
			}
			for (const item of result.checks) console.log(`  ${item.ok ? 'OK' : 'ERRO'} ${item.id}: ${item.message}`);
			console.log(`  vermelhos: ${result.red.join(', ') || '(nenhum)'}; já atendidos: ${result.alreadySatisfied.join(', ') || '(nenhum)'}`);
			console.log(result.valid ? `qa-atdd: prova vermelha válida. Próximo: guide e advance RED AWAITING_DEV --run-id ${runId}` : 'qa-atdd: prova vermelha INVÁLIDA. Corrija os testes (volte para AUTOMATION).');
			process.exit(result.valid ? 0 : 1);
		}
		const checks = validateGreenRun(loaded.manifest, state.atdd.scenarios);
		for (const item of checks) console.log(`  ${item.ok ? 'OK' : 'ERRO'} ${item.id}: ${item.message}`);
		const ok = checks.every((item) => item.ok);
		console.log(ok ? `qa-atdd: execução verde. Próximo: advance RUN REPORT --run-id ${runId}` : 'qa-atdd: execução com falha. Registre com advance RUN REPORT --run-id e deixe o A3 diagnosticar.');
		process.exit(ok ? 0 : 1);
		break;
	}

	case 'guide': {
		const runId = option('run-id');
		const selected = selectedScenarios();
		if (selected.length === 0) fail('nenhum cenário com decisão "automatizar" em <CARD>-APROVACOES.md.');
		const loaded = runId ? readRunManifest(ROOT, config, card, runId) : { manifest: null };
		if (loaded.error) fail(loaded.error);
		const { featureName, items } = loadFeature();
		const phase = loaded.manifest?.atddPhase ?? 'red';
		const guide = renderDevGuide({
			card,
			summary: `Funcionalidade: ${featureName}`,
			items,
			selected,
			manifest: loaded.manifest,
			phase,
			atdd: state?.atdd ?? { mode: 'red-first' },
			commands: config.atdd.commands,
			runId: runId ?? 'ID_DA_EXECUCAO',
		});
		mkdirSync(path.dirname(guidePath), { recursive: true });
		writeFileSync(guidePath, guide);
		console.log(`qa-atdd: guia gerado em ${path.relative(ROOT, guidePath)} (${selected.length} cenário(s)).`);
		break;
	}

	default:
		fail('comando inválido. Use skeleton, run ou guide.');
}

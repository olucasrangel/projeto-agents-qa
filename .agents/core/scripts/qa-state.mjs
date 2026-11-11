#!/usr/bin/env node
/**
 * Estado e gates de uma execução `#qa-run`. O estado fica em
 * `qa/runs/<CARD>/state.json` para o fluxo sobreviver à troca de sessão.
 *
 * Uso:
 *   npm run qa:state -- init <CARD>
 *   npm run qa:state -- record-discovery <CARD>
 *   npm run qa:state -- status <CARD>
 *   npm run qa:state -- advance <CARD> <ESTADO> [--note "texto"]
 *   npm run qa:state -- gate <CARD> <G1|G2|G3> --by "Nome" [--artifact caminho]
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import {
	ATDD_MODES,
	automatedScenarios,
	missingEvidence,
	officialRunProblems,
	readRunManifest,
	scanSpecs,
	specsHash,
	validateGreenRun,
	validateRedRun,
} from './lib/atdd.mjs';
import { loadFeatureScenarios, stepKindsOf } from './lib/atdd-feature.mjs';
import { approvedScope, atddModeOf, inScope, readApprovals, selectedScenarioIds } from './lib/approvals.mjs';
import {
	canonicalArtifact,
	formatValidation,
	GATE_STATES,
	invalidatedGatesForTransition,
	sha256,
	validateDiscoveryManifest,
	validateGate,
} from './lib/gate-validation.mjs';

const PROJECT_ROOT = process.cwd();
const PROJECT_CONFIG = path.join(PROJECT_ROOT, '.agents/project/qa-project.yaml');
const RUNS_DIR = path.join('qa', 'runs');
const MAX_AUTOMATION_CYCLES = 3;

const TRANSITIONS = {
	DISCOVERY: ['ALIGNMENT'],
	ALIGNMENT: ['BDD'],
	BDD: ['AWAITING_G1'],
	AWAITING_G1: ['ZEPHYR', 'BDD'],
	ZEPHYR: ['AWAITING_G2'],
	AWAITING_G2: ['AUTOMATION_DECISION', 'ZEPHYR'],
	AUTOMATION_DECISION: ['AUTOMATION', 'DONE'],
	// ATDD: red-first passa por RED (prova vermelha) e AWAITING_DEV (dev implementa).
	// verify-existing (funcionalidade já entregue) vai direto para RUN.
	AUTOMATION: ['RED', 'RUN'],
	RED: ['AWAITING_DEV', 'AUTOMATION'],
	AWAITING_DEV: ['RUN'],
	RUN: ['REPORT'],
	REPORT: ['AWAITING_G3', 'AUTOMATION', 'AWAITING_DEV', 'DONE'],
	AWAITING_G3: ['DELIVERY', 'AUTOMATION'],
	DELIVERY: ['DONE'],
	DONE: [],
};

/** Gate que precisa estar registrado para sair de cada estado de espera. */
const REQUIRED_GATE = {
	'AWAITING_G1->ZEPHYR': 'G1',
	'AWAITING_G2->AUTOMATION_DECISION': 'G2',
	'AWAITING_G3->DELIVERY': 'G3',
};

function fail(message) {
	console.error(`qa-state: ${message}`);
	process.exit(1);
}

function option(args, name) {
	const index = args.indexOf(`--${name}`);
	return index >= 0 ? args[index + 1] : undefined;
}

function validateCard(card) {
	if (!card || !/^[A-Z][A-Z0-9]+-\d+$/.test(card)) {
		fail(`card inválido: ${card ?? '(vazio)'}. Use o formato PROJ-123.`);
	}
	if (existsSync(PROJECT_CONFIG)) {
		const config = parseYaml(readFileSync(PROJECT_CONFIG, 'utf-8'));
		const allowed = config.jira?.project_keys ?? [];
		if (allowed.length && !allowed.includes(card.split('-')[0])) fail(`projeto do card ${card} não permitido. Use: ${allowed.join(', ')}.`);
	}
}

function statePath(card) {
	return path.join(RUNS_DIR, card, 'state.json');
}

function load(card) {
	const file = statePath(card);
	if (!existsSync(file)) fail(`execução ${card} não iniciada. Rode: init ${card}`);
	return JSON.parse(readFileSync(file, 'utf-8'));
}

function save(state) {
	state.updatedAt = new Date().toISOString();
	writeFileSync(statePath(state.card), `${JSON.stringify(state, null, '\t')}\n`);
}

function print(state) {
	const gates = Object.entries(state.gates)
		.map(([gate, info]) => `${gate} por ${info.by} em ${info.at}`)
		.join('; ');
	console.log(`${state.card}: ${state.state}`);
	console.log(`  próximos: ${TRANSITIONS[state.state].join(', ') || '(fim)'}`);
	console.log(`  gates: ${gates || 'nenhum'}`);
	console.log(`  ciclos de automação: ${state.automationCycles}/${MAX_AUTOMATION_CYCLES}`);
	if (state.atdd) {
		const red = state.atdd.red ? `vermelho ${state.atdd.red.runId} (${state.atdd.red.red.length} cenário(s))` : 'sem prova vermelha';
		const green = state.atdd.green ? `verde ${state.atdd.green.runId} (${state.atdd.green.passed ? 'ok' : 'falhou'})` : 'sem execução final';
		console.log(`  ATDD: ${state.atdd.mode}; cenários ${state.atdd.scenarios.join(', ')}; ${red}; ${green}`);
	}
}

function projectConfig() {
	return parseYaml(readFileSync(PROJECT_CONFIG, 'utf-8'));
}

/** Regras do ciclo ATDD aplicadas a cada transição. Falha antes de qualquer gravação. */
function advanceAtdd(state, target, args) {
	const from = state.state;
	const config = projectConfig();
	const ownedPaths = config.ownership?.automation?.owned_paths ?? [];
	const runId = option(args, 'run-id');
	const now = new Date().toISOString();
	const currentSpecs = () => specsHash(PROJECT_ROOT, ownedPaths, state.card).sha256;

	if (from === 'AUTOMATION_DECISION' && target === 'AUTOMATION') {
		const approvals = readApprovals(PROJECT_ROOT, config, state.card);
		if (!approvals) fail(`arquivo de aprovações ausente. Rode: npm run qa:approvals -- sync ${state.card}`);
		// Tudo vem do arquivo único; as flags só existem como atalho e não podem contradizê-lo.
		const mode = option(args, 'atdd-mode') ?? atddModeOf(approvals.data);
		if (!ATDD_MODES.includes(mode)) {
			fail(`marque exatamente um modo ATDD (${ATDD_MODES.join(' ou ')}) em <CARD>-APROVACOES.md. red-first: testes de aceite escritos antes da funcionalidade; verify-existing: funcionalidade já entregue.`);
		}
		const fileMode = atddModeOf(approvals.data);
		if (fileMode && fileMode !== mode) fail(`--atdd-mode ${mode} contradiz o modo marcado em <CARD>-APROVACOES.md (${fileMode}).`);
		const confirmedBy = (option(args, 'by') ?? approvals.data.approver)?.trim();
		if (!confirmedBy) fail('preencha o Nome do aprovador em <CARD>-APROVACOES.md: é o QA que confirma o modo ATDD.');
		const reason = (option(args, 'reason') ?? approvals.data.atdd.reason)?.trim();
		if (mode === 'verify-existing' && !reason) fail('verify-existing exige o Motivo em <CARD>-APROVACOES.md explicando por que a funcionalidade já existe.');
		const scenarios = selectedScenarioIds(approvals.data);
		if (scenarios.length === 0) fail('nenhum cenário com decisão "automatizar" em <CARD>-APROVACOES.md.');
		const outOfScope = scenarios.filter((id) => !inScope(approvedScope(approvals.data), id));
		if (outOfScope.length) fail(`cenário(s) marcado(s) para automatizar sem aprovação no G1: ${outOfScope.join(', ')}.`);
		state.atdd = { mode, confirmedBy, ...(reason ? { reason } : {}), scenarios, decidedAt: now };
		return;
	}

	if (from === 'AUTOMATION' && (target === 'RED' || target === 'RUN')) {
		if (!state.atdd) fail('modo ATDD não definido. Marque o modo em <CARD>-APROVACOES.md e entre em AUTOMATION.');
		if (target === 'RED' && state.atdd.mode !== 'red-first') fail('RED só existe no modo red-first.');
		if (target === 'RUN' && state.atdd.mode === 'red-first') {
			if (!state.atdd.red) fail('no modo red-first a prova vermelha oficial (RED) precisa existir antes da execução final.');
			if (state.atdd.red.specsSha256 !== currentSpecs()) {
				fail('os testes de aceite mudaram depois da prova vermelha. O QA precisa reconhecer a mudança: qa:state atdd-ack <CARD> --by "Nome" --reason "motivo".');
			}
		}
		const specs = scanSpecs(PROJECT_ROOT, ownedPaths, state.card);
		const missing = state.atdd.scenarios.filter((id) => !specs.has(id));
		if (missing.length) fail(`cenários sem teste de aceite com a tag @Sxx em ${ownedPaths.join(', ')}: ${missing.join(', ')}`);
		return;
	}

	if (from === 'RED' && target === 'AWAITING_DEV') {
		const loaded = readRunManifest(PROJECT_ROOT, config, state.card, runId);
		if (loaded.error) fail(`prova vermelha: ${loaded.error}. Informe --run-id da execução vermelha oficial.`);
		const problems = officialRunProblems(loaded.manifest, currentSpecs());
		if (problems.length) fail(`prova vermelha não é oficial:\n  - ${problems.join('\n  - ')}`);
		const feature = loadFeatureScenarios(PROJECT_ROOT, state.card, config.zephyr?.priorities);
		if (feature.error) fail(feature.error);
		const result = validateRedRun(loaded.manifest, state.atdd.scenarios, stepKindsOf(feature.items));
		if (!result.valid) {
			fail(`prova vermelha inválida:\n  - ${result.checks.filter((item) => !item.ok).map((item) => item.message).join('\n  - ')}`);
		}
		const noEvidence = missingEvidence(PROJECT_ROOT, config, state.card, runId, loaded.manifest, 'FAIL');
		if (noEvidence.length) fail(`prova vermelha sem evidência em disco:\n  - ${noEvidence.join('\n  - ')}`);
		const guide = path.join(PROJECT_ROOT, (config.atdd?.dev_guide ?? '').replaceAll('{CARD}', state.card));
		if (!config.atdd?.dev_guide || !existsSync(guide)) fail('guia de desenvolvimento ausente. Gere com: npm run qa:atdd -- guide <CARD> --run-id <runId>');
		state.atdd.red = {
			runId,
			at: now,
			startedAt: loaded.manifest.startedAt,
			finishedAt: loaded.manifest.finishedAt,
			manifestSha256: loaded.sha256,
			red: result.red,
			alreadySatisfied: result.alreadySatisfied,
			specsSha256: currentSpecs(),
		};
		return;
	}

	if (from === 'AWAITING_DEV' && target === 'RUN' && state.atdd?.red && state.atdd.red.specsSha256 !== currentSpecs()) {
		fail('os testes de aceite mudaram durante o desenvolvimento. O QA precisa reconhecer a mudança: qa:state atdd-ack <CARD> --by "Nome" --reason "motivo".');
	}

	if (from === 'REPORT' && target === 'AWAITING_DEV' && state.atdd?.mode !== 'red-first') {
		fail('devolver ao desenvolvimento só faz sentido no modo red-first. Em verify-existing, falha de comportamento é bug de produto para o QA.');
	}

	if (from === 'RUN' && target === 'REPORT') {
		if (!state.atdd) fail('modo ATDD não definido para este card.');
		const loaded = readRunManifest(PROJECT_ROOT, config, state.card, runId);
		if (loaded.error) fail(`execução final: ${loaded.error}. Informe --run-id.`);
		if (loaded.manifest.atddPhase !== 'green') fail('a execução final deve declarar a fase green (E2E_ATDD_PHASE=green).');
		const problems = officialRunProblems(loaded.manifest, currentSpecs());
		if (problems.length) fail(`execução final não é oficial:\n  - ${problems.join('\n  - ')}`);
		if (state.atdd.mode === 'red-first' && !(Date.parse(state.atdd.red?.finishedAt) < Date.parse(loaded.manifest.startedAt))) {
			fail('a execução verde precisa ter começado depois do fim da execução vermelha.');
		}
		const green = validateGreenRun(loaded.manifest, state.atdd.scenarios);
		state.atdd.green = {
			runId,
			at: now,
			startedAt: loaded.manifest.startedAt,
			finishedAt: loaded.manifest.finishedAt,
			manifestSha256: loaded.sha256,
			result: loaded.manifest.result,
			passed: green.every((item) => item.ok),
			specsSha256: currentSpecs(),
		};
	}
}

const [command, card, ...rest] = process.argv.slice(2);
validateCard(card);

switch (command) {
	case 'init': {
		if (existsSync(statePath(card))) {
			print(load(card));
			break;
		}
		mkdirSync(path.join(RUNS_DIR, card), { recursive: true });
		const now = new Date().toISOString();
		const state = {
			card,
			state: 'DISCOVERY',
			createdAt: now,
			updatedAt: now,
			automationCycles: 0,
			history: [],
			gates: {},
		};
		save(state);
		print(state);
		break;
	}
	case 'record-discovery': {
		const state = load(card);
		const discoveryFile = path.join(PROJECT_ROOT, 'qa', 'cards', card, 'context', 'discovery.json');
		if (!existsSync(discoveryFile)) fail(`manifesto de discovery ausente: ${path.relative(PROJECT_ROOT, discoveryFile)}`);
		let manifest;
		try { manifest = JSON.parse(readFileSync(discoveryFile, 'utf-8')); }
		catch (error) { fail(`discovery.json inválido: ${error.message}`); }
		const invalid = validateDiscoveryManifest(manifest, card, PROJECT_ROOT).filter((item) => !item.ok);
		if (invalid.length) fail(`discovery inválido:\n  - ${invalid.map((item) => item.message).join('\n  - ')}`);
		const currentHash = sha256(readFileSync(discoveryFile));
		if (state.discovery?.sha256 && state.discovery.sha256 !== currentHash && state.state !== 'DISCOVERY') {
			state.history.push({ from: state.state, to: 'ALIGNMENT', at: new Date().toISOString(), note: 'discovery alterado; novo alinhamento obrigatório' });
			state.state = 'ALIGNMENT';
			state.gates = {};
		}
		state.discovery = { mode: manifest.mode, artifact: path.relative(PROJECT_ROOT, discoveryFile), sha256: currentHash, recordedAt: new Date().toISOString() };
		save(state);
		print(state);
		break;
	}
	case 'atdd-ack': {
		// Mudança deliberada nos testes de aceite depois da prova vermelha. Só o QA registra; o G3 lista cada ack.
		const state = load(card);
		const by = option(rest, 'by')?.trim();
		const reason = option(rest, 'reason')?.trim();
		if (!state.atdd?.red) fail('não há prova vermelha registrada para reconhecer mudança nos testes.');
		if (!['AUTOMATION', 'AWAITING_DEV'].includes(state.state)) fail(`atdd-ack só vale em AUTOMATION ou AWAITING_DEV (estado atual: ${state.state}).`);
		if (!by || !reason) fail('informe --by "Nome do QA" e --reason "motivo da mudança nos testes de aceite".');
		const ownedPaths = projectConfig().ownership?.automation?.owned_paths ?? [];
		const current = specsHash(PROJECT_ROOT, ownedPaths, card).sha256;
		if (current === state.atdd.red.specsSha256) fail('os testes não mudaram desde a prova vermelha; não há o que reconhecer.');
		state.atdd.acknowledgements = [...(state.atdd.acknowledgements ?? []), { by, reason, at: new Date().toISOString(), from: state.atdd.red.specsSha256, to: current }];
		state.atdd.red.specsSha256 = current;
		delete state.atdd.green;
		save(state);
		print(state);
		break;
	}
	case 'atdd-remode': {
		// Atualiza modo e cenários do ATDD antes de qualquer execução registrada, a partir do que o QA marcou em <CARD>-APROVACOES.md.
		const state = load(card);
		if (state.state !== 'AUTOMATION') fail(`atdd-remode só vale em AUTOMATION (estado atual: ${state.state}).`);
		if (!state.atdd) fail('modo ATDD não definido.');
		if (state.atdd.red || state.atdd.green) fail('já existe execução ATDD registrada; trocar o modo agora invalidaria a prova.');
		const config = projectConfig();
		const approvals = readApprovals(PROJECT_ROOT, config, card);
		if (!approvals) fail('arquivo de aprovações ausente.');
		const mode = atddModeOf(approvals.data);
		if (!ATDD_MODES.includes(mode)) fail('marque exatamente um modo ATDD em <CARD>-APROVACOES.md.');
		const by = (option(rest, 'by') ?? approvals.data.approver)?.trim();
		if (!by) fail('informe --by "Nome do QA" ou preencha o Nome do aprovador em <CARD>-APROVACOES.md.');
		const reason = approvals.data.atdd.reason?.trim();
		if (mode === 'verify-existing' && !reason) fail('verify-existing exige o Motivo em <CARD>-APROVACOES.md.');
		const scenarios = selectedScenarioIds(approvals.data);
		if (scenarios.length === 0) fail('nenhum cenário com decisão "automatizar" em <CARD>-APROVACOES.md.');
		const outOfScope = scenarios.filter((id) => !inScope(approvedScope(approvals.data), id));
		if (outOfScope.length) fail(`cenário(s) marcado(s) para automatizar sem aprovação no G1: ${outOfScope.join(', ')}.`);
		if (mode === state.atdd.mode && scenarios.join() === state.atdd.scenarios.join()) fail('modo e cenários já estão como em <CARD>-APROVACOES.md; nada a atualizar.');
		state.atdd = {
			mode,
			confirmedBy: by,
			...(reason ? { reason } : {}),
			scenarios,
			decidedAt: new Date().toISOString(),
			modeChanges: [...(state.atdd.modeChanges ?? []), { from: state.atdd.mode, to: mode, scenariosFrom: state.atdd.scenarios, scenariosTo: scenarios, by, at: new Date().toISOString() }],
		};
		save(state);
		print(state);
		break;
	}
	case 'gate-ack': {
		// O artefato de um gate mudou depois da aprovação (ex.: renomeação de casos). Só o QA reconhece a mudança; o G3 lista cada ack.
		const state = load(card);
		const gate = rest[0];
		const by = option(rest, 'by')?.trim();
		const reason = option(rest, 'reason')?.trim();
		const record = state.gates?.[gate];
		if (!record) fail(`${gate ?? '(gate)'} não está registrado em ${card}.`);
		if (!['AUTOMATION', 'RUN', 'REPORT', 'AWAITING_G3'].includes(state.state)) fail(`gate-ack só vale entre AUTOMATION e AWAITING_G3 (estado atual: ${state.state}).`);
		if (!by || !reason) fail('informe --by "Nome do QA" e --reason "o que mudou no artefato e por quê". O agente não executa este comando pelo QA.');
		const artifact = path.resolve(PROJECT_ROOT, record.artifact);
		const current = sha256(readFileSync(artifact));
		if (current === record.sha256) fail('o artefato não mudou desde a aprovação; não há o que reconhecer.');
		record.acknowledgements = [...(record.acknowledgements ?? []), { by, reason, at: new Date().toISOString(), from: record.sha256, to: current }];
		record.sha256 = current;
		save(state);
		print(state);
		break;
	}
	case 'status':
		print(load(card));
		break;
	case 'advance': {
		const state = load(card);
		const target = rest[0];
		if (!TRANSITIONS[state.state].includes(target)) {
			fail(
				`transição ${state.state} -> ${target ?? '(vazio)'} não permitida. Próximos: ${TRANSITIONS[state.state].join(', ') || '(fim)'}`,
			);
		}
		if (state.state === 'DISCOVERY' && target === 'ALIGNMENT') {
			const discoveryFile = path.join(PROJECT_ROOT, 'qa', 'cards', card, 'context', 'discovery.json');
			if (!existsSync(discoveryFile)) {
				fail(`manifesto de discovery ausente: ${path.relative(PROJECT_ROOT, discoveryFile)}`);
			}
			let manifest;
			try {
				manifest = JSON.parse(readFileSync(discoveryFile, 'utf-8'));
			} catch (error) {
				fail(`discovery.json inválido: ${error.message}`);
			}
			const invalid = validateDiscoveryManifest(manifest, card, PROJECT_ROOT).filter((item) => !item.ok);
			if (invalid.length) {
				fail(`discovery inválido:\n  - ${invalid.map((item) => item.message).join('\n  - ')}`);
			}
			state.discovery = {
				mode: manifest.mode,
				artifact: path.relative(PROJECT_ROOT, discoveryFile),
				sha256: sha256(readFileSync(discoveryFile)),
				recordedAt: new Date().toISOString(),
			};
		}
		advanceAtdd(state, target, rest);
		const gate = REQUIRED_GATE[`${state.state}->${target}`];
		if (gate && !state.gates[gate]) {
			fail(`${gate} não registrado. O QA precisa aprovar antes: gate ${card} ${gate} --by "Nome"`);
		}
		if (gate) {
			const validation = validateGate({ root: PROJECT_ROOT, card, gate, runId: state.gates[gate].runId, state });
			if (!validation.valid) fail(`gate ${gate} ficou obsoleto:\n${formatValidation(validation)}`);
		}
		for (const invalidatedGate of invalidatedGatesForTransition(state.state, target)) delete state.gates[invalidatedGate];
		// Voltar ao desenvolvimento ou à automação descarta a execução final anterior: ela deixou de valer.
		if (state.state === 'REPORT' && ['AWAITING_DEV', 'AUTOMATION'].includes(target) && state.atdd) delete state.atdd.green;
		if ((state.state === 'REPORT' || state.state === 'RED') && target === 'AUTOMATION') {
			if (state.automationCycles >= MAX_AUTOMATION_CYCLES) {
				fail(`limite de ${MAX_AUTOMATION_CYCLES} ciclos de automação atingido; devolva ao QA com o diagnóstico.`);
			}
			state.automationCycles += 1;
		}
		state.history.push({
			from: state.state,
			to: target,
			at: new Date().toISOString(),
			...(option(rest, 'note') ? { note: option(rest, 'note') } : {}),
		});
		state.state = target;
		save(state);
		print(state);
		break;
	}
	case 'gate': {
		const state = load(card);
		const gate = rest[0];
		const approvalsFile = readApprovals(PROJECT_ROOT, projectConfig(), card);
		const by = option(rest, 'by') ?? approvalsFile?.data.approver;
		const runId = option(rest, 'run-id') ?? (gate === 'G3' ? approvalsFile?.data.g3.runId || undefined : undefined);
		if (!GATE_STATES[gate]) fail(`gate inválido: ${gate}. Use G1, G2 ou G3.`);
		if (state.state !== GATE_STATES[gate]) {
			fail(`${gate} só pode ser registrado em ${GATE_STATES[gate]} (estado atual: ${state.state}).`);
		}
		if (!by?.trim()) fail('preencha o Nome do aprovador em <CARD>-APROVACOES.md (ou use --by "Nome").');

		const validation = validateGate({ root: PROJECT_ROOT, card, gate, runId, state });
		if (!validation.valid) fail(`gate bloqueado pela validação:\n${formatValidation(validation)}`);

		const config = parseYaml(readFileSync(PROJECT_CONFIG, 'utf-8'));
		const canonical = canonicalArtifact(PROJECT_ROOT, config, card, gate, runId);
		if (!canonical || !existsSync(canonical)) fail(`artefato canônico de ${gate} não encontrado.`);
		const requested = option(rest, 'artifact');
		if (requested && path.resolve(PROJECT_ROOT, requested) !== canonical) {
			fail(`--artifact deve apontar para o artefato canônico: ${path.relative(PROJECT_ROOT, canonical)}`);
		}
		const checksSha256 = createHash('sha256')
			.update(JSON.stringify(validation.checks))
			.digest('hex');
		state.gates[gate] = {
			by: by.trim(),
			at: new Date().toISOString(),
			artifact: path.relative(PROJECT_ROOT, canonical),
			sha256: sha256(readFileSync(canonical)),
			validation: { schemaVersion: 1, checksSha256 },
			...(runId ? { runId } : {}),
		};
		save(state);
		print(state);
		break;
	}
	default:
		fail('comando inválido. Use init, record-discovery, status, advance ou gate.');
}

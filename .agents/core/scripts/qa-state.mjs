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
	AUTOMATION: ['RUN'],
	RUN: ['REPORT'],
	REPORT: ['AWAITING_G3', 'AUTOMATION', 'DONE'],
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
		const gate = REQUIRED_GATE[`${state.state}->${target}`];
		if (gate && !state.gates[gate]) {
			fail(`${gate} não registrado. O QA precisa aprovar antes: gate ${card} ${gate} --by "Nome"`);
		}
		if (gate) {
			const validation = validateGate({ root: PROJECT_ROOT, card, gate, runId: state.gates[gate].runId, state });
			if (!validation.valid) fail(`gate ${gate} ficou obsoleto:\n${formatValidation(validation)}`);
		}
		for (const invalidatedGate of invalidatedGatesForTransition(state.state, target)) delete state.gates[invalidatedGate];
		if (state.state === 'REPORT' && target === 'AUTOMATION') {
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
		const by = option(rest, 'by');
		const runId = option(rest, 'run-id');
		if (!GATE_STATES[gate]) fail(`gate inválido: ${gate}. Use G1, G2 ou G3.`);
		if (state.state !== GATE_STATES[gate]) {
			fail(`${gate} só pode ser registrado em ${GATE_STATES[gate]} (estado atual: ${state.state}).`);
		}
		if (!by?.trim()) fail('informe quem aprovou: --by "Nome"');

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

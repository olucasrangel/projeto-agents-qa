#!/usr/bin/env node
/**
 * Estado e gates de uma execução `#qa-run`. O estado fica em
 * `qa/runs/<CARD>/state.json` para o fluxo sobreviver à troca de sessão.
 *
 * Uso:
 *   npm run qa:state -- init <CARD>
 *   npm run qa:state -- status <CARD>
 *   npm run qa:state -- advance <CARD> <ESTADO> [--note "texto"]
 *   npm run qa:state -- gate <CARD> <G1|G2|G3> --by "Nome" [--artifact caminho]
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

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

const GATE_STATE = { G1: 'AWAITING_G1', G2: 'AWAITING_G2', G3: 'AWAITING_G3' };

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
		const gate = REQUIRED_GATE[`${state.state}->${target}`];
		if (gate && !state.gates[gate]) {
			fail(`${gate} não registrado. O QA precisa aprovar antes: gate ${card} ${gate} --by "Nome"`);
		}
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
		if (!GATE_STATE[gate]) fail(`gate inválido: ${gate}. Use G1, G2 ou G3.`);
		if (state.state !== GATE_STATE[gate]) {
			fail(`${gate} só pode ser registrado em ${GATE_STATE[gate]} (estado atual: ${state.state}).`);
		}
		if (!by) fail('informe quem aprovou: --by "Nome"');
		const artifact = option(rest, 'artifact');
		const record = { by, at: new Date().toISOString() };
		if (artifact) {
			if (!existsSync(artifact)) fail(`artefato não encontrado: ${artifact}`);
			record.artifact = artifact;
			record.sha256 = createHash('sha256').update(readFileSync(artifact)).digest('hex');
		}
		state.gates[gate] = record;
		save(state);
		print(state);
		break;
	}
	default:
		fail('comando inválido. Use init, status, advance ou gate.');
}

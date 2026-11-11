#!/usr/bin/env node
/**
 * Arquivo único de aprovações do card (qa/approvals/<CARD>/<CARD>-APROVACOES.md).
 *
 *   npm run qa:approvals -- sync <CARD>     cria o arquivo e monta pendências e cenários (preserva o que o QA marcou)
 *   npm run qa:approvals -- status <CARD>   mostra o que falta o QA marcar agora
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import { approvalsPath, approvedScope, atddModeOf, DECISION_OPTIONS, DECISIONS, inScope, parseApprovals, PENDENCY_OPTIONS, SCENARIO_G1_LABEL, SCENARIO_PUBLISH_LABEL, selectedScenarioIds } from './lib/approvals.mjs';
import { loadFeatureScenarios } from './lib/atdd-feature.mjs';
import { GATE_STATES, validateGate } from './lib/gate-validation.mjs';

const ROOT = process.cwd();
const [command, card] = process.argv.slice(2);

function fail(message) {
	console.error(`qa-approvals: ${message}`);
	process.exit(1);
}

if (!card || !/^[A-Z][A-Z0-9]+-\d+$/.test(card)) fail('card inválido. Uso: npm run qa:approvals -- <sync|status> PROJ-123');
const config = parseYaml(readFileSync(path.join(ROOT, '.agents/project/qa-project.yaml'), 'utf-8'));
if (!(config.jira?.project_keys ?? []).includes(card.split('-')[0])) fail(`card ${card} fora dos projetos permitidos.`);

const file = approvalsPath(ROOT, config, card);
const rel = (target) => path.relative(ROOT, target);

const block = (text, name) => {
	const start = `<!-- sync:${name}:start -->`;
	const end = `<!-- sync:${name}:end -->`;
	const i = text.indexOf(start);
	const j = text.indexOf(end);
	if (i < 0 || j < i) fail(`marcadores sync:${name} ausentes em ${rel(file)}.`);
	return { i: i + start.length, j, body: text.slice(i + start.length, j) };
};

const replaceBlock = (text, name, lines) => {
	const { i, j } = block(text, name);
	return `${text.slice(0, i)}\n${lines.join('\n')}\n${text.slice(j)}`;
};

function ensureFile() {
	if (existsSync(file)) return false;
	const template = readFileSync(path.join(ROOT, '.agents/project/templates/aprovacoes.template.md'), 'utf-8');
	mkdirSync(path.dirname(file), { recursive: true });
	writeFileSync(file, template.replaceAll('{CARD}', card));
	return true;
}

/** Itens numerados de "Pontos para decidir antes do G1" no review: [{ n, title }]. */
function reviewPendencies() {
	const reviewFile = path.join(ROOT, config.artifacts.bdd_review.replaceAll('{CARD}', card));
	if (!existsSync(reviewFile)) return [];
	const section = readFileSync(reviewFile, 'utf-8').match(/## Pontos para decidir antes do G1([\s\S]*?)(?:\n##|$)/i)?.[1] ?? '';
	return [...section.matchAll(/^(\d+)\. \*\*(.+?)\*\*/gm)].map((match) => ({ n: Number(match[1]), title: match[2].replace(/[.:\s]+$/, '') }));
}

const shortName = (name) => name.replace(/^\[[^\]]+\]\[[^\]]+\]\[[^\]]+\]\s*/, '').replace(/\|/g, '/').slice(0, 95);

const box = (on) => (on ? '[x]' : '[ ]');

/** Bloco de uma pendência do review: o QA marca uma opção e, se quiser, escreve uma observação. */
function pendencyBlock({ n, title }, old) {
	return [
		`### P${n} — ${title}`,
		`- ${box(old?.done)} ${PENDENCY_OPTIONS.accept}`,
		`- ${box(old?.rejected)} ${PENDENCY_OPTIONS.reject} (explique na observação)`,
		`Observação: ${old?.note ?? ''}`,
		'',
	];
}

/** Bloco de um cenário: todas as opções de decisão com [ ], para o QA só marcar o X. */
function scenarioBlock(item, old) {
	return [
		`### ${item.id} — ${shortName(item.name)}`,
		`Sugestão do agente: ${old?.suggestion ?? ''}`,
		'',
		`- ${box(old?.approvedG1)} ${SCENARIO_G1_LABEL} (só vale na aprovação parcial)`,
		`- ${box(old?.publish)} ${SCENARIO_PUBLISH_LABEL} (criar o caso do agente em Draft, na pasta com sufixo AUT)`,
		'',
		'Decisão de automação (marque uma):',
		...DECISION_OPTIONS.map(([option, meaning]) => `- ${box(old?.decision === option)} ${option} — ${meaning}`),
		`Justificativa (opcional): ${old?.justification ?? ''}`,
		'',
	];
}

function sync() {
	const created = ensureFile();
	let text = readFileSync(file, 'utf-8');
	const parsed = parseApprovals(text);

	// Pendências: um bloco por item do review; marcas e observações já existentes são preservadas.
	const oldPendencies = new Map(parsed.g1.pendencies.map((item) => [item.id, item]));
	const pendencies = reviewPendencies();
	const pendencyLines = pendencies.flatMap((item) => pendencyBlock(item, oldPendencies.get(`P${item.n}`)));
	text = replaceBlock(text, 'pendencias', pendencyLines.length ? pendencyLines : ['(sem pendências no review)']);

	// Cenários: um bloco por cenário do .feature; sugestão, marcas e justificativa já preenchidas são preservadas.
	const feature = loadFeatureScenarios(ROOT, card, config.zephyr?.priorities);
	let scenarioCount = 0;
	if (feature.error) {
		console.log(`qa-approvals: cenários não montados (${feature.error}).`);
	} else {
		const old = new Map(parsed.scenarios.map((row) => [row.id, row]));
		const lines = feature.items.flatMap((item) => scenarioBlock(item, old.get(item.id)));
		scenarioCount = feature.items.length;
		text = replaceBlock(text, 'cenarios', lines);
	}

	// Run-id da execução oficial mais recente: o agente só informa qual execução está em análise. A marca de aprovação é do QA.
	const statePath = path.join(ROOT, 'qa', 'runs', card, 'state.json');
	if (existsSync(statePath) && !parsed.g3.approved) {
		const runId = JSON.parse(readFileSync(statePath, 'utf-8')).atdd?.green?.runId;
		if (runId && parsed.g3.runId !== runId) text = text.replace(/^Run-id:[ \t]*.*$/m, `Run-id: ${runId}`);
	}
	writeFileSync(file, text);
	console.log(`qa-approvals: ${created ? 'arquivo criado' : 'arquivo atualizado'}: ${rel(file)} (${pendencies.length} pendência(s), ${scenarioCount} cenário(s)).`);
}

/** Ids de checks que dependem de uma marca do QA em <CARD>-APROVACOES.md. */
const QA_CHECKS = new Set(['G1.approvals-file', 'G1.approver', 'G1.human-decision', 'G1.partial-selection', 'G1.open-decisions', 'G1.rejected-decisions', 'G2.human-approval', 'G3.human-approval']);

function status() {
	const statePath = path.join(ROOT, 'qa', 'runs', card, 'state.json');
	if (!existsSync(statePath)) fail(`execução de ${card} não iniciada. Rode: npm run qa:state -- init ${card}`);
	const state = JSON.parse(readFileSync(statePath, 'utf-8'));
	if (!existsSync(file)) fail(`arquivo ausente: ${rel(file)}. Rode: npm run qa:approvals -- sync ${card}`);
	const data = parseApprovals(readFileSync(file, 'utf-8'));
	console.log(`${card}: estado ${state.state}`);
	console.log(`Arquivo único: ${rel(file)}\n`);

	const gate = Object.entries(GATE_STATES).find(([, awaiting]) => awaiting === state.state)?.[0];
	if (gate) {
		const result = validateGate({ root: ROOT, card, gate, runId: gate === 'G3' ? data.g3.runId : undefined, state });
		const mine = result.checks.filter((item) => !item.ok && QA_CHECKS.has(item.id));
		const others = result.checks.filter((item) => !item.ok && !QA_CHECKS.has(item.id));
		if (mine.length) {
			console.log(`Falta VOCÊ marcar em ${rel(file)} (${gate}):`);
			for (const item of mine) console.log(`  [ ] ${item.message}`);
		} else console.log(`Nada pendente para você marcar no ${gate}.`);
		if (others.length) {
			console.log('\nO agente ainda precisa resolver (não é com você):');
			for (const item of others) console.log(`  - ${item.message}`);
		}
		console.log(result.valid ? `\nTudo pronto. Diga ao agente: "registre o ${gate}".` : `\nQuando terminar de marcar, rode: npm run qa:approvals -- status ${card}`);
		return;
	}

	if (state.state === 'AUTOMATION_DECISION') {
		const scope = approvedScope(data);
		const inPlay = data.scenarios.filter((row) => inScope(scope, row.id));
		const undecided = inPlay.filter((row) => !DECISIONS.includes(row.decision));
		const mode = atddModeOf(data);
		console.log('Falta VOCÊ preencher em ' + rel(file) + ' (Automação):');
		if (!data.approver) console.log('  [ ] Nome do aprovador');
		if (!mode) console.log('  [ ] Modo ATDD: marque exatamente um (red-first ou verify-existing)');
		if (mode === 'verify-existing' && !data.atdd.reason) console.log('  [ ] Motivo do verify-existing');
		if (Array.isArray(scope) && scope.length === 0) console.log('  [ ] G1: aprove todos os cenários ou marque "Aprovado no G1" nos aprovados (só eles podem ser automatizados)');
		else if (data.scenarios.length === 0) console.log(`  [ ] Tabela de cenários vazia. Rode: npm run qa:approvals -- sync ${card}`);
		else if (undecided.length) console.log(`  [ ] Decisão em ${undecided.length} cenário(s): ${undecided.map((row) => row.id).join(', ')}`);
		if (data.scenarios.length && !undecided.length && selectedScenarioIds(data).length === 0) console.log('  [ ] Nenhum cenário marcado como "automatizar"');
		const ready = data.approver && mode && (mode !== 'verify-existing' || data.atdd.reason) && data.scenarios.length && !undecided.length && selectedScenarioIds(data).length;
		console.log(ready ? `\nTudo pronto. Selecionados: ${selectedScenarioIds(data).join(', ')}. Diga ao agente: "inicie a automação".` : '');
		return;
	}

	console.log(`No estado ${state.state} não há nada para você marcar. O próximo passo é do agente.`);
}

switch (command) {
	case 'sync':
		sync();
		break;
	case 'status':
		status();
		break;
	default:
		fail('comando inválido. Use sync ou status.');
}

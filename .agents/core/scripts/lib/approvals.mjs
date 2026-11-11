import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Arquivo único de aprovações do card: `qa/approvals/<CARD>/<CARD>-APROVACOES.md`.
 * É o único lugar onde o QA marca decisões (G1, G2, automação e G3). Os validadores
 * leem daqui; nenhum outro arquivo recebe aprovação.
 */

export const DECISIONS = ['automatizar', 'manter-manual', 'automatizar-depois', 'não-aplicável', 'bloqueado'];

export function approvalsPath(root, config, card) {
	const template = config.artifacts?.approvals_file ?? 'qa/approvals/{CARD}/{CARD}-APROVACOES.md';
	return path.join(root, template.replaceAll('{CARD}', card));
}

/** Linha de checklist marcada: `- [x] <rótulo>` (o rótulo é o início da linha). */
const checked = (text, label) => new RegExp(`^- \\[x\\] ${label}`, 'im').test(text);
const field = (text, pattern) => (text.match(pattern)?.[1] ?? '').trim();
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Opções de decisão de cada cenário, com a explicação que aparece ao lado no arquivo. */
export const DECISION_OPTIONS = [
	['automatizar', 'o agente cria o teste de aceite'],
	['manter-manual', 'continua como teste manual'],
	['automatizar-depois', 'fica para outra rodada (falta massa ou acesso)'],
	['não-aplicável', 'não se aplica a esta entrega'],
	['bloqueado', 'não dá para automatizar agora'],
];
export const PENDENCY_OPTIONS = { accept: 'Aceito a proposta do review', reject: 'Não aceito' };
export const SCENARIO_G1_LABEL = 'Aprovado no G1';
export const SCENARIO_PUBLISH_LABEL = 'Publicar no Zephyr';

/** Opção marcada: `- [x] <rótulo>` seguido de espaço ou fim de linha (assim `automatizar` não casa com `automatizar-depois`). */
const optionChecked = (lines, label) => lines.some((line) => new RegExp(`^- \\[x\\] ${escapeRegExp(label)}(?=\\s|$)`, 'i').test(line));

/** Divide o texto em blocos que começam em `### <prefixo><n> — <título>`. */
function headingBlocks(text, prefix) {
	const blocks = [];
	let current = null;
	for (const line of text.split(/\r?\n/)) {
		const heading = line.match(new RegExp(`^### (${prefix}\\d+) — (.*)$`));
		if (heading) {
			current = { id: heading[1], title: heading[2].trim(), lines: [] };
			blocks.push(current);
		} else if (/^(## |### |<!-- sync:)/.test(line)) current = null;
		else if (current) current.lines.push(line);
	}
	return blocks;
}

export function parseApprovals(text) {
	const scenarios = headingBlocks(text, 'S').map(({ id, title, lines }) => {
		const marked = DECISION_OPTIONS.map(([option]) => option).filter((option) => optionChecked(lines, option));
		return {
			id,
			description: title,
			suggestion: field(lines.join('\n'), /^Sugestão do agente:[ \t]*(.*)$/m),
			decision: marked.length > 1 ? 'múltiplas marcas' : (marked[0] ?? ''),
			justification: field(lines.join('\n'), /^Justificativa[^:\n]*:[ \t]*(.*)$/m),
			approvedG1: optionChecked(lines, SCENARIO_G1_LABEL),
			publish: optionChecked(lines, SCENARIO_PUBLISH_LABEL),
		};
	});
	return {
		approver: field(text, /^- \*\*Nome:\*\*[ \t]*(.*)$/m),
		g1: {
			all: checked(text, 'Aprovar todos os cenários'),
			partial: checked(text, 'Aprovar parcialmente'),
			changes: checked(text, 'Solicitar ajustes'),
			approvedScenarios: scenarios.filter((row) => row.approvedG1).map((row) => row.id),
			pendencies: headingBlocks(text, 'P').map(({ id, title, lines }) => ({
				id,
				text: title,
				done: optionChecked(lines, PENDENCY_OPTIONS.accept),
				rejected: optionChecked(lines, PENDENCY_OPTIONS.reject),
				note: field(lines.join('\n'), /^Observação:[ \t]*(.*)$/m),
			})),
		},
		g2: {
			plan: checked(text, 'Aprovo o plano do Zephyr'),
			zephyrWrite: checked(text, 'Autorizo a escrita no Zephyr'),
			publish: scenarios.filter((row) => row.publish).map((row) => row.id),
		},
		atdd: {
			redFirst: checked(text, 'red-first'),
			verifyExisting: checked(text, 'verify-existing'),
			reason: field(text, /^Motivo \(verify-existing\):[ \t]*(.*)$/m),
		},
		scenarios,
		g3: { approved: checked(text, 'Aprovo a execução e a entrega'), runId: field(text, /^Run-id:[ \t]*(\S*)/m) },
	};
}

/** Lê e interpreta o arquivo; devolve null se ele não existir. */
export function readApprovals(root, config, card) {
	const file = approvalsPath(root, config, card);
	if (!existsSync(file)) return null;
	return { file, text: readFileSync(file, 'utf-8'), data: parseApprovals(readFileSync(file, 'utf-8')) };
}

/** Modo ATDD marcado no arquivo: 'red-first', 'verify-existing' ou null se não houver exatamente um. */
export function atddModeOf(data) {
	if (data.atdd.redFirst === data.atdd.verifyExisting) return null;
	return data.atdd.redFirst ? 'red-first' : 'verify-existing';
}

/** Cenários liberados pelo G1: null = todos; lista = só esses; lista vazia = nada aprovado ainda. */
export function approvedScope(data) {
	if (data.g1.all) return null;
	if (data.g1.partial) return data.g1.approvedScenarios;
	return [];
}

/**
 * O que vai ao Zephyr é um escopo próprio: só cenários que o QA listou em "Cenários a publicar no Zephyr"
 * e que também estão aprovados no G1. A automação cobre todos os cenários aprovados no G1.
 */
export function publishScope(data) {
	const approved = approvedScope(data);
	return data.g2.publish.filter((id) => inScope(approved, id));
}

export const inScope = (scope, id) => scope === null || scope.includes(id);

export const selectedScenarioIds = (data) => data.scenarios.filter((row) => row.decision === 'automatizar').map((row) => row.id);

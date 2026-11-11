import { createHash } from 'node:crypto';
import { parseApprovals, selectedScenarioIds } from './approvals.mjs';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

/**
 * Regras do ATDD (Acceptance Test-Driven Development) aplicadas ao fluxo do agente.
 *
 * Ciclo: Discutir (BDD + G1) -> Destilar (Zephyr + esqueletos) -> Desenvolver
 * (teste vermelho pelo motivo certo, dev implementa, teste verde) -> Demonstrar (G3).
 */

export const ATDD_MODES = ['red-first', 'verify-existing'];
export const ATDD_PHASES = ['red', 'green'];

export const scenarioId = (order) => `S${String(order).padStart(2, '0')}`;

function check(id, ok, message) {
	return { id, ok, message };
}

/** Tag de card ou de cenário duplicada ou ausente aparece como erro de metadado do reporter. */
function metadataCheck(id, entries) {
	const problems = entries.filter((entry) => entry.metadataError && !/Zephyr|VPOS/i.test(entry.metadataError)).map((entry) => `${entry.scenario ?? entry.title}: ${entry.metadataError}`);
	return check(id, problems.length === 0, problems.length ? `tags inválidas nos testes: ${problems.join('; ')}` : 'tags dos testes válidas');
}

/** Ids dos cenários marcados como `automatizar` no arquivo único de aprovações. */
export function automatedScenarios(approvalsText) {
	return selectedScenarioIds(parseApprovals(approvalsText));
}

/**
 * Uma execução vermelha só vale como ATDD quando cada falha é uma asserção de
 * comportamento ausente. Falha de seletor, timeout de ação, login ou ambiente é
 * erro de automação ou de ambiente e não prova que o critério ainda não foi atendido.
 */
export function validateRedRun(manifest, expected, stepKinds = null) {
	const entries = Array.isArray(manifest?.entries) ? manifest.entries : [];
	const byScenario = new Map(entries.map((entry) => [entry.scenario, entry]));
	const failing = entries.filter((entry) => entry.status === 'FAIL');
	// Vale como vermelho só o expect() que falha no passo Then do BDD aprovado. Falha em Given ou When é
	// preparação ou ação quebrada. Com o BDD em mãos, o tipo do passo vem do .feature e não do título livre.
	const isThenStep = (entry) => {
		if (stepKinds) return stepKinds.get(entry.scenario)?.get(entry.failedStep ?? '') === 'then';
		return /^Then\b/.test(entry.failedStep ?? '');
	};
	const wrongReason = failing
		.filter((entry) => entry.failureKind !== 'assertion' || !isThenStep(entry))
		.map((entry) => entry.scenario ?? entry.title);
	const skipped = entries.filter((entry) => entry.status === 'SKIPPED').map((entry) => entry.scenario ?? entry.title);
	const missing = expected.filter((id) => !byScenario.has(id));
	const alreadySatisfied = entries.filter((entry) => entry.status === 'PASS').map((entry) => entry.scenario ?? entry.title);

	const checks = [
		check('atdd.red.phase', manifest?.atddPhase === 'red', `execução deve declarar a fase red (atual: ${manifest?.atddPhase ?? 'ausente'})`),
		check('atdd.red.coverage', expected.length > 0 && missing.length === 0, missing.length ? `cenários sem teste na execução: ${missing.join(', ')}` : 'todos os cenários selecionados foram executados'),
		check('atdd.red.has-failure', failing.length > 0, failing.length ? `${failing.length} cenário(s) vermelho(s)` : 'nenhum cenário falhou: a funcionalidade já existe ou os testes não verificam nada'),
		check('atdd.red.right-reason', wrongReason.length === 0, wrongReason.length ? `falha que não é um expect() em passo Then (erro de automação, preparação, ação ou ambiente): ${wrongReason.join(', ')}` : 'todas as falhas são expect() de comportamento ausente em passo Then'),
		check('atdd.red.no-skipped', skipped.length === 0, skipped.length ? `cenários ignorados: ${skipped.join(', ')}` : 'nenhum cenário ignorado'),
		metadataCheck('atdd.red.metadata', entries),
	];
	return {
		valid: checks.every((item) => item.ok),
		checks,
		red: failing.map((entry) => entry.scenario ?? entry.title),
		alreadySatisfied,
		wrongReason,
	};
}

export function validateGreenRun(manifest, expected) {
	const entries = Array.isArray(manifest?.entries) ? manifest.entries : [];
	const found = [...new Set(entries.map((entry) => entry.scenario).filter(Boolean))].sort();
	const wanted = [...new Set(expected)].sort();
	return [
		check('atdd.green.phase', manifest?.atddPhase === 'green', `execução deve declarar a fase green (atual: ${manifest?.atddPhase ?? 'ausente'})`),
		check('atdd.green.passed', manifest?.result === 'passed' && entries.length > 0 && entries.every((entry) => entry.status === 'PASS'), 'todos os cenários passam'),
		check('atdd.green.scenarios', wanted.length > 0 && JSON.stringify(found) === JSON.stringify(wanted), 'a execução cobre exatamente os cenários selecionados'),
		metadataCheck('atdd.green.metadata', entries),
	];
}

export function walk(directory) {
	if (!existsSync(directory)) return [];
	return readdirSync(directory).flatMap((entry) => {
		const full = path.join(directory, entry);
		return statSync(full).isDirectory() ? walk(full) : [full];
	});
}

/** Procura, nos diretórios do agente, os specs do card e as tags de cenário (@S01...) que eles declaram. */
export function scanSpecs(root, ownedPaths, card) {
	const map = new Map();
	for (const owned of ownedPaths) {
		for (const file of walk(path.join(root, owned)).filter((item) => item.endsWith('.spec.ts'))) {
			const text = readFileSync(file, 'utf-8');
			if (!text.includes(`@${card}`)) continue;
			for (const match of text.matchAll(/@(S\d{2})(?!\d)/g)) {
				const files = map.get(match[1]) ?? new Set();
				files.add(path.relative(root, file));
				map.set(match[1], files);
			}
		}
	}
	return map;
}

const CARD_DIR = /^[A-Z][A-Z0-9]+-\d+$/;

/**
 * Hash de tudo o que o agente escreveu e que pode conter a asserção: todos os arquivos dos
 * diretórios do agente (specs, Page Objects, flows e dados), exceto os de OUTROS cards.
 * Mover um expect() para um helper do agente também muda o hash.
 */
export function specsHash(root, ownedPaths, card) {
	const files = ownedPaths
		.flatMap((owned) => walk(path.join(root, owned)).map((file) => ({ file, owned: path.join(root, owned) })))
		.filter(({ file, owned }) => {
			const otherCard = path.relative(owned, file).split(path.sep).slice(0, -1).find((part) => CARD_DIR.test(part) && part !== card);
			return !otherCard;
		})
		.map(({ file }) => file)
		.sort();
	const hash = createHash('sha256');
	for (const file of files) hash.update(path.relative(root, file)).update('\0').update(readFileSync(file)).update('\0');
	return { sha256: hash.digest('hex'), files: files.map((file) => path.relative(root, file)) };
}

/** Execuções locais de quem desenvolve servem ao ciclo rápido e nunca valem como oficiais (sem distinção de caixa). */
export const isLocalRunId = (runId) => /^dev[-_.]/i.test(runId ?? '');

export function readRunManifest(root, config, card, runId) {
	if (!runId || !/^[A-Za-z0-9._-]+$/.test(runId)) return { error: 'run-id inválido ou ausente' };
	if (isLocalRunId(runId)) return { error: 'run-id dev-* é de execução local e não pode ser usado como evidência oficial' };
	const dir = config.artifacts.executions_dir.replaceAll('{CARD}', card).replaceAll('{runId}', runId);
	const file = path.join(root, dir, 'evidence-manifest.json');
	if (!existsSync(file)) return { error: `manifesto não encontrado: ${path.relative(root, file)}` };
	try {
		const raw = readFileSync(file);
		const manifest = JSON.parse(raw.toString('utf-8'));
		if (manifest.card !== card || manifest.runId !== runId) return { error: 'manifesto não pertence a este card e run-id' };
		return { manifest, file, sha256: createHash('sha256').update(raw).digest('hex') };
	} catch (error) {
		return { error: `manifesto inválido: ${error.message}` };
	}
}

/**
 * A execução precisa ter sido feita pelo runner oficial, com typecheck verde, sobre exatamente
 * os testes que existem agora. Isso impede provar o vermelho ou o verde com outros testes.
 */
export function officialRunProblems(manifest, currentSpecsSha256) {
	const problems = [];
	if (manifest?.runner !== 'qa-atdd') problems.push('execução não foi feita por `npm run qa:atdd -- run` (runner oficial)');
	if (manifest?.typecheck !== 'passed') problems.push(`typecheck deve estar passed (atual: ${manifest?.typecheck ?? 'ausente'})`);
	if (!manifest?.specsSha256) problems.push('manifesto sem hash dos testes executados');
	else if (manifest.specsSha256 !== currentSpecsSha256) problems.push('os testes mudaram depois desta execução (hash diferente)');
	return problems;
}

/** Evidência (print) que o manifesto promete e não existe em disco. */
export function missingEvidence(root, config, card, runId, manifest, status) {
	const base = path.join(root, config.evidence.dir.replaceAll('{CARD}', card).replaceAll('{runId}', runId));
	const missing = [];
	for (const entry of manifest?.entries ?? []) {
		if (entry.status !== status) continue;
		const wanted = (entry.steps ?? []).filter((step) => step.status === status);
		if (wanted.length === 0) missing.push(`${entry.scenario ?? entry.title}: sem print de passo ${status}`);
		for (const step of wanted) {
			const file = step.screenshot ? path.resolve(base, step.screenshot) : null;
			if (!file || !file.startsWith(`${base}${path.sep}`) || !existsSync(file) || !statSync(file).isFile()) missing.push(`${entry.scenario ?? entry.title}: print ausente em "${step.title}"`);
		}
	}
	return missing;
}

function fill(template, values) {
	return Object.entries(values).reduce((result, [key, value]) => result.replaceAll(`{${key}}`, value), template);
}

/** Guia para quem desenvolve: critérios de aceite, estado de cada teste e como rodar. */
export function renderDevGuide({ card, summary, items, selected, manifest, phase, atdd, commands, runId }) {
	const byScenario = new Map((manifest?.entries ?? []).map((entry) => [entry.scenario, entry]));
	const statusOf = (id) => {
		const entry = byScenario.get(id);
		if (!entry) return 'sem execução';
		if (entry.status === 'PASS') return phase === 'red' ? 'VERDE (já atendido)' : 'VERDE';
		if (entry.status === 'FAIL') return entry.failureKind === 'assertion' ? 'VERMELHO (comportamento ainda não atendido)' : 'FALHA DE AUTOMAÇÃO/AMBIENTE';
		return 'ignorado';
	};
	const rows = items
		.filter((item) => selected.includes(item.id))
		.map((item) => {
			const entry = byScenario.get(item.id);
			const command = fill(commands.run_scenario, { PHASE: 'green', CARD: card, SCENARIO: item.id });
			return `| ${item.id} | ${item.name.replace(/\|/g, '\\|')} | ${statusOf(item.id)} | ${entry?.failedStep ?? '-'} | \`${command}\` |`;
		});
	const criteria = items
		.filter((item) => selected.includes(item.id))
		.map((item) => `### ${item.id} — ${item.name}\n\n\`\`\`gherkin\n${item.gherkin.join('\n')}\n\`\`\``);
	const pending = (manifest?.entries ?? []).filter((entry) => entry.status !== 'PASS').length;
	return `# Guia de desenvolvimento guiado por testes de aceite — ${card}

${summary}

- **Modo ATDD:** ${atdd.mode}${atdd.reason ? ` (${atdd.reason})` : ''}
- **Última execução oficial:** ${manifest ? `${manifest.runId} (fase ${phase}, resultado ${manifest.result})` : 'nenhuma'}
- **Cenários ainda não verdes:** ${pending}

## Como usar

1. Escolha um cenário vermelho da tabela abaixo.
2. Rode o comando do cenário. Ele mostra qual passo ainda não é atendido.
3. Implemente somente o necessário para esse critério de aceite.
4. Rode de novo até ficar verde e passe ao próximo.
5. Quando todos estiverem verdes, avise o QA para a execução oficial e a demonstração.

Esse ciclo curto não gera evidência oficial. A execução oficial (com typecheck e \`E2E_RUN_ID\`) é feita pelo QA:

\`\`\`
${fill(commands.run_card, { PHASE: 'green', CARD: card, RUN_ID: runId })}
\`\`\`

## Estado dos critérios de aceite

| Cenário | Critério | Estado | Passo que falha | Comando |
|---|---|---|---|---|
${rows.join('\n')}

## Definição de pronto

- Todos os cenários acima verdes na execução oficial.
- Nenhum teste de aceite alterado para passar. Se o critério estiver errado, volte ao QA e ao PO.
- Demonstração aos interessados com as evidências por passo.

## Critérios de aceite (Gherkin)

${criteria.join('\n\n')}
`;
}

export { fill };

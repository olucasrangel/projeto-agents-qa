import { createHash, randomUUID } from 'node:crypto';
import { DECISION_OPTIONS } from './approvals.mjs';

/**
 * Relatório final do card (A4): métricas, resultados no formato do Allure e resumo executivo em HTML.
 * Tudo aqui é função pura sobre dados já lidos; a leitura de arquivos e do Git fica em `qa-report.mjs`.
 */

const DECISIONS = DECISION_OPTIONS.map(([option]) => option);
const PRIORITY_LABEL = { critical: 'Crítica', high: 'Alta', medium: 'Média' };
const SEVERITY = { critical: 'critical', high: 'normal', medium: 'minor' };

export const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const pct = (part, total) => (total ? Math.round((part / total) * 1000) / 10 : 0);

export function formatDuration(ms) {
	if (!Number.isFinite(ms) || ms < 0) return '—';
	const minutes = Math.round(ms / 60000);
	if (ms < 60000) return `${Math.round(ms / 1000)} s`;
	if (minutes < 60) return `${minutes} min`;
	const hours = Math.floor(minutes / 60);
	if (hours < 48) return `${hours} h ${String(minutes % 60).padStart(2, '0')} min`;
	return `${Math.floor(hours / 24)} d ${hours % 24} h`;
}

/** Chave e tipo do cenário a partir do nome: `[CARD][Web][Sucesso] Validar ...`. */
export const shortName = (name) => name.replace(/^\[[^\]]+\]\[[^\]]+\]\[[^\]]+\]\s*/, '');
export const typeOf = (name) => name.match(/\[(Sucesso|Falha)\]/)?.[1] ?? 'Sucesso';

/** Comentários `# Candidato: VPOS-T... ` do .feature, na ordem dos cenários (null = sem caso do time). */
export function candidatesOf(featureText) {
	const result = [];
	let candidate = null;
	for (const line of featureText.split(/\r?\n/)) {
		const match = line.match(/#\s*Candidato:\s*(VPOS-T\d+)/);
		if (match) candidate = match[1];
		if (/^\s*Scenario(?: Outline)?:/.test(line)) {
			result.push(candidate);
			candidate = null;
		}
	}
	return result;
}

/** Fases do fluxo a partir do histórico do estado: tempo de agente, espera do QA e prazo total. */
export function timelineOf(state, now = new Date()) {
	const history = state.history ?? [];
	const points = [{ state: 'DISCOVERY', at: state.createdAt }, ...history.map((item) => ({ state: item.to, at: item.at }))];
	const phases = points.slice(0, -1).map((point, index) => ({
		state: point.state,
		startedAt: point.at,
		durationMs: Date.parse(points[index + 1].at) - Date.parse(point.at),
	}));
	const last = points.at(-1);
	phases.push({ state: last.state, startedAt: last.at, durationMs: Math.max(0, now.getTime() - Date.parse(last.at)), open: true });
	const waiting = phases.filter((phase) => phase.state.startsWith('AWAITING_')).reduce((sum, phase) => sum + phase.durationMs, 0);
	const firstAutomation = history.find((item) => item.to === 'AUTOMATION');
	const lastReport = [...history].reverse().find((item) => item.to === 'REPORT');
	const end = lastReport ? Date.parse(lastReport.at) : now.getTime();
	const total = end - Date.parse(state.createdAt);
	return {
		startedAt: state.createdAt,
		endedAt: new Date(end).toISOString(),
		leadTimeMs: total,
		qaWaitMs: waiting,
		agentMs: Math.max(0, total - waiting),
		automationMs: firstAutomation ? Math.max(0, end - Date.parse(firstAutomation.at)) : null,
		phases,
	};
}

/** Classifica cada cenário do .feature pelo que o QA decidiu e pelo que a execução mostrou. */
export function classify({ scenarios, approvals, manifest, atddMode, owned }) {
	const entries = new Map();
	for (const entry of manifest?.entries ?? []) {
		const id = entry.title?.match(/@(S\d{2})/)?.[1] ?? scenarios.find((scenario) => scenario.name === entry.title)?.id;
		if (id) entries.set(id, entry);
	}
	const ownedByScenario = new Map((owned?.cases ?? []).map((item) => [item.scenario, item]));
	return scenarios.map((scenario) => {
		const row = approvals.scenarios.find((item) => item.id === scenario.id);
		const decision = row?.decision || '';
		const entry = entries.get(scenario.id);
		const priority = scenario.tags.map((tag) => tag.slice(1)).find((tag) => PRIORITY_LABEL[tag]) ?? 'medium';
		let category = 'sem-decisao';
		if (entry) category = atddMode === 'red-first' ? 'automatizado-atdd' : 'automatizado-feature-pronta';
		else if (decision === 'automatizar') category = 'automatizar-sem-execucao';
		else if (DECISIONS.includes(decision)) category = decision;
		return {
			...scenario,
			shortName: shortName(scenario.name),
			type: typeOf(scenario.name),
			priority,
			decision,
			justification: row?.justification ?? '',
			suggestion: row?.suggestion ?? '',
			entry: entry ?? null,
			category,
			ownedCase: ownedByScenario.get(scenario.id) ?? null,
		};
	});
}

const CATEGORY_LABEL = {
	'automatizado-atdd': 'Automatizado com ATDD (teste antes da funcionalidade)',
	'automatizado-feature-pronta': 'Automatizado sobre a funcionalidade já entregue',
	'automatizar-depois': 'Fica para depois (falta massa ou acesso)',
	bloqueado: 'Bloqueado (sem interface ou sem como forçar)',
	'manter-manual': 'Mantido como teste manual',
	'não-aplicável': 'Não se aplica a esta entrega',
	'automatizar-sem-execucao': 'Marcado para automatizar, sem execução',
	'sem-decisao': 'Sem decisão do QA',
};

export function computeMetrics({ card, items, manifest, history, timeline, state, approvals, config, validation, owned, git }) {
	const total = items.length;
	const automated = items.filter((item) => item.entry);
	const count = (category) => items.filter((item) => item.category === category).length;
	const deferred = count('automatizar-depois');
	const passed = automated.filter((item) => item.entry.status === 'PASS').length;
	const byPriority = Object.fromEntries(
		Object.keys(PRIORITY_LABEL).map((priority) => {
			const group = items.filter((item) => item.priority === priority);
			const done = group.filter((item) => item.entry).length;
			return [priority, { label: PRIORITY_LABEL[priority], total: group.length, automated: done, pct: pct(done, group.length) }];
		}),
	);
	const byType = Object.fromEntries(
		['Sucesso', 'Falha'].map((type) => {
			const group = items.filter((item) => item.type === type);
			const done = group.filter((item) => item.entry).length;
			return [type, { total: group.length, automated: done, pct: pct(done, group.length) }];
		}),
	);
	const steps = automated.flatMap((item) => item.entry.steps ?? []);
	const withEvidence = steps.filter((step) => step.screenshot).length;
	const finalRuns = history.filter((run) => run.result);
	const manualPerScenario = config.report?.manual_minutes_per_scenario;
	return {
		schemaVersion: 1,
		card,
		generatedAt: new Date().toISOString(),
		scenarios: { total, byType, byPriority },
		decisions: Object.fromEntries([...DECISIONS, 'sem-decisao'].map((decision) => [decision, items.filter((item) => (item.decision || 'sem-decisao') === decision).length])),
		automation: {
			mode: state.atdd?.mode ?? null,
			modeConfirmedBy: state.atdd?.confirmedBy ?? null,
			automated: automated.length,
			atdd: count('automatizado-atdd'),
			existingFeature: count('automatizado-feature-pronta'),
			passed,
			failed: automated.length - passed,
			ids: automated.map((item) => item.id),
		},
		coverage: {
			automatedPct: pct(automated.length, total),
			ceilingPct: pct(automated.length + deferred, total),
			deferred,
			blocked: count('bloqueado'),
			note: 'O piso é o que está automatizado hoje; o teto soma o que ficou para depois e só depende de massa ou acesso.',
		},
		execution: {
			runId: manifest?.runId ?? null,
			result: manifest?.result ?? null,
			durationMs: manifest ? Date.parse(manifest.finishedAt) - Date.parse(manifest.startedAt) : null,
			retries: automated.reduce((sum, item) => sum + (item.entry.retry ?? 0), 0),
			steps: steps.length,
			stepsWithEvidencePct: pct(withEvidence, steps.length),
			officialRuns: finalRuns.length,
			officialRunsPassed: finalRuns.filter((run) => run.result === 'passed').length,
			runs: finalRuns,
			automationCycles: state.automationCycles ?? 0,
		},
		time: {
			leadTimeMs: timeline.leadTimeMs,
			agentMs: timeline.agentMs,
			qaWaitMs: timeline.qaWaitMs,
			automationMs: timeline.automationMs,
			phases: timeline.phases.map((phase) => ({ state: phase.state, durationMs: phase.durationMs })),
		},
		zephyr: {
			folder: owned?.folder ? { id: owned.folder.id, name: owned.folder.name } : null,
			created: (owned?.cases ?? []).map((item) => ({ key: item.key, scenario: item.scenario, status: item.status, name: item.name })),
			teamReferences: items.filter((item) => item.candidate && !item.ownedCase).map((item) => ({ scenario: item.id, key: item.candidate })),
		},
		qualityGates: qualityGates({ state, manifest, items, automated, validation, history: finalRuns }),
		savings: Number.isFinite(manualPerScenario)
			? { manualMinutesPerScenario: manualPerScenario, equivalentManualMinutesPerRun: manualPerScenario * automated.length }
			: null,
		git,
	};
}

/** Gates de qualidade da entrega: o que passou, o que falhou e o que aguarda o QA. */
function qualityGates({ state, manifest, items, automated, validation, history }) {
	const gate = (id, label, status, detail) => ({ id, label, status, detail });
	const recorded = (name) => (state.gates?.[name] ? 'pass' : 'pending');
	const fromValidation = (id) => validation?.find((item) => item.id === id);
	const asStatus = (check, fallback = 'pending') => (check ? (check.ok ? 'pass' : 'fail') : fallback);
	const allEvidence = automated.length > 0 && automated.every((item) => (item.entry.steps ?? []).length > 0 && item.entry.steps.every((step) => step.screenshot));
	return [
		gate('G1', 'BDD aprovado pelo QA (G1)', recorded('G1'), state.gates?.G1 ? `por ${state.gates.G1.by}` : 'aguardando'),
		gate('G2', 'Plano do Zephyr aprovado pelo QA (G2)', recorded('G2'), state.gates?.G2 ? `por ${state.gates.G2.by}` : 'aguardando'),
		gate('typecheck', 'Typecheck verde', manifest?.typecheck === 'passed' ? 'pass' : 'fail', `typecheck ${manifest?.typecheck ?? 'não registrado'}`),
		gate('run-official', 'Execução oficial verde sobre os testes atuais', asStatus(fromValidation('G3.atdd-green-official'), manifest?.result === 'passed' ? 'pass' : 'fail'), `execução ${manifest?.runId ?? '—'}: ${manifest?.result ?? '—'}`),
		gate('all-green', 'Todos os cenários automatizados passam', automated.length > 0 && automated.every((item) => item.entry.status === 'PASS') ? 'pass' : 'fail', `${automated.filter((item) => item.entry.status === 'PASS').length} de ${automated.length}`),
		gate('no-retries', 'Sem retentativas (sem instabilidade escondida)', automated.every((item) => (item.entry.retry ?? 0) === 0) ? 'pass' : 'fail', 'retries = 0'),
		gate('traceability', 'Cada cenário automatizado ligado a um caso do Zephyr', automated.length > 0 && automated.every((item) => item.entry.zephyrKey) ? 'pass' : 'fail', `${automated.filter((item) => item.entry.zephyrKey).length} de ${automated.length}`),
		gate('evidence', 'Evidência (print) em todos os passos', allEvidence ? 'pass' : 'fail', 'um print por passo, registrado no manifesto'),
		gate('ownership', 'A entrega só altera o que o agente criou', asStatus(fromValidation('G3.ownership')), 'testes e casos do time intactos'),
		gate('decisions', 'Todo cenário aprovado tem decisão do QA', asStatus(fromValidation('G3.decision-coverage'), items.every((item) => item.decision) ? 'pass' : 'fail'), `${items.filter((item) => item.decision).length} de ${items.length}`),
		gate('first-pass', 'Execuções oficiais aprovadas', history.length ? (history.at(-1).result === 'passed' ? 'pass' : 'fail') : 'pending', `${history.filter((run) => run.result === 'passed').length} de ${history.length} execuções oficiais passaram`),
		gate('G3', 'Execução e entrega aprovadas pelo QA (G3)', recorded('G3'), state.gates?.G3 ? `por ${state.gates.G3.by}` : 'aguardando o QA'),
	];
}

function stepStatus(status) {
	return status === 'PASS' ? 'passed' : status === 'FAIL' ? 'failed' : 'skipped';
}

/** Resultados no formato do Allure (um arquivo por cenário). `attach(source)` devolve o nome do anexo ou null. */
export function buildAllure({ card, cardTitle, epic, featureName, items, manifest, approver, mode, git, urls, attach }) {
	const start = manifest ? Date.parse(manifest.startedAt) : Date.now();
	let cursor = start;
	const results = items.map((item) => {
		const uuid = randomUUID();
		const entry = item.entry;
		const duration = entry?.durationMs ?? 0;
		const testStart = cursor;
		cursor += duration;
		const stepList = entry
			? (entry.steps ?? []).map((step, index, all) => {
					const stepStart = testStart + Math.round((duration / all.length) * index);
					const source = attach?.(step.screenshot);
					return {
						name: step.title,
						status: stepStatus(step.status),
						stage: 'finished',
						start: stepStart,
						stop: stepStart + Math.round(duration / all.length),
						attachments: source ? [{ name: 'Evidência do passo', source, type: 'image/png' }] : [],
					};
				})
			: item.steps.map((step) => ({ name: `${step.keyword} ${step.text}`, status: 'skipped', stage: 'finished', start: testStart, stop: testStart, attachments: [] }));
		const status = entry ? (entry.status === 'PASS' ? 'passed' : 'failed') : 'skipped';
		const message = entry ? undefined : `${CATEGORY_LABEL[item.category]}${item.decision ? ` (decisão do QA: ${item.decision})` : ''}${item.justification ? `. ${item.justification}` : ''}`;
		const zephyrKey = item.ownedCase?.key ?? item.candidate;
		const links = [{ name: card, url: urls.jira(card), type: 'issue' }];
		if (zephyrKey) links.push({ name: `${zephyrKey} (${item.ownedCase ? 'caso criado pelo agente' : 'caso do time, referência'})`, url: urls.zephyr(zephyrKey), type: 'tms' });
		const gherkin = item.gherkin.join('\n');
		return {
			uuid,
			historyId: createHash('sha1').update(`${card}:${item.id}`).digest('hex'),
			testCaseId: createHash('md5').update(`${card}:${item.id}`).digest('hex'),
			name: `${item.id} — ${item.shortName}`,
			fullName: `${card}.${item.id}`,
			status,
			...(message ? { statusDetails: { message, known: false, muted: false, flaky: false } } : {}),
			stage: 'finished',
			start: testStart,
			stop: testStart + duration,
			labels: [
				{ name: 'parentSuite', value: card },
				{ name: 'suite', value: item.type === 'Falha' ? 'Cenários de falha' : 'Cenários de sucesso' },
				{ name: 'epic', value: epic ?? card },
				{ name: 'feature', value: featureName },
				{ name: 'story', value: CATEGORY_LABEL[item.category] },
				{ name: 'severity', value: SEVERITY[item.priority] },
				{ name: 'tag', value: item.id },
				{ name: 'tag', value: PRIORITY_LABEL[item.priority] },
				...(entry ? [{ name: 'tag', value: mode === 'red-first' ? 'ATDD' : 'feature-já-pronta' }] : [{ name: 'tag', value: item.decision || 'sem-decisão' }]),
				{ name: 'owner', value: approver || 'QA' },
				{ name: 'framework', value: 'playwright' },
				{ name: 'language', value: 'typescript' },
				{ name: 'host', value: git.branch },
			],
			links,
			parameters: [
				{ name: 'Modo ATDD', value: mode ?? '—' },
				{ name: 'Decisão do QA', value: item.decision || '—' },
				{ name: 'Caso Zephyr', value: zephyrKey ?? '—' },
			],
			descriptionHtml: `<p><b>Decisão do QA:</b> ${escapeHtml(item.decision || 'sem decisão')}${item.justification ? ` — ${escapeHtml(item.justification)}` : ''}</p><pre>${escapeHtml(gherkin)}</pre>`,
			steps: stepList,
			attachments: [],
		};
	});
	const categories = [
		{ name: 'Fica para depois (falta massa ou acesso)', matchedStatuses: ['skipped'], messageRegex: '.*automatizar-depois.*' },
		{ name: 'Bloqueado (sem interface ou sem como forçar)', matchedStatuses: ['skipped'], messageRegex: '.*bloqueado.*' },
		{ name: 'Mantido como teste manual', matchedStatuses: ['skipped'], messageRegex: '.*manter-manual.*' },
		{ name: 'Falha de produto ou da automação', matchedStatuses: ['failed', 'broken'] },
	];
	return { results, categories, cardTitle };
}

export function environmentProperties({ card, metrics, git, manifest }) {
	const lines = {
		Card: card,
		Branch: git.branch,
		Commit: git.commit + (git.dirty ? ' (com alterações não commitadas)' : ''),
		'Modo ATDD': metrics.automation.mode ?? '—',
		'Execução oficial': `${manifest?.runId ?? '—'} (${manifest?.result ?? '—'})`,
		Ambiente: 'AVA hml (infoprod.stage.platosedu.io)',
		'Cenários no BDD': metrics.scenarios.total,
		Automatizados: `${metrics.automation.automated} (${metrics.coverage.automatedPct}%)`,
		'Cobertura (piso → teto)': `${metrics.coverage.automatedPct}% → ${metrics.coverage.ceilingPct}%`,
		'Com ATDD': metrics.automation.atdd,
		'Sobre funcionalidade pronta': metrics.automation.existingFeature,
		'Casos criados no Zephyr': metrics.zephyr.created.map((item) => item.key).join(', ') || '—',
		'Prazo do card': formatDuration(metrics.time.leadTimeMs),
		'Tempo de trabalho (sem esperas de gate)': formatDuration(metrics.time.agentMs),
	};
	return Object.entries(lines).map(([key, value]) => `${key.replace(/ /g, '_')}=${value}`).join('\n') + '\n';
}

const GATE_ICON = { pass: '✔', fail: '✘', pending: '…' };
const GATE_CLASS = { pass: 'ok', fail: 'bad', pending: 'wait' };

/** Página única para quem decide: números, cobertura, tempo, gates, Zephyr e entrega. */
export function buildSummaryHtml({ card, cardTitle, featureName, items, metrics, git, urls, manifest, reportLink }) {
	const m = metrics;
	const row = (cells) => `<tr>${cells.map((cell) => `<td>${cell}</td>`).join('')}</tr>`;
	const bar = (value) => `<div class="bar"><span style="width:${Math.min(100, value)}%"></span></div>`;
	const decided = (category) => items.filter((item) => item.category === category);
	const deferredRows = [...decided('automatizar-depois'), ...decided('bloqueado'), ...decided('manter-manual'), ...decided('não-aplicável')]
		.map((item) => row([escapeHtml(item.id), escapeHtml(item.shortName), escapeHtml(item.decision), escapeHtml(item.justification || '—')])).join('');
	const zephyrRows = [
		...m.zephyr.created.map((item) => row([`<a href="${urls.zephyr(item.key)}">${item.key}</a>`, escapeHtml(item.scenario), escapeHtml(item.status), escapeHtml(item.name)])),
	].join('');
	const phases = m.time.phases.filter((phase) => phase.durationMs >= 1000).map((phase) => row([escapeHtml(phase.state), formatDuration(phase.durationMs)])).join('');
	const gates = m.qualityGates.map((item) => row([`<span class="${GATE_CLASS[item.status]}">${GATE_ICON[item.status]}</span>`, escapeHtml(item.label), escapeHtml(item.detail)])).join('');
	const gatesPassed = m.qualityGates.filter((item) => item.status === 'pass').length;
	const priorities = Object.values(m.scenarios.byPriority).map((p) => row([p.label, `${p.automated} de ${p.total}`, `${p.pct}%`, bar(p.pct)])).join('');
	const types = Object.entries(m.scenarios.byType).map(([type, g]) => row([type, `${g.automated} de ${g.total}`, `${g.pct}%`, bar(g.pct)])).join('');
	const runs = m.execution.runs.map((run) => row([escapeHtml(run.runId), run.result === 'passed' ? '<span class="ok">passou</span>' : '<span class="bad">falhou</span>', formatDuration(Date.parse(run.finishedAt) - Date.parse(run.startedAt))])).join('');
	const savings = m.savings ? `<p>Equivalente manual por rodada: <b>${formatDuration(m.savings.equivalentManualMinutesPerRun * 60000)}</b> (${m.savings.manualMinutesPerScenario} min por cenário × ${m.automation.automated} cenários, valor informado pelo time).</p>` : '<p class="muted">Para estimar a economia de horas manuais, informe <code>report.manual_minutes_per_scenario</code> no <code>qa-project.yaml</code>.</p>';
	return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><title>Resumo executivo — ${escapeHtml(card)}</title>
<style>
body{font:15px/1.5 -apple-system,Segoe UI,Roboto,sans-serif;max-width:980px;margin:32px auto;padding:0 20px;color:#1c2330}
h1{margin:0 0 4px}h2{margin-top:32px;border-bottom:1px solid #dde3ec;padding-bottom:6px}.muted{color:#6b7686}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;margin:18px 0}
.card{border:1px solid #dde3ec;border-radius:10px;padding:14px;background:#f8fafc}.card b{display:block;font-size:26px}
table{border-collapse:collapse;width:100%;margin:10px 0}td,th{border-bottom:1px solid #e6ebf2;padding:7px 8px;text-align:left;vertical-align:top}
th{background:#f1f5fa}.ok{color:#127a3d;font-weight:700}.bad{color:#b3261e;font-weight:700}.wait{color:#9a6a00;font-weight:700}
.bar{background:#e6ebf2;border-radius:6px;height:10px;min-width:120px}.bar span{display:block;height:10px;border-radius:6px;background:#2f6fed}
a{color:#2f6fed}code{background:#f1f5fa;padding:1px 5px;border-radius:4px}
</style></head><body>
<h1>${escapeHtml(card)} — resumo executivo</h1>
<p class="muted">${escapeHtml(cardTitle)} · ${escapeHtml(featureName)}</p>
<p><a href="${urls.jira(card)}">Card no Jira</a> · <a href="${escapeHtml(reportLink)}">Relatório detalhado (Allure)</a>${git.branchUrl ? ` · <a href="${git.branchUrl}">Branch no GitHub</a>` : ''}</p>

<div class="cards">
<div class="card"><b>${m.automation.automated} de ${m.scenarios.total}</b>cenários automatizados (${m.coverage.automatedPct}%)</div>
<div class="card"><b>${m.coverage.automatedPct}% → ${m.coverage.ceilingPct}%</b>cobertura hoje → com a massa pendente</div>
<div class="card"><b>${m.automation.passed}/${m.automation.automated}</b>passando na execução oficial</div>
<div class="card"><b>${formatDuration(m.time.agentMs)}</b>tempo de trabalho, sem as esperas dos gates (prazo do card: ${formatDuration(m.time.leadTimeMs)})</div>
<div class="card"><b>${gatesPassed}/${m.qualityGates.length}</b>gates de qualidade atendidos</div>
</div>

<h2>1. O que foi entregue</h2>
<table>
${row(['Cenários no BDD aprovado', String(m.scenarios.total)])}
${row(['Automatizados com ATDD (teste escrito antes da funcionalidade)', String(m.automation.atdd)])}
${row(['Automatizados sobre a funcionalidade que já estava pronta', String(m.automation.existingFeature)])}
${row(['Ficam para depois (falta massa ou acesso)', String(m.decisions['automatizar-depois'])])}
${row(['Bloqueados (sem interface)', String(m.decisions.bloqueado)])}
${row(['Mantidos como manual', String(m.decisions['manter-manual'])])}
${row(['Modo ATDD do card', `${escapeHtml(m.automation.mode ?? '—')}, confirmado por ${escapeHtml(m.automation.modeConfirmedBy ?? '—')}`])}
</table>
<p class="muted">Neste card a funcionalidade já estava entregue no hml, por isso o modo é <code>verify-existing</code>: os testes verificam o que existe e viram regressão. O modo <code>red-first</code> é usado quando o teste nasce antes da funcionalidade.</p>

<h2>2. Cobertura da feature</h2>
<p>Piso <b>${m.coverage.automatedPct}%</b> (automatizado hoje) e teto <b>${m.coverage.ceilingPct}%</b> (somando o que depende só de massa ou acesso). Os ${m.coverage.blocked} bloqueados não têm interface e ficam fora do teto.</p>
<table><tr><th>Criticidade</th><th>Automatizados</th><th>%</th><th></th></tr>${priorities}</table>
<table><tr><th>Tipo</th><th>Automatizados</th><th>%</th><th></th></tr>${types}</table>

<h2>3. Casos no Zephyr</h2>
<p>Pasta do agente: <code>${escapeHtml(m.zephyr.folder?.name ?? '—')}</code>. Casos do time referenciados (somente leitura): ${m.zephyr.teamReferences.length}.</p>
<table><tr><th>Caso criado</th><th>Cenário</th><th>Status</th><th>Nome</th></tr>${zephyrRows || row(['—', '', '', 'nenhum caso criado'])}</table>

<h2>4. Cenários que não foram automatizados</h2>
<table><tr><th>Cenário</th><th>Descrição</th><th>Decisão do QA</th><th>Motivo</th></tr>${deferredRows || row(['—', '', '', ''])}</table>

<h2>5. Tempo</h2>
<table>
${row(['Prazo total do card no fluxo', formatDuration(m.time.leadTimeMs)])}
${row(['Tempo de trabalho (prazo menos as esperas dos gates)', formatDuration(m.time.agentMs)])}
${row(['Espera pelas decisões do QA nos gates', formatDuration(m.time.qaWaitMs)])}
${row(['Da liberação da automação até o relatório', m.time.automationMs === null ? '—' : formatDuration(m.time.automationMs)])}
${row(['Duração da execução oficial', formatDuration(m.execution.durationMs)])}
</table>
<table><tr><th>Fase</th><th>Duração</th></tr>${phases}</table>
${savings}

<h2>6. Gates de qualidade</h2>
<table><tr><th></th><th>Gate</th><th>Detalhe</th></tr>${gates}</table>
<p class="muted">✔ atendido · ✘ falhou · … aguarda a decisão do QA.</p>
<h3>Execuções oficiais</h3>
<table><tr><th>Run</th><th>Resultado</th><th>Duração</th></tr>${runs}</table>

<h2>7. Entrega</h2>
<table>
${row(['Branch', `<code>${escapeHtml(git.branch)}</code>${git.branchUrl ? ` (<a href="${git.branchUrl}">abrir</a>)` : ''}`])}
${row(['Commit', `<code>${escapeHtml(git.commit)}</code>${git.dirty ? ' <span class="wait">com alterações ainda não commitadas</span>' : ''}`])}
${git.prUrl ? row(['Abrir a PR', `<a href="${git.prUrl}">${git.prUrl}</a>`]) : ''}
${row(['Relatório gerado em', escapeHtml(new Date(m.generatedAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }))])}
</table>
<p class="muted">Gerado por <code>npm run qa:report -- generate ${escapeHtml(card)}</code> a partir do BDD aprovado, do estado do fluxo, do manifesto de evidências e do Git. Os prints ficam fora do Git (contêm dados dos alunos de teste).</p>
</body></html>
`;
}

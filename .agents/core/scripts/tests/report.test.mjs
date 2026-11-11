import assert from 'node:assert/strict';
import test from 'node:test';
import { buildAllure, buildSummaryHtml, candidatesOf, classify, computeMetrics, formatDuration, timelineOf } from '../lib/report.mjs';

const feature = [
	'# Candidato: VPOS-T1 (referência)', '@T-1 @critical', 'Scenario: [T-1][Web][Sucesso] Validar a', '  Given x', '  When y', '  Then z',
	'@T-1 @high', 'Scenario: [T-1][Web][Falha] Validar b', '  Given x', '  When y', '  Then z',
	'# Candidato: VPOS-T3', '@T-1 @high', 'Scenario: [T-1][Web][Sucesso] Validar c', '  Given x', '  When y', '  Then z',
].join('\n');
const scenario = (id, name, tag) => ({ id, name, tags: ['@T-1', tag], steps: [{ keyword: 'Given', text: 'x', kind: 'given' }], gherkin: [`Scenario: ${name}`] });
const scenarios = [scenario('S01', '[T-1][Web][Sucesso] Validar a', '@critical'), scenario('S02', '[T-1][Web][Falha] Validar b', '@high'), scenario('S03', '[T-1][Web][Sucesso] Validar c', '@high')];
const approvals = { scenarios: [{ id: 'S01', decision: 'automatizar' }, { id: 'S02', decision: 'automatizar-depois', justification: 'sem massa' }, { id: 'S03', decision: 'bloqueado' }] };
const manifest = {
	runId: 'run-1', result: 'passed', typecheck: 'passed', startedAt: '2026-01-01T10:00:00Z', finishedAt: '2026-01-01T10:01:00Z',
	entries: [{ title: scenarios[0].name, status: 'PASS', durationMs: 5000, retry: 0, zephyrKey: 'VPOS-T1', steps: [{ order: 1, title: 'Given x', status: 'PASS', screenshot: 'a.png' }] }],
};
const urls = { jira: (key) => `https://jira/${key}`, zephyr: (key) => `https://zephyr/${key}` };
const state = { createdAt: '2026-01-01T00:00:00Z', gates: { G1: { by: 'Maria' } }, atdd: { mode: 'verify-existing', confirmedBy: 'Maria' }, automationCycles: 1, history: [
	{ from: 'BDD', to: 'AWAITING_G1', at: '2026-01-01T01:00:00Z' }, { from: 'AWAITING_G1', to: 'AUTOMATION', at: '2026-01-02T01:00:00Z' }, { from: 'AUTOMATION', to: 'REPORT', at: '2026-01-02T03:00:00Z' },
] };

test('candidatesOf associa o caso do time ao cenário seguinte e deixa vazio quando não há', () => {
	assert.deepEqual(candidatesOf(feature), ['VPOS-T1', null, 'VPOS-T3']);
});

test('timelineOf separa a espera nos gates do tempo de trabalho', () => {
	const timeline = timelineOf(state, new Date('2026-01-05T00:00:00Z'));
	assert.equal(timeline.leadTimeMs, 27 * 3600000);
	assert.equal(timeline.qaWaitMs, 24 * 3600000);
	assert.equal(timeline.agentMs, 3 * 3600000);
	assert.equal(timeline.automationMs, 2 * 3600000);
});

test('formatDuration escreve prazos em unidades legíveis', () => {
	assert.equal(formatDuration(30000), '30 s');
	assert.equal(formatDuration(90 * 60000), '1 h 30 min');
	assert.equal(formatDuration(50 * 3600000), '2 d 2 h');
});

test('métricas: piso e teto de cobertura, modo ATDD e gates', () => {
	const items = classify({ scenarios, approvals, manifest, atddMode: 'verify-existing', owned: null }).map((item, index) => ({ ...item, candidate: candidatesOf(feature)[index] }));
	assert.deepEqual(items.map((item) => item.category), ['automatizado-feature-pronta', 'automatizar-depois', 'bloqueado']);
	const metrics = computeMetrics({ card: 'T-1', items, manifest, history: [{ runId: 'run-1', result: 'passed' }], timeline: timelineOf(state), state, approvals, config: {}, validation: null, owned: null, git: {} });
	assert.equal(metrics.automation.existingFeature, 1);
	assert.equal(metrics.automation.atdd, 0);
	assert.equal(metrics.coverage.automatedPct, 33.3);
	assert.equal(metrics.coverage.ceilingPct, 66.7);
	assert.equal(metrics.scenarios.byPriority.critical.pct, 100);
	assert.equal(metrics.savings, null);
	const gate = (id) => metrics.qualityGates.find((item) => item.id === id).status;
	assert.equal(gate('G1'), 'pass');
	assert.equal(gate('G3'), 'pending');
	assert.equal(gate('traceability'), 'pass');
	const withSavings = computeMetrics({ card: 'T-1', items, manifest, history: [], timeline: timelineOf(state), state, approvals, config: { report: { manual_minutes_per_scenario: 10 } }, validation: null, owned: null, git: {} });
	assert.equal(withSavings.savings.equivalentManualMinutesPerRun, 10);
});

test('resultados do Allure: automatizado passa, o resto vira skipped com a decisão do QA e links', () => {
	const items = classify({ scenarios, approvals, manifest, atddMode: 'verify-existing', owned: null }).map((item, index) => ({ ...item, candidate: candidatesOf(feature)[index] }));
	const { results, categories } = buildAllure({ card: 'T-1', cardTitle: 't', epic: 'E-1', featureName: 'F', items, manifest, approver: 'Maria', mode: 'verify-existing', git: { branch: 'qa/t-1' }, urls, attach: null });
	assert.deepEqual(results.map((result) => result.status), ['passed', 'skipped', 'skipped']);
	assert.match(results[1].statusDetails.message, /automatizar-depois.*sem massa/);
	assert.ok(results[0].links.some((link) => link.type === 'tms' && link.url === 'https://zephyr/VPOS-T1'));
	assert.ok(results[0].labels.some((label) => label.name === 'tag' && label.value === 'feature-já-pronta'));
	assert.equal(results[0].steps[0].status, 'passed');
	assert.ok(categories.length >= 3);
});

test('resumo executivo escapa HTML e traz os números principais', () => {
	const items = classify({ scenarios, approvals, manifest, atddMode: 'verify-existing', owned: null }).map((item, index) => ({ ...item, candidate: candidatesOf(feature)[index] }));
	const metrics = computeMetrics({ card: 'T-1', items, manifest, history: [], timeline: timelineOf(state), state, approvals, config: {}, validation: null, owned: null, git: {} });
	const html = buildSummaryHtml({ card: 'T-1', cardTitle: '<script>x</script>', featureName: 'F', items, metrics, git: { branch: 'qa/t-1', commit: 'abc1234' }, urls, manifest, reportLink: 'index.html' });
	assert.doesNotMatch(html, /<script>x/);
	assert.match(html, /1 de 3/);
	assert.match(html, /33\.3% → 66\.7%/);
});

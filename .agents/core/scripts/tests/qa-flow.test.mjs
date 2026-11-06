import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { allowedHttpsUrl } from '../lib/doctor-validation.mjs';
import { invalidatedGatesForTransition, sha256, validateDiscoveryManifest, validateGate } from '../lib/gate-validation.mjs';

function write(root, relative, content) {
	const file = path.join(root, relative);
	mkdirSync(path.dirname(file), { recursive: true });
	writeFileSync(file, typeof content === 'string' ? content : `${JSON.stringify(content, null, 2)}\n`);
	return file;
}

function read(root, relative) {
	return readFileSync(path.join(root, relative));
}

function workspace(stateName = 'AWAITING_G1') {
	const root = mkdtempSync(path.join(tmpdir(), 'qa-flow-'));
	write(root, '.agents/project/qa-project.yaml', `
artifacts:
  bdd_review: qa/cards/{CARD}/bdd/{CARD}-review.md
  executions_dir: qa/approvals/{CARD}/executions/{runId}
jira:
  project_keys: [TEST]
zephyr:
  project_key: VPOS
  priorities:
    critical: High
    high: Normal
    medium: Low
evidence:
  dir: evidence/{CARD}/{runId}
`);
	write(root, 'qa/cards/TEST-1/context/jira-context.md', '# Jira\n');
	write(root, 'qa/cards/TEST-1/context/confluence-context.md', '# Confluence\n');
	const discovery = {
		schemaVersion: 1,
		card: 'TEST-1',
		mode: 'without-code',
		recordedAt: '2026-01-01T00:00:00.000Z',
		sources: {
			jira: { status: 'complete', artifact: 'qa/cards/TEST-1/context/jira-context.md' },
			confluence: { status: 'complete', artifact: 'qa/cards/TEST-1/context/confluence-context.md' },
			screen: { status: 'complete' },
			code: { status: 'not-authorized', reason: 'acesso pendente' },
		},
		limitations: ['Código não analisado'],
		hypotheses: [],
	};
	const discoveryFile = write(root, 'qa/cards/TEST-1/context/discovery.json', discovery);
	write(root, 'qa/cards/TEST-1/bdd/modulo/TEST-1.feature', `
@TEST-1
Feature: Fluxo
  @TEST-1 @critical
  Scenario: [TEST-1][Web][Sucesso] Validar fluxo mínimo
    Given existe uma condição
    When o usuário age
    Then o resultado aparece
`);
	write(root, 'qa/cards/TEST-1/bdd/TEST-1-review.md', `
# Revisão BDD — TEST-1
## Decisão do QA (G1)
- [x] Aprovar todos os cenários
- [ ] Aprovar parcialmente
- [ ] Solicitar ajustes
`);
	write(root, 'qa/runs/TEST-1/state.json', {
		card: 'TEST-1', state: stateName, gates: {},
		discovery: { artifact: 'qa/cards/TEST-1/context/discovery.json', sha256: sha256(readFileSync(discoveryFile)), mode: 'without-code', recordedAt: '2026-01-01T00:00:00.000Z' },
	});
	return root;
}

test('aceita discovery without-code completo e rejeita template não preenchido', () => {
	const root = workspace();
	const manifest = JSON.parse(read(root, 'qa/cards/TEST-1/context/discovery.json'));
	assert.equal(validateDiscoveryManifest(manifest, 'TEST-1', root).every((item) => item.ok), true);
	manifest.recordedAt = null;
	manifest.limitations = ['preencher'];
	assert.equal(validateDiscoveryManifest(manifest, 'TEST-1', root).every((item) => item.ok), false);
});

test('G1 passa com manifesto íntegro, feature e aprovação', () => {
	const root = workspace();
	const result = validateGate({ root, card: 'TEST-1', gate: 'G1' });
	assert.equal(result.valid, true, failures(result));
});

test('G1 bloqueia ausência de decisão, solicitação de ajustes e aprovação parcial vazia', () => {
	for (const decision of ['- [ ] Aprovar todos os cenários', '- [x] Solicitar ajustes', '- [x] Aprovar parcialmente']) {
		const root = workspace();
		write(root, 'qa/cards/TEST-1/bdd/TEST-1-review.md', `# Revisão\n${decision}\n`);
		assert.equal(validateGate({ root, card: 'TEST-1', gate: 'G1' }).valid, false);
	}
});

test('G1 bloqueia manifesto alterado depois do alinhamento', () => {
	const root = workspace();
	const file = 'qa/cards/TEST-1/context/discovery.json';
	const manifest = JSON.parse(read(root, file));
	manifest.limitations.push('alteração posterior');
	write(root, file, manifest);
	const result = validateGate({ root, card: 'TEST-1', gate: 'G1' });
	assert.equal(result.valid, false);
	assert.equal(result.checks.find((item) => item.id === 'G1.discovery-hash')?.ok, false);
});

test('G2 passa somente quando payload referencia G1 e feature atuais', () => {
	const root = workspace('AWAITING_G2');
	const review = 'qa/cards/TEST-1/bdd/TEST-1-review.md';
	const feature = 'qa/cards/TEST-1/bdd/modulo/TEST-1.feature';
	const g1 = { by: 'QA', at: '2026-01-01', artifact: review, sha256: sha256(read(root, review)) };
	const state = JSON.parse(read(root, 'qa/runs/TEST-1/state.json'));
	state.gates.G1 = g1;
	write(root, 'qa/runs/TEST-1/state.json', state);
	write(root, 'qa/cards/TEST-1/zephyr/zephyr-sync-payload.json', {
		mode: 'dry-run', published: false, status: 'approved-g1', card: 'TEST-1', projectKey: 'VPOS', warnings: [],
		g1: { approved: true, ...g1 }, feature: { sha256: sha256(read(root, feature)) },
		items: [{ name: '[TEST-1][Web][Sucesso] Validar fluxo mínimo', operation: 'criar', key: null }],
	});
	write(root, 'qa/cards/TEST-1/zephyr/zephyr-dry-run.json', { mode: 'dry-run', published: false });
	const result = validateGate({ root, card: 'TEST-1', gate: 'G2' });
	assert.equal(result.valid, true, failures(result));
});

test('G2 bloqueia hash antigo e payload autodeclarado', () => {
	const root = workspace('AWAITING_G2');
	const review = 'qa/cards/TEST-1/bdd/TEST-1-review.md';
	const state = JSON.parse(read(root, 'qa/runs/TEST-1/state.json'));
	state.gates.G1 = { by: 'QA', at: '2026-01-01', artifact: review, sha256: 'hash-antigo' };
	write(root, 'qa/runs/TEST-1/state.json', state);
	write(root, 'qa/cards/TEST-1/zephyr/zephyr-sync-payload.json', { mode: 'dry-run', published: false, status: 'approved-g1', card: 'TEST-1', projectKey: 'VPOS', warnings: [], items: [] });
	const result = validateGate({ root, card: 'TEST-1', gate: 'G2' });
	assert.equal(result.valid, false);
	assert.equal(result.checks.find((item) => item.id === 'G1.hash')?.ok, false);
	assert.equal(result.checks.find((item) => item.id === 'G2.g1-provenance')?.ok, false);
});

test('G3 passa com decisão, typecheck, execução e evidência todos verdes', () => {
	const root = workspace('AWAITING_G3');
	const payload = 'qa/cards/TEST-1/zephyr/zephyr-sync-payload.json';
	write(root, payload, { mode: 'dry-run', items: [{ order: 1, name: '[TEST-1][Web][Sucesso] Validar fluxo mínimo', key: 'VPOS-T1' }] });
	const state = JSON.parse(read(root, 'qa/runs/TEST-1/state.json'));
	state.gates.G2 = { by: 'QA', at: '2026-01-01', artifact: payload, sha256: sha256(read(root, payload)) };
	write(root, 'qa/runs/TEST-1/state.json', state);
	write(root, 'qa/approvals/TEST-1/automation-decision.md', '# Decisão\n- **Status:** APROVADO\n| Cenário | Chave | Decisão |\n|---|---|---|\n| S01 | VPOS-T1 | automatizar |\n');
	write(root, 'qa/approvals/TEST-1/executions/run-1/execution.md', '# Execução\n- Resultado: passed\n- Typecheck: passed\n');
	write(root, 'evidence/TEST-1/run-1/PASS/step.png', 'png');
	write(root, 'qa/approvals/TEST-1/executions/run-1/evidence-manifest.json', { result: 'passed', typecheck: 'passed', entries: [{ zephyrKey: 'VPOS-T1', status: 'PASS', steps: [{ status: 'PASS', screenshot: 'PASS/step.png' }] }] });
	const result = validateGate({ root, card: 'TEST-1', gate: 'G3', runId: 'run-1' });
	assert.equal(result.valid, true, failures(result));
});

test('G3 bloqueia decisão sem status, cenário FAIL e typecheck ausente', () => {
	const root = workspace('AWAITING_G3');
	const payload = 'qa/cards/TEST-1/zephyr/zephyr-sync-payload.json';
	write(root, payload, { mode: 'dry-run', items: [{ order: 1, name: '[TEST-1][Web][Sucesso] Validar fluxo mínimo', key: 'VPOS-T1' }] });
	const state = JSON.parse(read(root, 'qa/runs/TEST-1/state.json'));
	state.gates.G2 = { by: 'QA', at: '2026-01-01', artifact: payload, sha256: sha256(read(root, payload)) };
	write(root, 'qa/runs/TEST-1/state.json', state);
	write(root, 'qa/approvals/TEST-1/automation-decision.md', '# Decisão sem status\n');
	write(root, 'qa/approvals/TEST-1/executions/run-1/execution.md', '- Resultado: passed\n');
	write(root, 'evidence/TEST-1/run-1/FAIL/step.png', 'png');
	write(root, 'qa/approvals/TEST-1/executions/run-1/evidence-manifest.json', { result: 'passed', entries: [{ zephyrKey: 'VPOS-T1', status: 'FAIL', steps: [{ status: 'FAIL', screenshot: 'FAIL/step.png' }] }] });
	const result = validateGate({ root, card: 'TEST-1', gate: 'G3', runId: 'run-1' });
	assert.equal(result.valid, false);
	assert.equal(result.checks.find((item) => item.id === 'G3.traceability')?.ok, false);
	assert.equal(result.checks.find((item) => item.id === 'G3.typecheck')?.ok, false);
});

test('G1 não usa a lista de rejeitados para aprovar parcialmente', () => {
	const root = workspace();
	write(root, 'qa/cards/TEST-1/bdd/TEST-1-review.md', `
# Revisão
- [x] Aprovar parcialmente
### Cenários aprovados
-
### Cenários rejeitados ou ajustados
- S01
`);
	const result = validateGate({ root, card: 'TEST-1', gate: 'G1' });
	assert.equal(result.valid, false);
	assert.equal(result.checks.find((item) => item.id === 'G1.partial-selection')?.ok, false);
});

test('discovery rejeita artefato de fonte ainda no template', () => {
	const root = workspace();
	write(root, 'qa/cards/TEST-1/context/jira-context.md', '# Jira\n- Data: a preencher\n');
	const manifest = JSON.parse(read(root, 'qa/cards/TEST-1/context/discovery.json'));
	const checks = validateDiscoveryManifest(manifest, 'TEST-1', root);
	assert.equal(checks.find((item) => item.id === 'discovery.artifact.jira.filled')?.ok, false);
});

test('G3 rejeita typecheck do manifesto, cenário sem passos e diretório como evidência', () => {
	const root = workspace('AWAITING_G3');
	const payload = 'qa/cards/TEST-1/zephyr/zephyr-sync-payload.json';
	write(root, payload, { mode: 'dry-run', items: [{ order: 1, name: '[TEST-1][Web][Sucesso] Validar fluxo mínimo', key: 'VPOS-T1' }] });
	const state = JSON.parse(read(root, 'qa/runs/TEST-1/state.json'));
	state.gates.G2 = { by: 'QA', at: '2026-01-01', artifact: payload, sha256: sha256(read(root, payload)) };
	write(root, 'qa/runs/TEST-1/state.json', state);
	write(root, 'qa/approvals/TEST-1/automation-decision.md', '- **Status:** APROVADO\n');
	write(root, 'qa/approvals/TEST-1/executions/run-1/execution.md', '- Resultado: passed\n- Typecheck: passed\n');
	mkdirSync(path.join(root, 'evidence/TEST-1/run-1/PASS'), { recursive: true });
	write(root, 'qa/approvals/TEST-1/executions/run-1/evidence-manifest.json', { result: 'passed', typecheck: 'failed', entries: [{ zephyrKey: 'VPOS-T1', status: 'PASS', screenshot: 'PASS', steps: [] }] });
	const result = validateGate({ root, card: 'TEST-1', gate: 'G3', runId: 'run-1' });
	assert.equal(result.valid, false);
	assert.equal(result.checks.find((item) => item.id === 'G3.manifest-typecheck')?.ok, false);
	assert.equal(result.checks.find((item) => item.id === 'G3.traceability')?.ok, false);
});

test('allowlist exige HTTPS e hostname exato', () => {
	const hosts = ['mcp.atlassian.com'];
	assert.equal(allowedHttpsUrl('https://mcp.atlassian.com/v1/mcp', hosts), true);
	assert.equal(allowedHttpsUrl('http://mcp.atlassian.com/v1/mcp', hosts), false);
	assert.equal(allowedHttpsUrl('https://evil.example/v1/mcp', hosts), false);
	assert.equal(allowedHttpsUrl('não-é-url', hosts), false);
});

test('retornos de fase invalidam gates dependentes', () => {
	assert.deepEqual(invalidatedGatesForTransition('AWAITING_G1', 'BDD'), ['G1', 'G2', 'G3']);
	assert.deepEqual(invalidatedGatesForTransition('AWAITING_G2', 'ZEPHYR'), ['G2', 'G3']);
	assert.deepEqual(invalidatedGatesForTransition('AWAITING_G3', 'AUTOMATION'), ['G3']);
	assert.deepEqual(invalidatedGatesForTransition('AWAITING_G1', 'ZEPHYR'), []);
});

function failures(result) {
	return result.checks.filter((item) => !item.ok).map((item) => `${item.id}: ${item.message}`).join('\n');
}

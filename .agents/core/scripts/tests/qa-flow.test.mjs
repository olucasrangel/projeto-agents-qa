import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { specsHash } from '../lib/atdd.mjs';
import { allowedHttpsUrl } from '../lib/doctor-validation.mjs';
import { checkAutomationOwnership } from '../lib/ownership.mjs';
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
ownership:
  zephyr:
    automation_folder_suffix: '(Automação)'
    team_cases: read-only
    owned_registry: qa/cards/{CARD}/zephyr/owned-cases.json
  automation:
    protected_roots: [projects/app, shared]
    owned_paths: [projects/app/tests/agent, projects/app/pages/agent, projects/app/flows/agent, projects/app/data/agent]
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
# language: en
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

test('G1 rejeita palavras-chave Gherkin em português', () => {
	const root = workspace();
	write(root, 'qa/cards/TEST-1/bdd/modulo/TEST-1.feature', `
# language: pt
@TEST-1
Funcionalidade: Fluxo
  @TEST-1 @critical
  Cenário: [TEST-1][Web][Sucesso] Validar fluxo mínimo
    Dado existe uma condição
    Quando o usuário age
    Então o resultado aparece
`);
	const result = validateGate({ root, card: 'TEST-1', gate: 'G1' });
	assert.equal(result.valid, false);
	assert.match(result.checks.find((item) => item.id === 'G1.feature-valid')?.message ?? '', /inglês|language: en/);
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
		ownership: { teamCases: 'read-only', automationFolder: { name: 'TEST-1 - Card (Automação)' } },
		items: [ownItem()],
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

const T = { redStart: '2026-01-01T10:00:00.000Z', redEnd: '2026-01-01T10:05:00.000Z', greenStart: '2026-01-02T10:00:00.000Z', greenEnd: '2026-01-02T10:05:00.000Z' };
const SPEC = 'projects/app/tests/agent/TEST-1/TEST-1.spec.ts';
const SPEC_BODY = "test('x', { tag: ['@TEST-1', '@S01'] }, async () => {});\n";
const OWNED = ['projects/app/tests/agent', 'projects/app/pages/agent', 'projects/app/flows/agent', 'projects/app/data/agent'];
const hashOf = (root) => specsHash(root, OWNED, 'TEST-1').sha256;

function runManifest(root, runId, phase, patch = {}) {
	const red = phase === 'red';
	const step = { title: 'Then o resultado aparece', status: red ? 'FAIL' : 'PASS', screenshot: `${red ? 'FAIL' : 'PASS'}/step.png` };
	const manifest = {
		card: 'TEST-1', runId, atddPhase: phase, result: red ? 'failed' : 'passed', typecheck: 'passed', runner: 'qa-atdd', specsSha256: hashOf(root),
		startedAt: red ? T.redStart : T.greenStart, finishedAt: red ? T.redEnd : T.greenEnd,
		entries: [{ scenario: 'S01', zephyrKey: 'VPOS-T1', status: red ? 'FAIL' : 'PASS', failureKind: red ? 'assertion' : null, failedStep: red ? step.title : null, steps: [step] }],
		...patch,
	};
	write(root, `evidence/TEST-1/${runId}/${step.screenshot}`, 'png');
	write(root, `qa/approvals/TEST-1/executions/${runId}/evidence-manifest.json`, manifest);
	return sha256(read(root, `qa/approvals/TEST-1/executions/${runId}/evidence-manifest.json`));
}

/**
 * Card pronto para o G3: testes do agente, execução vermelha e verde oficiais em disco e estado coerente.
 * Os testes mutam o que querem quebrar depois de montado.
 */
function g3Workspace({ mode = 'red-first', stateOverrides = {}, redPatch = {}, greenPatch = {} } = {}) {
	const root = workspace('AWAITING_G3');
	write(root, SPEC, SPEC_BODY);
	const payload = 'qa/cards/TEST-1/zephyr/zephyr-sync-payload.json';
	write(root, payload, { mode: 'dry-run', items: [{ order: 1, name: '[TEST-1][Web][Sucesso] Validar fluxo mínimo', key: 'VPOS-T1' }] });
	const state = JSON.parse(read(root, 'qa/runs/TEST-1/state.json'));
	state.gates.G2 = { by: 'QA', at: '2026-01-01', artifact: payload, sha256: sha256(read(root, payload)) };
	const hash = hashOf(root);
	state.atdd = { mode, confirmedBy: 'QA', scenarios: ['S01'], decidedAt: '2026-01-01T00:00:00.000Z' };
	if (mode === 'verify-existing') state.atdd.reason = 'funcionalidade já entregue';
	else {
		const redSha = runManifest(root, 'red-1', 'red', redPatch);
		state.atdd.red = { runId: 'red-1', at: T.redEnd, manifestSha256: redSha, red: ['S01'], alreadySatisfied: [], specsSha256: hash };
	}
	const greenSha = runManifest(root, 'run-1', 'green', greenPatch);
	state.atdd.green = { runId: 'run-1', at: T.greenEnd, manifestSha256: greenSha, result: 'passed', passed: true, specsSha256: hash };
	Object.assign(state.atdd, stateOverrides);
	write(root, 'qa/runs/TEST-1/state.json', state);
	write(root, 'qa/approvals/TEST-1/automation-decision.md', '- **Status:** APROVADO\n| Cenário | Chave | Decisão |\n|---|---|---|\n| S01 | VPOS-T1 | automatizar |\n');
	write(root, 'qa/approvals/TEST-1/executions/run-1/execution.md', '- Resultado: passed\n- Typecheck: passed\n');
	return root;
}

const g3 = (root, changes = []) => validateGate({ root, card: 'TEST-1', gate: 'G3', runId: 'run-1', changes });
const failed = (result, id) => result.checks.find((item) => item.id === id)?.ok === false;
const readState = (root) => JSON.parse(read(root, 'qa/runs/TEST-1/state.json'));

test('G3 com ATDD red-first completo passa', () => {
	const result = g3(g3Workspace());
	assert.equal(result.valid, true, failures(result));
});

test('G3 com verify-existing e motivo passa; sem motivo ou sem confirmação do QA bloqueia', () => {
	assert.equal(g3(g3Workspace({ mode: 'verify-existing' })).valid, true);
	assert.equal(failed(g3(g3Workspace({ mode: 'verify-existing', stateOverrides: { reason: ' ' } })), 'G3.atdd-reason'), true);
	assert.equal(failed(g3(g3Workspace({ stateOverrides: { confirmedBy: '' } })), 'G3.atdd-mode-confirmed'), true);
});

test('G3 bloqueia card sem modo ATDD ou sem prova vermelha', () => {
	const root = g3Workspace();
	const state = readState(root);
	delete state.atdd;
	write(root, 'qa/runs/TEST-1/state.json', state);
	assert.equal(failed(g3(root), 'G3.atdd-recorded'), true);
	assert.equal(failed(g3(g3Workspace({ stateOverrides: { red: undefined } })), 'G3.atdd-red-manifest'), true);
});

test('G3 bloqueia vermelho por motivo errado: falha em Given, execução ou passo fora do BDD', () => {
	const entry = (extra) => ({ scenario: 'S01', zephyrKey: 'VPOS-T1', status: 'FAIL', failureKind: 'assertion', failedStep: 'Then o resultado aparece', steps: [{ title: 'Then o resultado aparece', status: 'FAIL', screenshot: 'FAIL/step.png' }], ...extra });
	for (const patch of [
		{ failedStep: 'Given existe uma condição', steps: [{ title: 'Given existe uma condição', status: 'FAIL', screenshot: 'FAIL/step.png' }] },
		{ failureKind: 'execution' },
		{ failedStep: 'Then passo inventado fora do BDD', steps: [{ title: 'Then passo inventado fora do BDD', status: 'FAIL', screenshot: 'FAIL/step.png' }] },
	]) {
		const root = g3Workspace({ redPatch: { entries: [entry(patch)] } });
		assert.equal(failed(g3(root), 'G3.atdd-red-proof'), true, JSON.stringify(patch));
	}
});

test('G3 bloqueia vermelho que terminou depois de a verde começar', () => {
	const root = g3Workspace({ redPatch: { finishedAt: '2026-01-03T00:00:00.000Z' } });
	assert.equal(failed(g3(root), 'G3.atdd-red-before-green'), true);
});

test('G3 bloqueia vermelho sem evidência em disco', () => {
	const root = g3Workspace();
	rmSync(path.join(root, 'evidence/TEST-1/red-1/FAIL/step.png'));
	assert.equal(failed(g3(root), 'G3.atdd-red-evidence'), true);
});

test('G3 bloqueia testes alterados depois do vermelho, mesmo que a execução final seja de outros testes', () => {
	const root = g3Workspace();
	write(root, SPEC, "test('x', { tag: ['@TEST-1', '@S01'] }, async () => { /* afrouxado */ });\n");
	const result = g3(root);
	assert.equal(failed(result, 'G3.atdd-specs-chain'), true);
	assert.equal(failed(result, 'G3.atdd-green-official'), true);
});

test('G3 cobre asserção movida para helper do agente (hash cobre todos os diretórios do agente)', () => {
	const root = g3Workspace();
	write(root, 'projects/app/pages/agent/Helper.ts', 'export const ok = () => true;\n');
	assert.equal(failed(g3(root), 'G3.atdd-specs-chain'), true);
});

test('G3 bloqueia execução não oficial: sem runner, sem typecheck ou com hash de outros testes', () => {
	for (const greenPatch of [{ runner: null }, { typecheck: 'not-recorded' }, { specsSha256: 'outros-testes' }]) {
		assert.equal(failed(g3(g3Workspace({ greenPatch })), 'G3.atdd-green-official'), true, JSON.stringify(greenPatch));
	}
	assert.equal(failed(g3(g3Workspace({ redPatch: { runner: null } })), 'G3.atdd-red-official'), true);
});

test('G3 bloqueia manifesto adulterado depois de registrado', () => {
	const root = g3Workspace();
	const file = 'qa/approvals/TEST-1/executions/run-1/evidence-manifest.json';
	write(root, file, { ...JSON.parse(read(root, file)), result: 'passed', adulterado: true });
	assert.equal(failed(g3(root), 'G3.atdd-green-manifest'), true);
});

test('G3 bloqueia execução final que falhou ou é de outro run-id', () => {
	const falha = g3Workspace({ greenPatch: { result: 'failed', entries: [{ scenario: 'S01', zephyrKey: 'VPOS-T1', status: 'FAIL', failureKind: 'assertion', steps: [{ title: 'Then o resultado aparece', status: 'FAIL', screenshot: 'PASS/step.png' }] }] } });
	assert.equal(failed(g3(falha), 'G3.atdd-green'), true);
	const outro = g3Workspace();
	const state = readState(outro);
	state.atdd.green.runId = 'run-9';
	write(outro, 'qa/runs/TEST-1/state.json', state);
	assert.equal(failed(g3(outro), 'G3.atdd-green-run'), true);
});

test('G3 bloqueia cenário selecionado sem teste de aceite', () => {
	assert.equal(failed(g3(g3Workspace({ stateOverrides: { scenarios: ['S01', 'S02'] } })), 'G3.atdd-scenarios'), true);
});

test('G3 aceita mudança nos testes reconhecida pelo QA e rejeita ack inválido', () => {
	const root = g3Workspace();
	const state = readState(root);
	const original = state.atdd.red.specsSha256;
	write(root, SPEC, "test('x', { tag: ['@TEST-1', '@S01'] }, async () => { /* seletor corrigido */ });\n");
	const novo = hashOf(root);
	// Nova execução verde sobre os testes novos, depois do ack.
	const greenSha = runManifest(root, 'run-1', 'green');
	state.atdd.acknowledgements = [{ by: 'QA', reason: 'seletor corrigido, critério inalterado', at: T.greenStart, from: original, to: novo }];
	state.atdd.red.specsSha256 = novo;
	state.atdd.green = { ...state.atdd.green, manifestSha256: greenSha, specsSha256: novo };
	write(root, 'qa/runs/TEST-1/state.json', state);
	assert.equal(g3(root).valid, true, failures(g3(root)));
	state.atdd.acknowledgements[0].from = 'hash-inventado';
	write(root, 'qa/runs/TEST-1/state.json', state);
	assert.equal(failed(g3(root), 'G3.atdd-specs-chain'), true);
	state.atdd.acknowledgements[0] = { ...state.atdd.acknowledgements[0], from: original, reason: '' };
	write(root, 'qa/runs/TEST-1/state.json', state);
	assert.equal(failed(g3(root), 'G3.atdd-specs-chain'), true);
});

test('G3 bloqueia decisão sem status, cenário FAIL, diretório como evidência e typecheck ausente', () => {
	const root = g3Workspace({ greenPatch: { typecheck: 'failed' } });
	write(root, 'qa/approvals/TEST-1/automation-decision.md', '# Decisão sem status\n');
	write(root, 'qa/approvals/TEST-1/executions/run-1/execution.md', '- Resultado: passed\n');
	const result = g3(root);
	assert.equal(result.valid, false);
	assert.equal(failed(result, 'G3.automation-decision'), true);
	assert.equal(failed(result, 'G3.typecheck'), true);
	assert.equal(failed(result, 'G3.manifest-typecheck'), true);
});

test('G3 bloqueia entrega que altera teste do time', () => {
	const result = g3(g3Workspace(), [{ status: 'M', path: 'projects/app/tests/ppc/listagem.spec.ts' }]);
	assert.equal(result.valid, false);
	assert.equal(failed(result, 'G3.ownership'), true);
});


function ownItem(overrides = {}) {
	return {
		order: 1,
		name: '[TEST-1][Web][Sucesso] Validar fluxo mínimo',
		operation: 'criar',
		key: null,
		owned: false,
		folder: 'automation',
		status: 'Draft',
		objective: 'Fluxo',
		priorityName: 'High',
		precondition: ['Given existe uma condição'],
		steps: [{ index: 1, action: 'When o usuário age', expectedResult: 'Then o resultado aparece' }],
		teamReference: { key: 'VPOS-T1', access: 'read-only' },
		...overrides,
	};
}

function g2Workspace(itemOverrides, ownershipOverrides = {}) {
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
		ownership: { teamCases: 'read-only', automationFolder: { name: 'TEST-1 - Card (Automação)' }, ...ownershipOverrides },
		items: [ownItem(itemOverrides)],
	});
	write(root, 'qa/cards/TEST-1/zephyr/zephyr-dry-run.json', { mode: 'dry-run', published: false });
	return root;
}

test('G2 bloqueia atualizar caso do time', () => {
	const root = g2Workspace({ operation: 'atualizar', key: 'VPOS-T1', owned: false, teamReference: null });
	const result = validateGate({ root, card: 'TEST-1', gate: 'G2' });
	assert.equal(result.valid, false);
	assert.equal(result.checks.find((item) => item.id === 'G2.no-team-write')?.ok, false);
});

test('G2 bloqueia pasta do agente sem o sufixo (Automação)', () => {
	const root = g2Workspace({}, { automationFolder: { name: 'TEST-1 - Card' } });
	const result = validateGate({ root, card: 'TEST-1', gate: 'G2' });
	assert.equal(result.valid, false);
	assert.equal(result.checks.find((item) => item.id === 'G2.own-folder')?.ok, false);
});

test('G2 bloqueia caso sem precondição ou fora do padrão Validar', () => {
	for (const override of [{ precondition: [] }, { name: '[TEST-1][Web][Sucesso] Fluxo mínimo' }]) {
		const root = g2Workspace(override);
		assert.equal(validateGate({ root, card: 'TEST-1', gate: 'G2' }).valid, false);
	}
});

test('G2 permite atualizar caso registrado como do próprio agente', () => {
	const root = g2Workspace({ operation: 'atualizar', key: 'VPOS-T9', owned: true, teamReference: null });
	write(root, 'qa/cards/TEST-1/zephyr/owned-cases.json', { cases: [{ key: 'VPOS-T9' }] });
	const result = validateGate({ root, card: 'TEST-1', gate: 'G2' });
	assert.equal(result.checks.find((item) => item.id === 'G2.no-team-write')?.ok, true);
});

test('propriedade da automação: só arquivos novos nos diretórios do agente', () => {
	const ownership = { automation: { protected_roots: ['projects/app', 'shared'], owned_paths: ['projects/app/tests/agent'] } };
	assert.deepEqual(checkAutomationOwnership([{ status: 'A', path: 'projects/app/tests/agent/PGPO-1.spec.ts' }, { status: 'A', path: 'qa/cards/X/y.md' }], ownership), []);
	assert.equal(checkAutomationOwnership([{ status: 'M', path: 'projects/app/tests/ppc/listagem.spec.ts' }], ownership).length, 1);
	assert.equal(checkAutomationOwnership([{ status: 'D', path: 'projects/app/pages/LoginPage.ts' }], ownership).length, 1);
	assert.equal(checkAutomationOwnership([{ status: 'A', path: 'projects/app/pages/NovaPage.ts' }], ownership).length, 1);
	assert.equal(checkAutomationOwnership([{ status: 'M', path: 'shared/reporter.ts' }], ownership).length, 1);
});

function failures(result) {
	return result.checks.filter((item) => !item.ok).map((item) => `${item.id}: ${item.message}`).join('\n');
}

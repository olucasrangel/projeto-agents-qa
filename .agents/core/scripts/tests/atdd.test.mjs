import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { automatedScenarios, isLocalRunId, missingEvidence, officialRunProblems, scanSpecs, specsHash, validateGreenRun, validateRedRun } from '../lib/atdd.mjs';
import { classifyFailure } from '../../../../shared/failure-kind.ts';

const SCRIPTS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const entry = (scenario, status, failureKind = null, failedStep = status === 'FAIL' ? 'Then o resultado aparece' : null) => ({ scenario, status, failureKind, failedStep, title: `t-${scenario}` });
const manifest = (phase, entries, result = 'failed') => ({ atddPhase: phase, result, entries });
const ids = (result) => result.checks.filter((item) => !item.ok).map((item) => item.id);

test('classifica falha de asserção e falha de execução', () => {
	assert.equal(classifyFailure({ message: 'Error: expect(locator).toBeVisible() failed\nLocator: #x' }), 'assertion');
	assert.equal(classifyFailure({ message: '\u001b[31mError: expect(received).toBe(expected)\u001b[0m' }), 'assertion');
	assert.equal(classifyFailure({ message: 'Error: PENDENTE_LIGAR: Given algo' }), 'execution');
	assert.equal(classifyFailure({ message: 'locator.click: Timeout 60000ms exceeded.' }), 'execution');
	assert.equal(classifyFailure({ message: 'Error: Variável de ambiente ERP_STAGE_COORD_USERNAME não definida.' }), 'execution');
	assert.equal(classifyFailure(undefined), 'execution');
});

test('prova vermelha válida: falha por asserção em todos os vermelhos', () => {
	const result = validateRedRun(manifest('red', [entry('S01', 'FAIL', 'assertion'), entry('S02', 'FAIL', 'assertion')]), ['S01', 'S02']);
	assert.equal(result.valid, true);
	assert.deepEqual(result.red, ['S01', 'S02']);
});

test('prova vermelha aceita cenário já atendido, mas informa', () => {
	const result = validateRedRun(manifest('red', [entry('S01', 'FAIL', 'assertion'), entry('S02', 'PASS')]), ['S01', 'S02']);
	assert.equal(result.valid, true);
	assert.deepEqual(result.alreadySatisfied, ['S02']);
});

test('prova vermelha inválida: nenhum cenário falhou', () => {
	const result = validateRedRun(manifest('red', [entry('S01', 'PASS')], 'passed'), ['S01']);
	assert.equal(result.valid, false);
	assert.deepEqual(ids(result), ['atdd.red.has-failure']);
});

test('prova vermelha inválida: falha de execução não é motivo certo', () => {
	const result = validateRedRun(manifest('red', [entry('S01', 'FAIL', 'execution')]), ['S01']);
	assert.equal(result.valid, false);
	assert.deepEqual(ids(result), ['atdd.red.right-reason']);
	assert.deepEqual(result.wrongReason, ['S01']);
});

test('prova vermelha inválida: cenário sem teste, ignorado ou fase errada', () => {
	assert.ok(ids(validateRedRun(manifest('red', [entry('S01', 'FAIL', 'assertion')]), ['S01', 'S02'])).includes('atdd.red.coverage'));
	assert.ok(ids(validateRedRun(manifest('red', [entry('S01', 'FAIL', 'assertion'), entry('S02', 'SKIPPED')]), ['S01', 'S02'])).includes('atdd.red.no-skipped'));
	assert.ok(ids(validateRedRun(manifest('green', [entry('S01', 'FAIL', 'assertion')]), ['S01'])).includes('atdd.red.phase'));
	assert.equal(validateRedRun(manifest('red', []), []).valid, false);
});

test('execução verde exige fase green, tudo PASS e os mesmos cenários', () => {
	assert.ok(validateGreenRun(manifest('green', [entry('S01', 'PASS'), entry('S02', 'PASS')], 'passed'), ['S01', 'S02']).every((item) => item.ok));
	assert.equal(validateGreenRun(manifest('green', [entry('S01', 'PASS'), entry('S02', 'FAIL', 'assertion')], 'failed'), ['S01', 'S02']).every((item) => item.ok), false);
	assert.equal(validateGreenRun(manifest('green', [entry('S01', 'PASS')], 'passed'), ['S01', 'S02']).every((item) => item.ok), false);
	assert.equal(validateGreenRun(manifest('red', [entry('S01', 'PASS')], 'passed'), ['S01']).every((item) => item.ok), false);
});

test('lê cenários marcados como automatizar na decisão', () => {
	const text = '| Cenário | Chave | Decisão | Justificativa |\n|---|---|---|---|\n| S01 | VPOS-T1 | automatizar | ok |\n| S02 | | manter-manual | x |\n| S03 | | Automatizar | x |\n| livre | | automatizar | x |\n';
	assert.deepEqual(automatedScenarios(text), ['S01', 'S03']);
});

test('hash dos specs muda quando o teste muda e ignora a pasta de outro card', () => {
	const root = mkdtempSync(path.join(tmpdir(), 'atdd-hash-'));
	const put = (relative, content) => {
		const file = path.join(root, relative);
		mkdirSync(path.dirname(file), { recursive: true });
		writeFileSync(file, content);
	};
	put('tests/agent/TEST-1/a.spec.ts', "tag: ['@TEST-1', '@S01']");
	put('tests/agent/OTHER-9/b.spec.ts', "tag: ['@OTHER-9', '@S01']");
	const before = specsHash(root, ['tests/agent'], 'TEST-1');
	assert.deepEqual(before.files, ['tests/agent/TEST-1/a.spec.ts']);
	put('tests/agent/OTHER-9/b.spec.ts', "tag: ['@OTHER-9', '@S09']");
	assert.equal(specsHash(root, ['tests/agent'], 'TEST-1').sha256, before.sha256);
	put('tests/agent/TEST-1/a.spec.ts', "tag: ['@TEST-1', '@S01'] // alterado");
	assert.notEqual(specsHash(root, ['tests/agent'], 'TEST-1').sha256, before.sha256);
	assert.deepEqual([...scanSpecs(root, ['tests/agent'], 'TEST-1').keys()], ['S01']);
});

test('vermelho exige falha no passo Then; Given e When não valem', () => {
	assert.equal(validateRedRun(manifest('red', [entry('S01', 'FAIL', 'assertion', 'Given existe uma condição')]), ['S01']).valid, false);
	assert.equal(validateRedRun(manifest('red', [entry('S01', 'FAIL', 'assertion', 'When o usuário age')]), ['S01']).valid, false);
	assert.equal(validateRedRun(manifest('red', [entry('S01', 'FAIL', 'assertion', null)]), ['S01']).valid, false);
});

test('com o BDD em mãos, o tipo do passo vem do .feature e não do título livre', () => {
	const kinds = new Map([['S01', new Map([['Given existe uma condição', 'given'], ['Then o resultado aparece', 'then']])]]);
	assert.equal(validateRedRun(manifest('red', [entry('S01', 'FAIL', 'assertion', 'Then o resultado aparece')]), ['S01'], kinds).valid, true);
	// Título que começa com "Then" mas é um passo Given do BDD não vale.
	assert.equal(validateRedRun(manifest('red', [entry('S01', 'FAIL', 'assertion', 'Given existe uma condição')]), ['S01'], kinds).valid, false);
	// Passo que não existe no BDD aprovado não vale.
	assert.equal(validateRedRun(manifest('red', [entry('S01', 'FAIL', 'assertion', 'Then passo inventado')]), ['S01'], kinds).valid, false);
});

test('tag de cenário duplicada invalida a prova com a causa real', () => {
	const bad = { ...entry('S01', 'FAIL', 'assertion'), metadataError: 'esperada no máximo uma tag de cenário; encontradas 2' };
	const result = validateRedRun(manifest('red', [bad]), ['S01']);
	assert.equal(result.valid, false);
	assert.ok(ids(result).includes('atdd.red.metadata'));
});

test('retries duplicados não geram falha falsa de cobertura na execução verde', () => {
	assert.ok(validateGreenRun(manifest('green', [entry('S01', 'PASS'), entry('S01', 'PASS')], 'passed'), ['S01']).every((item) => item.ok));
});

test('run-id local é reconhecido sem distinção de caixa', () => {
	for (const id of ['dev-local', 'DEV-local', 'Dev_x', 'dev.1']) assert.equal(isLocalRunId(id), true, id);
	for (const id of ['red-001', 'device-1', 'run-dev']) assert.equal(isLocalRunId(id), false, id);
});

test('execução só é oficial com runner, typecheck e hash dos testes atuais', () => {
	const ok = { runner: 'qa-atdd', typecheck: 'passed', specsSha256: 'abc' };
	assert.deepEqual(officialRunProblems(ok, 'abc'), []);
	assert.equal(officialRunProblems({ ...ok, runner: null }, 'abc').length, 1);
	assert.equal(officialRunProblems({ ...ok, typecheck: 'not-recorded' }, 'abc').length, 1);
	assert.equal(officialRunProblems({ ...ok, specsSha256: null }, 'abc').length, 1);
	assert.equal(officialRunProblems(ok, 'outro').length, 1);
});

test('hash cobre Page Objects e helpers do agente, mas não os de outro card', () => {
	const root = mkdtempSync(path.join(tmpdir(), 'atdd-hash2-'));
	const put = (relative, content) => {
		const file = path.join(root, relative);
		mkdirSync(path.dirname(file), { recursive: true });
		writeFileSync(file, content);
	};
	put('app/tests/agent/TEST-1/a.spec.ts', "tag: ['@TEST-1']");
	put('app/pages/agent/Page.ts', 'export const a = 1;');
	const owned = ['app/tests/agent', 'app/pages/agent'];
	const base = specsHash(root, owned, 'TEST-1').sha256;
	put('app/pages/agent/Page.ts', 'export const a = 2;');
	assert.notEqual(specsHash(root, owned, 'TEST-1').sha256, base);
	const withHelper = specsHash(root, owned, 'TEST-1').sha256;
	put('app/tests/agent/OTHER-9/b.spec.ts', "tag: ['@OTHER-9']");
	assert.equal(specsHash(root, owned, 'TEST-1').sha256, withHelper);
});

test('evidência ausente é detectada no vermelho', () => {
	const root = mkdtempSync(path.join(tmpdir(), 'atdd-ev-'));
	const config = { evidence: { dir: 'evidence/{CARD}/{runId}' } };
	const m = { entries: [{ scenario: 'S01', status: 'FAIL', steps: [{ title: 't', status: 'FAIL', screenshot: 'FAIL/a.png' }] }] };
	assert.equal(missingEvidence(root, config, 'TEST-1', 'r1', m, 'FAIL').length, 1);
	mkdirSync(path.join(root, 'evidence/TEST-1/r1/FAIL'), { recursive: true });
	writeFileSync(path.join(root, 'evidence/TEST-1/r1/FAIL/a.png'), 'x');
	assert.deepEqual(missingEvidence(root, config, 'TEST-1', 'r1', m, 'FAIL'), []);
	assert.equal(missingEvidence(root, config, 'TEST-1', 'r1', { entries: [{ scenario: 'S01', status: 'FAIL', steps: [] }] }, 'FAIL').length, 1);
});

// ---------------------------------------------------------------- CLI ----

function cliWorkspace() {
	const root = mkdtempSync(path.join(tmpdir(), 'atdd-cli-'));
	const put = (relative, content) => {
		const file = path.join(root, relative);
		mkdirSync(path.dirname(file), { recursive: true });
		writeFileSync(file, typeof content === 'string' ? content : `${JSON.stringify(content, null, 2)}\n`);
	};
	put('.agents/project/qa-project.yaml', `
jira:
  project_keys: [TEST]
stack:
  root: projects/app
zephyr:
  priorities:
    critical: High
    high: Normal
    medium: Low
artifacts:
  executions_dir: qa/approvals/{CARD}/executions/{runId}
evidence:
  dir: evidence/{CARD}/{runId}
ownership:
  zephyr:
    automation_folder_suffix: '(Automação)'
    team_cases: read-only
    owned_registry: qa/cards/{CARD}/zephyr/owned-cases.json
  automation:
    protected_roots: [projects/app]
    owned_paths: [projects/app/tests/agent, projects/app/pages/agent, projects/app/flows/agent, projects/app/data/agent]
atdd:
  specs_dir: projects/app/tests/agent/{CARD}
  dev_guide: qa/cards/{CARD}/automation/atdd-dev-guide.md
  commands:
    run_scenario: 'E2E_RUN_ID=dev-local E2E_ATDD_PHASE={PHASE} npx playwright test projects/app/tests/agent/{CARD} --grep @{SCENARIO}'
    run_card: 'npm run qa:atdd -- run {CARD} --phase {PHASE} --run-id {RUN_ID}'
`);
	put('qa/runs/TEST-1/state.json', { card: 'TEST-1', state: 'AUTOMATION_DECISION', createdAt: 'x', updatedAt: 'x', automationCycles: 0, history: [], gates: {} });
	put('qa/approvals/TEST-1/automation-decision.md', '- **Status:** APROVADO\n| Cenário | Chave | Decisão | Justificativa |\n|---|---|---|---|\n| S01 | | automatizar | crítico |\n| S02 | | manter-manual | visual |\n');
	put('qa/cards/TEST-1/bdd/modulo/TEST-1.feature', `# language: en
@TEST-1
Feature: Fluxo de teste
  @TEST-1 @critical
  Scenario: [TEST-1][Web][Sucesso] Validar o primeiro fluxo
    Given existe uma condição
    When o usuário age
    Then o resultado aparece

  @TEST-1 @high
  Scenario: [TEST-1][Web][Falha] Validar o segundo fluxo
    Given existe outra condição
    When o usuário age de novo
    Then o erro aparece
`);
	return { root, put };
}

const run = (script, cwd, ...args) => spawnSync(process.execPath, [path.join(SCRIPTS, script), ...args], { cwd, encoding: 'utf-8' });
const state = (root) => JSON.parse(readFileSync(path.join(root, 'qa/runs/TEST-1/state.json'), 'utf-8'));
const out = (result) => `${result.stdout}${result.stderr}`;

test('CLI: esqueleto cria testes só dos cenários selecionados, com tags e passos pendentes', () => {
	const { root } = cliWorkspace();
	const created = run('qa-atdd.mjs', root, 'skeleton', 'TEST-1');
	assert.equal(created.status, 0, out(created));
	const file = path.join(root, 'projects/app/tests/agent/TEST-1/TEST-1.spec.ts');
	const source = readFileSync(file, 'utf-8');
	assert.match(source, /'@TEST-1', '@S01', '@critical'/);
	assert.doesNotMatch(source, /@S02/);
	assert.match(source, /Given existe uma condição/);
	assert.match(source, /PENDENTE_LIGAR/);
	assert.match(source, /from '\.\.\/\.\.\/\.\.\/fixtures'/);
	assert.match(source, /shared\/evidence-step/);
	const again = run('qa-atdd.mjs', root, 'skeleton', 'TEST-1');
	assert.notEqual(again.status, 0);
	assert.match(out(again), /nunca sobrescreve/);
});

const SPEC_FILE = 'projects/app/tests/agent/TEST-1/TEST-1.spec.ts';
const SPEC_V1 = "test('x', { tag: ['@TEST-1', '@S01'] }, async () => {});\n";
const THEN = 'Then o resultado aparece';

/** Manifesto como o runner oficial o grava: runner, typecheck, hash dos testes, horários e prints em disco. */
function official(root, put, runId, phase, { status = 'PASS', failureKind = null, failedStep = null, patch = {} } = {}) {
	const dir = status === 'FAIL' ? 'FAIL' : 'PASS';
	put(`evidence/TEST-1/${runId}/${dir}/s.png`, 'png');
	put(`qa/approvals/TEST-1/executions/${runId}/evidence-manifest.json`, {
		card: 'TEST-1', runId, atddPhase: phase, result: status === 'FAIL' ? 'failed' : 'passed', typecheck: 'passed', runner: 'qa-atdd',
		specsSha256: specsHash(root, ['projects/app/tests/agent', 'projects/app/pages/agent', 'projects/app/flows/agent', 'projects/app/data/agent'], 'TEST-1').sha256,
		startedAt: phase === 'red' ? '2026-01-01T10:00:00.000Z' : '2026-01-02T10:00:00.000Z',
		finishedAt: phase === 'red' ? '2026-01-01T10:05:00.000Z' : '2026-01-02T10:05:00.000Z',
		entries: [{ scenario: 'S01', status, failureKind, failedStep, title: 't', steps: [{ title: failedStep ?? THEN, status, screenshot: `${dir}/s.png` }] }],
		...patch,
	});
}

const enterAutomation = (qa, ...extra) => qa('advance', 'TEST-1', 'AUTOMATION', '--atdd-mode', 'red-first', '--by', 'Maria QA', ...extra);

test('CLI: ciclo red-first completo com bloqueios em cada passo', () => {
	const { root, put } = cliWorkspace();
	const qa = (...args) => run('qa-state.mjs', root, ...args);

	// Entrar em AUTOMATION exige modo, confirmação do QA e cenários selecionados.
	assert.match(out(qa('advance', 'TEST-1', 'AUTOMATION')), /--atdd-mode/);
	assert.match(out(qa('advance', 'TEST-1', 'AUTOMATION', '--atdd-mode', 'red-first')), /--by/);
	assert.match(out(qa('advance', 'TEST-1', 'AUTOMATION', '--atdd-mode', 'verify-existing', '--by', 'Maria QA')), /--reason/);
	assert.equal(enterAutomation(qa).status, 0);
	assert.deepEqual(state(root).atdd.scenarios, ['S01']);
	assert.equal(state(root).atdd.confirmedBy, 'Maria QA');

	// Sem teste de aceite com @S01 não há prova vermelha, nem execução direta.
	assert.match(out(qa('advance', 'TEST-1', 'RED')), /sem teste de aceite/);
	assert.match(out(qa('advance', 'TEST-1', 'RUN')), /prova vermelha oficial/);
	put(SPEC_FILE, SPEC_V1);
	assert.equal(qa('advance', 'TEST-1', 'RED').status, 0);

	// A prova vermelha precisa ser oficial, de run-id oficial, por expect() no Then e com evidência.
	assert.match(out(qa('advance', 'TEST-1', 'AWAITING_DEV')), /run-id/);
	official(root, put, 'red-1', 'red', { status: 'FAIL', failureKind: 'assertion', failedStep: THEN, patch: { runner: null } });
	assert.match(out(qa('advance', 'TEST-1', 'AWAITING_DEV', '--run-id', 'red-1')), /runner oficial/);
	official(root, put, 'red-1', 'red', { status: 'FAIL', failureKind: 'execution', failedStep: THEN });
	assert.match(out(qa('advance', 'TEST-1', 'AWAITING_DEV', '--run-id', 'red-1')), /expect\(\) em passo Then/);
	official(root, put, 'red-1', 'red', { status: 'FAIL', failureKind: 'assertion', failedStep: 'Given existe uma condição' });
	assert.match(out(qa('advance', 'TEST-1', 'AWAITING_DEV', '--run-id', 'red-1')), /expect\(\) em passo Then/);
	official(root, put, 'red-1', 'red', { status: 'FAIL', failureKind: 'assertion', failedStep: THEN });
	rmSync(path.join(root, 'evidence/TEST-1/red-1/FAIL/s.png'));
	assert.match(out(qa('advance', 'TEST-1', 'AWAITING_DEV', '--run-id', 'red-1')), /sem evidência em disco/);
	put('evidence/TEST-1/red-1/FAIL/s.png', 'png');
	assert.match(out(qa('advance', 'TEST-1', 'AWAITING_DEV', '--run-id', 'red-1')), /guia de desenvolvimento ausente/);
	put('qa/cards/TEST-1/automation/atdd-dev-guide.md', '# guia\n');
	for (const local of ['dev-local', 'DEV-local']) {
		official(root, put, local, 'red', { status: 'FAIL', failureKind: 'assertion', failedStep: THEN });
		assert.match(out(qa('advance', 'TEST-1', 'AWAITING_DEV', '--run-id', local)), /dev-\*/);
	}
	assert.equal(qa('advance', 'TEST-1', 'AWAITING_DEV', '--run-id', 'red-1').status, 0);
	assert.equal(state(root).atdd.red.runId, 'red-1');
	assert.deepEqual(state(root).atdd.red.red, ['S01']);
	assert.ok(state(root).atdd.red.manifestSha256);

	// Mudar o teste durante o desenvolvimento exige o reconhecimento do QA.
	put(SPEC_FILE, `${SPEC_V1}// afrouxado\n`);
	assert.match(out(qa('advance', 'TEST-1', 'RUN')), /mudaram durante o desenvolvimento/);
	put(SPEC_FILE, SPEC_V1);

	// Dev implementa; a execução final precisa ser verde, oficial e sobre os mesmos testes.
	assert.equal(qa('advance', 'TEST-1', 'RUN').status, 0);
	official(root, put, 'run-1', 'red', { patch: { atddPhase: 'red' } });
	assert.match(out(qa('advance', 'TEST-1', 'REPORT', '--run-id', 'run-1')), /fase green/);
	official(root, put, 'run-1', 'green', { patch: { runner: null } });
	assert.match(out(qa('advance', 'TEST-1', 'REPORT', '--run-id', 'run-1')), /runner oficial/);
	official(root, put, 'run-1', 'green', { patch: { specsSha256: 'outros-testes' } });
	assert.match(out(qa('advance', 'TEST-1', 'REPORT', '--run-id', 'run-1')), /testes mudaram/);
	official(root, put, 'run-1', 'green', { patch: { startedAt: '2025-12-31T00:00:00.000Z', finishedAt: '2025-12-31T00:05:00.000Z' } });
	assert.match(out(qa('advance', 'TEST-1', 'REPORT', '--run-id', 'run-1')), /começado depois/);
	official(root, put, 'run-1', 'green');
	assert.equal(qa('advance', 'TEST-1', 'REPORT', '--run-id', 'run-1').status, 0);
	const finalState = state(root).atdd;
	assert.equal(finalState.green.passed, true);
	assert.equal(finalState.green.specsSha256, finalState.red.specsSha256);

	// Voltar ao desenvolvimento descarta a execução final anterior.
	assert.equal(qa('advance', 'TEST-1', 'AWAITING_DEV').status, 0);
	assert.equal(state(root).atdd.green, undefined);
});

test('CLI: verify-existing exige motivo e confirmação, e pula a prova vermelha', () => {
	const { root, put } = cliWorkspace();
	const qa = (...args) => run('qa-state.mjs', root, ...args);
	assert.equal(qa('advance', 'TEST-1', 'AUTOMATION', '--atdd-mode', 'verify-existing', '--by', 'Maria QA', '--reason', 'funcionalidade entregue na sprint anterior').status, 0);
	put(SPEC_FILE, SPEC_V1);
	assert.match(out(qa('advance', 'TEST-1', 'RED')), /só existe no modo red-first/);
	assert.equal(qa('advance', 'TEST-1', 'RUN').status, 0);
	assert.equal(state(root).atdd.reason, 'funcionalidade entregue na sprint anterior');
	assert.equal(state(root).atdd.confirmedBy, 'Maria QA');
	official(root, put, 'run-1', 'green');
	assert.equal(qa('advance', 'TEST-1', 'REPORT', '--run-id', 'run-1').status, 0);
	// Em verify-existing, falha de comportamento é bug de produto: não volta ao desenvolvimento.
	assert.match(out(qa('advance', 'TEST-1', 'AWAITING_DEV')), /red-first/);
});

test('CLI: atdd-ack só vale com mudança real, motivo e responsável, e invalida a execução final', () => {
	const { root, put } = cliWorkspace();
	const qa = (...args) => run('qa-state.mjs', root, ...args);
	enterAutomation(qa);
	put(SPEC_FILE, SPEC_V1);
	qa('advance', 'TEST-1', 'RED');
	official(root, put, 'red-1', 'red', { status: 'FAIL', failureKind: 'assertion', failedStep: THEN });
	put('qa/cards/TEST-1/automation/atdd-dev-guide.md', '# guia\n');
	assert.equal(qa('advance', 'TEST-1', 'AWAITING_DEV', '--run-id', 'red-1').status, 0);
	const before = state(root).atdd.red.specsSha256;

	assert.match(out(qa('atdd-ack', 'TEST-1', '--by', 'Maria QA', '--reason', 'x')), /não mudaram/);
	put(SPEC_FILE, `${SPEC_V1}// seletor corrigido\n`);
	assert.match(out(qa('atdd-ack', 'TEST-1', '--by', 'Maria QA')), /--reason/);
	assert.equal(qa('atdd-ack', 'TEST-1', '--by', 'Maria QA', '--reason', 'seletor corrigido, critério inalterado').status, 0);
	const after = state(root).atdd;
	assert.notEqual(after.red.specsSha256, before);
	assert.equal(after.acknowledgements[0].from, before);
	assert.equal(after.acknowledgements[0].by, 'Maria QA');
	assert.equal(after.green, undefined);
	assert.equal(qa('advance', 'TEST-1', 'RUN').status, 0);
});

test('CLI: guia mostra critérios, estado de cada cenário e comando para o dev', () => {
	const { root, put } = cliWorkspace();
	const qa = (...args) => run('qa-state.mjs', root, ...args);
	qa('advance', 'TEST-1', 'AUTOMATION', '--atdd-mode', 'red-first', '--by', 'Maria QA');
	put('qa/approvals/TEST-1/executions/red-1/evidence-manifest.json', {
		card: 'TEST-1', runId: 'red-1', atddPhase: 'red', result: 'failed',
		entries: [{ ...entry('S01', 'FAIL', 'assertion'), failedStep: 'Then o resultado aparece' }],
	});
	const guide = run('qa-atdd.mjs', root, 'guide', 'TEST-1', '--run-id', 'red-1');
	assert.equal(guide.status, 0, out(guide));
	const text = readFileSync(path.join(root, 'qa/cards/TEST-1/automation/atdd-dev-guide.md'), 'utf-8');
	assert.match(text, /VERMELHO \(comportamento ainda não atendido\)/);
	assert.match(text, /Then o resultado aparece/);
	assert.match(text, /E2E_RUN_ID=dev-local E2E_ATDD_PHASE=green npx playwright test projects\/app\/tests\/agent\/TEST-1 --grep @S01/);
	assert.match(text, /Given existe uma condição/);
	assert.doesNotMatch(text, /### S02/);
	assert.equal(existsSync(path.join(root, 'qa/cards/TEST-1/automation/atdd-dev-guide.md')), true);
});

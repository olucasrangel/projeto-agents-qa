#!/usr/bin/env node
/**
 * Relatório final do card (A4).
 *
 *   npm run qa:report -- generate <CARD> [--run-id ID] [--with-evidence]
 *       grava qa/cards/<CARD>/report/{metrics.json, executive-summary.html, allure-results/} (versionável, sem prints)
 *       e gera o relatório Allure local em qa/runs/<CARD>/allure-report.
 *       --with-evidence anexa os prints (só local, em qa/runs/<CARD>/allure-report-evidence; nunca entra no Git).
 *   npm run qa:report -- executor <CARD> --results DIR
 *       grava executor.json a partir das variáveis do GitHub Actions (usado pelo workflow de publicação).
 *   npm run qa:report -- open <CARD>
 *       abre o relatório Allure local.
 */
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import { readApprovals } from './lib/approvals.mjs';
import { loadFeatureScenarios } from './lib/atdd-feature.mjs';
import { validateGate } from './lib/gate-validation.mjs';
import { buildAllure, buildSummaryHtml, candidatesOf, classify, computeMetrics, environmentProperties, timelineOf } from './lib/report.mjs';

const ROOT = process.cwd();
const [command, card, ...rest] = process.argv.slice(2);
const option = (name) => (rest.includes(`--${name}`) ? rest[rest.indexOf(`--${name}`) + 1] : undefined);
const flag = (name) => rest.includes(`--${name}`);

function fail(message) {
	console.error(`qa-report: ${message}`);
	process.exit(1);
}

if (!card || !/^[A-Z][A-Z0-9]+-\d+$/.test(card)) fail('card inválido. Uso: npm run qa:report -- <generate|executor|open> PROJ-123');
const config = parseYaml(readFileSync(path.join(ROOT, '.agents/project/qa-project.yaml'), 'utf-8'));
if (!(config.jira?.project_keys ?? []).includes(card.split('-')[0])) fail(`card ${card} fora dos projetos permitidos.`);

const rel = (target) => path.relative(ROOT, target);
const reportDir = path.join(ROOT, 'qa', 'cards', card, 'report');
const runsDir = path.join(ROOT, 'qa', 'runs', card);
const readJson = (file) => JSON.parse(readFileSync(file, 'utf-8'));
const git = (...args) => spawnSync('git', args, { cwd: ROOT, encoding: 'utf-8' }).stdout?.trim() ?? '';

function gitInfo() {
	const remote = git('remote', 'get-url', 'origin');
	const https = remote.replace(/^git@github\.com:/, 'https://github.com/').replace(/\.git$/, '');
	const branch = process.env.GITHUB_REF_NAME || git('rev-parse', '--abbrev-ref', 'HEAD');
	const github = https.startsWith('https://github.com/');
	return {
		branch,
		commit: (process.env.GITHUB_SHA || git('rev-parse', 'HEAD')).slice(0, 7),
		dirty: Boolean(git('status', '--porcelain', '--', 'qa', 'projects', '.agents', 'shared')),
		remote: github ? https : null,
		branchUrl: github ? `${https}/tree/${branch}` : null,
		prUrl: github ? `${https}/pull/new/${branch}` : null,
	};
}

function executionsOf() {
	const dir = path.join(ROOT, 'qa', 'approvals', card, 'executions');
	if (!existsSync(dir)) return [];
	return readdirSync(dir)
		.filter((name) => !/^dev[-_.]/i.test(name) && existsSync(path.join(dir, name, 'evidence-manifest.json')))
		.map((name) => readJson(path.join(dir, name, 'evidence-manifest.json')))
		.map((run) => ({ runId: run.runId, result: run.result, startedAt: run.startedAt, finishedAt: run.finishedAt }))
		.sort((a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt));
}

function generate() {
	const statePath = path.join(runsDir, 'state.json');
	if (!existsSync(statePath)) fail(`execução de ${card} não iniciada.`);
	const state = readJson(statePath);
	const runId = option('run-id') ?? state.atdd?.green?.runId;
	if (!runId) fail('não há execução verde registrada. Rode a fase green e informe --run-id.');
	const manifestPath = path.join(ROOT, 'qa', 'approvals', card, 'executions', runId, 'evidence-manifest.json');
	if (!existsSync(manifestPath)) fail(`manifesto da execução ${runId} ausente: ${rel(manifestPath)}`);
	const manifest = readJson(manifestPath);

	const approvals = readApprovals(ROOT, config, card);
	if (!approvals) fail('arquivo de aprovações ausente.');
	const feature = loadFeatureScenarios(ROOT, card, config.zephyr?.priorities);
	if (feature.error) fail(feature.error);
	const featureFile = path.join(ROOT, 'qa', 'cards', card, 'bdd');
	const featureText = readFileSync(
		readdirSync(featureFile, { recursive: true }).map((name) => path.join(featureFile, name)).find((file) => path.basename(file) === `${card}.feature`),
		'utf-8',
	);
	const header = (pattern) => featureText.match(pattern)?.[1]?.trim();
	const cardTitle = header(/^# Card: [A-Z]+-\d+ · (.+)$/m) ?? card;
	const epic = header(/^# Épico: ([A-Z]+-\d+)/m);
	const candidates = candidatesOf(featureText);

	const ownedFile = path.join(ROOT, 'qa', 'cards', card, 'zephyr', 'owned-cases.json');
	const owned = existsSync(ownedFile) ? readJson(ownedFile) : null;
	const items = classify({
		scenarios: feature.items,
		approvals: approvals.data,
		manifest,
		atddMode: state.atdd?.mode,
		owned,
	}).map((item, index) => ({ ...item, candidate: candidates[index] ?? null }));

	let validation = null;
	try {
		validation = validateGate({ root: ROOT, card, gate: 'G3', runId, state }).checks;
	} catch {
		validation = null;
	}

	const timeline = timelineOf(state);
	const info = gitInfo();
	const metrics = computeMetrics({ card, items, manifest, history: executionsOf(), timeline, state, approvals: approvals.data, config, validation, owned, git: info });

	const site = (config.jira?.base_url ?? 'https://cogna.atlassian.net').replace(/\/$/, '');
	const zephyrProject = config.zephyr?.project_key ?? manifest.zephyrProjectKey ?? 'VPOS';
	const urls = {
		jira: (key) => `${site}/browse/${key}`,
		zephyr: (key) => `${site}/projects/${zephyrProject}?selectedItem=com.atlassian.plugins.atlassian-connect-plugin:com.kanoah.test-manager__main-project-page#!/v2/testCase/${key}`,
	};

	const writeResults = (dir, withEvidence) => {
		rmSync(dir, { recursive: true, force: true });
		mkdirSync(dir, { recursive: true });
		const evidenceRoot = path.join(ROOT, 'evidence', card, runId);
		let counter = 0;
		const attach = withEvidence
			? (relative) => {
					const source = relative && path.join(evidenceRoot, relative);
					if (!source || !existsSync(source)) return null;
					const name = `evidencia-${String((counter += 1)).padStart(3, '0')}.png`;
					copyFileSync(source, path.join(dir, name));
					return name;
				}
			: null;
		const allure = buildAllure({ card, cardTitle, epic, featureName: feature.featureName, items, manifest, approver: approvals.data.approver, mode: state.atdd?.mode, git: info, urls, attach });
		for (const result of allure.results) writeFileSync(path.join(dir, `${result.uuid}-result.json`), `${JSON.stringify(result, null, '\t')}\n`);
		writeFileSync(path.join(dir, 'categories.json'), `${JSON.stringify(allure.categories, null, '\t')}\n`);
		writeFileSync(path.join(dir, 'environment.properties'), environmentProperties({ card, metrics, git: info, manifest }));
		return allure.results.length;
	};

	const summary = () => buildSummaryHtml({ card, cardTitle, featureName: feature.featureName, items, metrics, git: info, urls, manifest, reportLink: 'index.html' });

	mkdirSync(reportDir, { recursive: true });
	const count = writeResults(path.join(reportDir, 'allure-results'), false);
	writeFileSync(path.join(reportDir, 'metrics.json'), `${JSON.stringify(metrics, null, '\t')}\n`);
	writeFileSync(path.join(reportDir, 'executive-summary.html'), summary());
	console.log(`qa-report: ${count} resultado(s), métricas e resumo executivo em ${rel(reportDir)}`);

	const build = (resultsDir, outDir) => {
		const result = spawnSync('npx', ['allure', 'generate', resultsDir, '--output', outDir, '--clean'], { cwd: ROOT, encoding: 'utf-8' });
		if (result.status !== 0) fail(`allure generate falhou:\n${result.stdout}${result.stderr}`);
		copyFileSync(path.join(reportDir, 'executive-summary.html'), path.join(outDir, 'executive-summary.html'));
	};
	build(path.join(reportDir, 'allure-results'), path.join(runsDir, 'allure-report'));
	console.log(`qa-report: relatório Allure local: ${rel(path.join(runsDir, 'allure-report'))}/index.html (abra com: npm run qa:report -- open ${card})`);

	if (flag('with-evidence')) {
		const evidenceResults = path.join(runsDir, 'allure-results-evidence');
		writeResults(evidenceResults, true);
		build(evidenceResults, path.join(runsDir, 'allure-report-evidence'));
		console.log(`qa-report: com prints (somente local, não versionar): ${rel(path.join(runsDir, 'allure-report-evidence'))}/index.html`);
	}
}

function executor() {
	const results = option('results');
	if (!results) fail('informe --results DIR.');
	const server = process.env.GITHUB_SERVER_URL ?? 'https://github.com';
	const repo = process.env.GITHUB_REPOSITORY ?? '';
	const runUrl = repo && process.env.GITHUB_RUN_ID ? `${server}/${repo}/actions/runs/${process.env.GITHUB_RUN_ID}` : '';
	const file = path.join(ROOT, results, 'executor.json');
	mkdirSync(path.dirname(file), { recursive: true });
	writeFileSync(file, `${JSON.stringify({ name: 'GitHub Actions', type: 'github', buildName: `${card} · ${process.env.GITHUB_REF_NAME ?? gitInfo().branch}`, buildUrl: runUrl, reportName: `Relatório ${card}` }, null, '\t')}\n`);
	console.log(`qa-report: executor.json gravado em ${rel(file)}`);
}

switch (command) {
	case 'generate':
		generate();
		break;
	case 'executor':
		executor();
		break;
	case 'open': {
		const index = path.join(runsDir, flag('with-evidence') ? 'allure-report-evidence' : 'allure-report');
		if (!existsSync(path.join(index, 'index.html'))) fail(`relatório ausente. Rode: npm run qa:report -- generate ${card}`);
		spawnSync('npx', ['allure', 'open', index], { cwd: ROOT, stdio: 'inherit' });
		break;
	}
	default:
		fail('comando inválido. Use generate, executor ou open.');
}

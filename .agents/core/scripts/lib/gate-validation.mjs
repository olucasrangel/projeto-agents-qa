import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import { approvedScope, DECISIONS, inScope, publishScope, readApprovals, selectedScenarioIds } from './approvals.mjs';
import { ATDD_MODES, missingEvidence, officialRunProblems, readRunManifest, scanSpecs, specsHash, validateGreenRun, validateRedRun } from './atdd.mjs';
import { automationFolderOk, checkAutomationOwnership, gitChanges, ownershipOf } from './ownership.mjs';

export const GATE_STATES = { G1: 'AWAITING_G1', G2: 'AWAITING_G2', G3: 'AWAITING_G3' };

export function invalidatedGatesForTransition(from, to) {
	if (from === 'AWAITING_G1' && to === 'BDD') return ['G1', 'G2', 'G3'];
	if (from === 'AWAITING_G2' && to === 'ZEPHYR') return ['G2', 'G3'];
	if (from === 'AWAITING_G3' && to === 'AUTOMATION') return ['G3'];
	return [];
}

export function sha256(value) {
	return createHash('sha256').update(value).digest('hex');
}

function check(id, ok, message, remediation) {
	return { id, ok, message, ...(remediation ? { remediation } : {}) };
}

function readJson(file) {
	return JSON.parse(readFileSync(file, 'utf-8'));
}

function withinRoot(root, target) {
	const relative = path.relative(root, target);
	return relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

function resolveTemplate(value, values) {
	return Object.entries(values).reduce(
		(result, [name, replacement]) => result.replaceAll(`{${name}}`, replacement),
		value,
	);
}

function filesNamed(root, name) {
	if (!existsSync(root)) return [];
	const result = [];
	for (const entry of readdirSync(root)) {
		const full = path.join(root, entry);
		if (statSync(full).isDirectory()) result.push(...filesNamed(full, name));
		else if (entry === name) result.push(full);
	}
	return result;
}

export function validateDiscoveryManifest(manifest, card, root) {
	const checks = [];
	const modes = ['complete', 'without-code', 'documental'];
	const placeholder = (value) => typeof value === 'string' && /^(preencher|a definir|todo)$/i.test(value.trim());
	checks.push(check('discovery.schema-version', manifest?.schemaVersion === 1, 'schemaVersion deve ser 1'));
	checks.push(check('discovery.card', manifest?.card === card, `card do manifesto deve ser ${card}`));
	checks.push(check('discovery.mode', modes.includes(manifest?.mode), 'modo deve ser complete, without-code ou documental'));
	checks.push(check('discovery.recorded-at', typeof manifest?.recordedAt === 'string' && !Number.isNaN(Date.parse(manifest.recordedAt)), 'recordedAt deve ser uma data ISO válida'));
	checks.push(check('discovery.limitations', Array.isArray(manifest?.limitations) && !manifest.limitations.some(placeholder), 'limitations deve ser uma lista sem placeholders'));
	checks.push(check('discovery.hypotheses', Array.isArray(manifest?.hypotheses) && !manifest.hypotheses.some(placeholder), 'hypotheses deve ser uma lista sem placeholders'));
	const sources = manifest?.sources ?? {};
	for (const source of ['jira', 'confluence', 'screen', 'code']) {
		const value = sources[source];
		checks.push(check(`discovery.source.${source}`, Boolean(value?.status), `fonte ${source} precisa declarar status`));
		if (value && value.status !== 'complete') checks.push(check(`discovery.reason.${source}`, Boolean(value.reason?.trim()) && !placeholder(value.reason), `fonte ${source} incompleta precisa de motivo`));
	}
	for (const source of ['jira', 'confluence']) {
		const artifact = sources[source]?.artifact;
		checks.push(check(`discovery.artifact.${source}`, Boolean(artifact), `fonte ${source} precisa referenciar artefato`));
		if (root && artifact) {
			const target = path.resolve(root, artifact);
			const validPath = withinRoot(root, target) && existsSync(target) && statSync(target).isFile();
			checks.push(check(`discovery.artifact.${source}.exists`, validPath, `artefato de ${source} deve ser um arquivo no workspace`));
			if (validPath) {
				const content = readFileSync(target, 'utf-8');
				const untouched = /\b(a preencher|a consultar|a analisar)\b|\{[A-Z_]+\}/i.test(content);
				checks.push(check(`discovery.artifact.${source}.filled`, !untouched, `artefato de ${source} não pode conter placeholders`));
			}
		}
	}
	if (manifest?.mode === 'complete') {
		checks.push(check('discovery.complete.jira', sources.jira?.status === 'complete', 'modo complete exige Jira completo'));
		checks.push(check('discovery.complete.confluence', sources.confluence?.status === 'complete', 'modo complete exige Confluence completo'));
		checks.push(check('discovery.complete.screen', sources.screen?.status === 'complete', 'modo complete exige tela explorada'));
		checks.push(check('discovery.complete.code', sources.code?.status === 'complete', 'modo complete exige código analisado'));
	}
	if (manifest?.mode === 'without-code') {
		checks.push(check('discovery.without-code.jira', sources.jira?.status === 'complete', 'modo without-code exige Jira completo'));
		checks.push(check('discovery.without-code.confluence', sources.confluence?.status === 'complete', 'modo without-code exige Confluence completo'));
		checks.push(check('discovery.without-code.screen', sources.screen?.status === 'complete', 'modo without-code exige tela explorada'));
		checks.push(check('discovery.without-code.code', ['unavailable', 'not-authorized'].includes(sources.code?.status), 'modo without-code exige motivo para ausência do código'));
	}
	if (manifest?.mode === 'documental') {
		checks.push(check('discovery.documental.jira', ['complete', 'partial'].includes(sources.jira?.status), 'modo documental exige Jira completo ou parcial'));
		checks.push(check('discovery.documental.confluence', ['complete', 'partial'].includes(sources.confluence?.status), 'modo documental exige Confluence completo ou parcial'));
		checks.push(check('discovery.documental.screen', ['not-accessed', 'partial'].includes(sources.screen?.status), 'modo documental registra tela não acessada ou parcial'));
		checks.push(check('discovery.documental.code', ['unavailable', 'not-authorized', 'partial'].includes(sources.code?.status), 'modo documental registra código indisponível, não autorizado ou parcial'));
		checks.push(check('discovery.documental.limitations', (manifest?.limitations?.length ?? 0) > 0, 'modo documental exige pelo menos uma limitação explícita'));
	}
	return checks;
}

export function parseFeature(text, card, priorities = { critical: 'High', high: 'Normal', medium: 'Low' }) {
	const scenarios = [];
	let tags = [];
	let current = null;
	let lastKind = null;
	for (const [index, raw] of text.split(/\r?\n/).entries()) {
		const line = raw.trim();
		if (!line || line.startsWith('#')) continue;
		if (line.startsWith('@')) {
			tags = line.split(/\s+/).filter((tag) => tag.startsWith('@'));
			continue;
		}
		const scenario = line.match(/^Scenario(?: Outline)?:\s*(.+)$/);
		if (scenario) {
			current = { line: index + 1, name: scenario[1], tags, steps: [] };
			scenarios.push(current);
			tags = [];
			lastKind = null;
			continue;
		}
		const step = line.match(/^(Given|When|Then|And|But)\s+(.+)$/);
		if (step && current) {
			const direct = step[1] === 'Given' ? 'given' : step[1] === 'When' ? 'when' : step[1] === 'Then' ? 'then' : lastKind;
			if (direct) lastKind = direct;
			current.steps.push({ kind: direct, keyword: step[1], text: step[2] });
		}
	}
	const issues = [];
	if (!/^# language: en\s*$/m.test(text)) issues.push('primeira diretiva deve ser # language: en');
	if (/^\s*(Funcionalidade|Contexto|Cenário|Esquema do Cenário|Exemplos|Dado|Quando|Então|E|Mas)(?:\s|:)/m.test(text)) issues.push('use somente palavras-chave Gherkin em inglês');
	const names = new Set();
	for (const scenario of scenarios) {
		const prefix = `linha ${scenario.line}`;
		if (!scenario.tags.includes(`@${card}`)) issues.push(`${prefix}: falta @${card}`);
		const risk = scenario.tags.filter((tag) => Object.keys(priorities).includes(tag.slice(1)));
		if (risk.length !== 1) issues.push(`${prefix}: precisa de uma criticidade`);
		if (!new RegExp(`^\\[${card}\\]\\[[^\\]]+\\]\\[(Sucesso|Falha)\\] \\S`).test(scenario.name)) issues.push(`${prefix}: nome fora do padrão`);
		if (names.has(scenario.name)) issues.push(`${prefix}: nome duplicado`);
		names.add(scenario.name);
		if (!scenario.steps.some((item) => item.kind === 'when')) issues.push(`${prefix}: falta Quando`);
		if (!scenario.steps.some((item) => item.kind === 'then')) issues.push(`${prefix}: falta Então`);
	}
	if (scenarios.length === 0) issues.push('nenhum cenário encontrado');
	return { scenarios, issues };
}

function verifyRecordedGate(root, state, gate) {
	const record = state.gates?.[gate];
	if (!record) return [check(`${gate}.registered`, false, `${gate} não registrado`)];
	const checks = [check(`${gate}.registered`, true, `${gate} registrado por ${record.by}`)];
	if (!record.artifact || !record.sha256) {
		checks.push(check(`${gate}.hash`, false, `${gate} não possui artefato e hash`));
		return checks;
	}
	const artifact = path.resolve(root, record.artifact);
	const safe = withinRoot(root, artifact);
	checks.push(check(`${gate}.artifact-path`, safe, `${gate} aponta para artefato dentro do workspace`));
	const exists = safe && existsSync(artifact);
	checks.push(check(`${gate}.artifact-exists`, exists, `${gate} aponta para artefato existente`));
	if (exists) checks.push(check(`${gate}.hash`, sha256(readFileSync(artifact)) === record.sha256, `${gate} mantém o hash aprovado`));
	return checks;
}

/** Tipo (given, when, then) de cada passo do BDD, indexado por cenário e título do passo. */
function stepKindsFromFeature(root, card, priorities) {
	const files = filesNamed(path.join(root, 'qa/cards', card, 'bdd'), `${card}.feature`);
	if (files.length !== 1) return null;
	const parsed = parseFeature(readFileSync(files[0], 'utf-8'), card, priorities);
	if (parsed.issues.length) return null;
	return new Map(parsed.scenarios.map((scenario, index) => [`S${String(index + 1).padStart(2, '0')}`, new Map(scenario.steps.map((step) => [`${step.keyword} ${step.text}`, step.kind]))]));
}

/**
 * Prova do ciclo ATDD exigida no G3. Nada é aceito só porque o estado afirma: os manifestos das
 * execuções vermelha e verde são relidos do disco e revalidados contra os testes que existem agora.
 */
function validateAtddProof({ root, config, card, state, runId, ownership }) {
	const atdd = state.atdd;
	const checks = [check('G3.atdd-recorded', Boolean(atdd && ATDD_MODES.includes(atdd.mode)), 'modo ATDD registrado (red-first ou verify-existing)')];
	if (!atdd || !ATDD_MODES.includes(atdd.mode)) return checks;
	const ownedPaths = ownership?.automation.owned_paths ?? [];
	const current = specsHash(root, ownedPaths, card);
	const specs = scanSpecs(root, ownedPaths, card);
	const missing = (atdd.scenarios ?? []).filter((id) => !specs.has(id));
	checks.push(check('G3.atdd-scenarios', (atdd.scenarios?.length ?? 0) > 0 && missing.length === 0, missing.length ? `cenários sem teste de aceite: ${missing.join(', ')}` : 'todo cenário selecionado tem teste de aceite com tag @Sxx'));
	checks.push(check('G3.atdd-mode-confirmed', Boolean(atdd.confirmedBy?.trim()), atdd.confirmedBy ? `modo ${atdd.mode} confirmado por ${atdd.confirmedBy}` : 'o QA precisa ter confirmado o modo ATDD (--by)'));

	let loadedRed = null;
	if (atdd.mode === 'verify-existing') {
		checks.push(check('G3.atdd-reason', Boolean(atdd.reason?.trim()), 'verify-existing registra o motivo de a funcionalidade já existir'));
	} else {
		const red = atdd.red;
		loadedRed = red?.runId ? readRunManifest(root, config, card, red.runId) : { error: 'prova vermelha não registrada' };
		checks.push(check('G3.atdd-red-manifest', !loadedRed.error && loadedRed.sha256 === red?.manifestSha256, loadedRed.error ?? (loadedRed.sha256 === red?.manifestSha256 ? 'manifesto vermelho íntegro' : 'o manifesto vermelho mudou depois de registrado')));
		if (!loadedRed.error) {
			const kinds = stepKindsFromFeature(root, card, config.zephyr?.priorities);
			const redResult = validateRedRun(loadedRed.manifest, atdd.scenarios ?? [], kinds);
			checks.push(check('G3.atdd-red-proof', redResult.valid && redResult.red.length > 0, redResult.valid ? `prova vermelha válida: ${redResult.red.join(', ')}` : `prova vermelha inválida: ${redResult.checks.filter((item) => !item.ok).map((item) => item.message).join('; ')}`));
			const redEvidence = missingEvidence(root, config, card, red.runId, loadedRed.manifest, 'FAIL');
			checks.push(check('G3.atdd-red-evidence', redEvidence.length === 0, redEvidence.length ? `evidência vermelha ausente: ${redEvidence.join('; ')}` : 'evidência do vermelho presente'));
			const official = officialRunProblems(loadedRed.manifest, loadedRed.manifest.specsSha256);
			checks.push(check('G3.atdd-red-official', official.length === 0, official.length ? `vermelho não oficial: ${official.join('; ')}` : 'vermelho feito pelo runner oficial, com typecheck verde'));

			// Cadeia de custódia dos testes: do hash executado no vermelho, passando por cada ack do QA, até o hash atual.
			let expected = loadedRed.manifest.specsSha256;
			let chainOk = Boolean(expected);
			for (const ack of atdd.acknowledgements ?? []) {
				if (ack.from !== expected || !ack.by?.trim() || !ack.reason?.trim()) chainOk = false;
				expected = ack.to;
			}
			checks.push(check('G3.atdd-specs-chain', chainOk && expected === current.sha256, chainOk && expected === current.sha256 ? `testes de aceite inalterados desde o vermelho${(atdd.acknowledgements?.length ?? 0) ? ` (${atdd.acknowledgements.length} mudança(s) reconhecida(s) pelo QA)` : ''}` : 'os testes de aceite mudaram desde a prova vermelha sem reconhecimento do QA (qa:state atdd-ack)'));
		}
	}

	const loadedGreen = atdd.green?.runId ? readRunManifest(root, config, card, atdd.green.runId) : { error: 'execução final não registrada' };
	checks.push(check('G3.atdd-green-run', !loadedGreen.error && atdd.green.runId === runId, loadedGreen.error ?? (atdd.green.runId === runId ? 'execução final é a do --run-id' : `a execução final registrada (${atdd.green.runId}) não é a do --run-id`)));
	if (!loadedGreen.error) {
		checks.push(check('G3.atdd-green-manifest', loadedGreen.sha256 === atdd.green.manifestSha256, loadedGreen.sha256 === atdd.green.manifestSha256 ? 'manifesto verde íntegro' : 'o manifesto verde mudou depois de registrado'));
		const greenChecks = validateGreenRun(loadedGreen.manifest, atdd.scenarios ?? []);
		checks.push(check('G3.atdd-green', greenChecks.every((item) => item.ok), greenChecks.every((item) => item.ok) ? 'todos os cenários selecionados passaram' : `execução final inválida: ${greenChecks.filter((item) => !item.ok).map((item) => item.message).join('; ')}`));
		const official = officialRunProblems(loadedGreen.manifest, current.sha256);
		checks.push(check('G3.atdd-green-official', official.length === 0, official.length ? `execução final não oficial: ${official.join('; ')}` : 'execução final oficial, com typecheck verde, sobre os testes atuais'));
		if (atdd.mode === 'red-first' && loadedRed && !loadedRed.error) {
			checks.push(check('G3.atdd-red-before-green', Date.parse(loadedRed.manifest.finishedAt) < Date.parse(loadedGreen.manifest.startedAt), 'a execução vermelha terminou antes de a verde começar'));
		}
	}
	return checks;
}

export function canonicalArtifact(root, config, card, gate, runId) {
	if (gate === 'G1') return path.resolve(root, resolveTemplate(config.artifacts.bdd_review, { CARD: card }));
	if (gate === 'G2') return path.resolve(root, resolveTemplate(config.artifacts.zephyr_sync ?? `qa/cards/{CARD}/zephyr/zephyr-sync-payload.json`, { CARD: card }));
	if (!runId || !/^[A-Za-z0-9._-]+$/.test(runId)) return null;
	return path.resolve(root, resolveTemplate(config.artifacts.executions_dir, { CARD: card, runId }), 'execution.md');
}

export function validateGate({ root = process.cwd(), card, gate, runId, state: suppliedState, changes: suppliedChanges }) {
	const checks = [];
	const configPath = path.join(root, '.agents/project/qa-project.yaml');
	const statePath = path.join(root, 'qa/runs', card, 'state.json');
	if (!existsSync(configPath)) return { valid: false, checks: [check('config', false, 'qa-project.yaml não encontrado')] };
	if (!existsSync(statePath) && !suppliedState) return { valid: false, checks: [check('state', false, `estado de ${card} não encontrado`)] };
	const config = parseYaml(readFileSync(configPath, 'utf-8'));
	const allowedProjects = config.jira?.project_keys ?? [];
	checks.push(check('card.project', allowedProjects.length === 0 || allowedProjects.includes(card.split('-')[0]), `card ${card} pertence a um projeto Jira permitido`));
	const state = suppliedState ?? readJson(statePath);
	checks.push(check('state.gate', state.state === GATE_STATES[gate], `${gate} exige estado ${GATE_STATES[gate]} (atual: ${state.state})`));

	if (gate === 'G1') {
		const discoveryPath = path.join(root, 'qa/cards', card, 'context', 'discovery.json');
		checks.push(check('G1.discovery-file', existsSync(discoveryPath), 'manifesto context/discovery.json existe'));
		if (existsSync(discoveryPath)) {
			try { checks.push(...validateDiscoveryManifest(readJson(discoveryPath), card, root)); }
			catch (error) { checks.push(check('G1.discovery-json', false, `discovery.json inválido: ${error.message}`)); }
		}
		checks.push(check('G1.discovery-recorded', Boolean(state.discovery?.artifact && state.discovery?.sha256), 'discovery precisa estar registrado no estado antes do G1'));
		if (state.discovery?.artifact && state.discovery?.sha256 && existsSync(discoveryPath)) {
			checks.push(check('G1.discovery-path', path.resolve(root, state.discovery.artifact) === path.resolve(discoveryPath), 'estado aponta para o manifesto canônico'));
			checks.push(check('G1.discovery-hash', sha256(readFileSync(discoveryPath)) === state.discovery.sha256, 'discovery não mudou depois do alinhamento'));
		}
		const featureFiles = filesNamed(path.join(root, 'qa/cards', card, 'bdd'), `${card}.feature`);
		checks.push(check('G1.feature-count', featureFiles.length === 1, `exatamente um ${card}.feature encontrado (${featureFiles.length})`));
		if (featureFiles.length === 1) {
			const parsed = parseFeature(readFileSync(featureFiles[0], 'utf-8'), card, config.zephyr.priorities);
			checks.push(check('G1.feature-valid', parsed.issues.length === 0, parsed.issues.length ? `feature inválido: ${parsed.issues.join('; ')}` : `${parsed.scenarios.length} cenários válidos`));
		}
		const review = canonicalArtifact(root, config, card, gate, runId);
		checks.push(check('G1.review-exists', existsSync(review), 'revisão BDD existe'));
		const approvals = readApprovals(root, config, card);
		checks.push(check('G1.approvals-file', Boolean(approvals), 'arquivo único de aprovações existe (<CARD>-APROVACOES.md)'));
		if (approvals) {
			const { approver, g1 } = approvals.data;
			checks.push(check('G1.approver', Boolean(approver), 'o QA preencheu o Nome do aprovador em <CARD>-APROVACOES.md'));
			const approvalCount = [g1.all, g1.partial].filter(Boolean).length;
			checks.push(check('G1.human-decision', approvalCount === 1 && !g1.changes, g1.changes ? 'Solicitar ajustes bloqueia o G1' : `o QA precisa marcar exatamente uma aprovação (total ou parcial) no G1 (${approvalCount} marcada(s))`));
			if (g1.partial) checks.push(check('G1.partial-selection', g1.approvedScenarios.length > 0, 'aprovação parcial exige marcar "Aprovado no G1" em ao menos um cenário'));
			if (existsSync(review)) {
				const pendingSection = readFileSync(review, 'utf-8').match(/## Pontos para decidir antes do G1([\s\S]*?)(?:\n##|$)/i)?.[1] ?? '';
				const openItems = (pendingSection.match(/^\d+\. \*\*/gm) ?? []).length;
				const resolved = g1.pendencies.filter((item) => item.done).length;
				checks.push(check('G1.open-decisions', openItems === 0 || resolved >= openItems, openItems ? `o QA precisa marcar a opção de cada uma das ${openItems} pendência(s) do review no arquivo de aprovações (aceitas: ${resolved})` : 'não há decisões abertas'));
				const rejected = g1.pendencies.filter((item) => item.rejected).map((item) => item.id);
				checks.push(check('G1.rejected-decisions', rejected.length === 0, rejected.length ? `pendência(s) não aceita(s) pelo QA: ${rejected.join(', ')}. O BDD precisa de ajuste antes do G1` : 'nenhuma pendência foi rejeitada'));
			}
		}
	}

	if (gate === 'G2') {
		checks.push(...verifyRecordedGate(root, state, 'G1'));
		const g2Approvals = readApprovals(root, config, card);
		checks.push(check('G2.human-approval', Boolean(g2Approvals?.data.approver && g2Approvals.data.g2.plan), 'o QA precisa preencher o Nome e marcar "Aprovo o plano do Zephyr" em <CARD>-APROVACOES.md'));
		const payloadPath = canonicalArtifact(root, config, card, gate, runId);
		checks.push(check('G2.payload-exists', existsSync(payloadPath), 'zephyr-sync-payload.json existe'));
		if (existsSync(payloadPath)) {
			try {
				const payload = readJson(payloadPath);
				const g1 = state.gates?.G1;
				checks.push(check('G2.dry-run', payload.mode === 'dry-run' && payload.published === false, 'payload permanece dry-run e não publicado'));
				checks.push(check('G2.identity', payload.card === card && payload.projectKey === config.zephyr.project_key, 'card e projeto Zephyr conferem'));
				checks.push(check('G2.g1-status', payload.status === 'approved-g1', 'payload foi gerado depois do G1'));
				checks.push(check('G2.g1-provenance', Boolean(g1 && payload.g1?.approved === true && payload.g1.by === g1.by && payload.g1.at === g1.at && payload.g1.artifact === g1.artifact && payload.g1.sha256 === g1.sha256), 'payload referencia exatamente o G1 registrado'));
				const featureFiles = filesNamed(path.join(root, 'qa/cards', card, 'bdd'), `${card}.feature`);
				const featureFile = featureFiles[0];
				const currentFeatureSha = featureFiles.length === 1 ? sha256(readFileSync(featureFile)) : null;
				checks.push(check('G2.feature-hash', Boolean(currentFeatureSha && payload.feature?.sha256 === currentFeatureSha), 'payload mantém o hash da feature atual'));
				const parsedFeature = featureFiles.length === 1 ? parseFeature(readFileSync(featureFile, 'utf-8'), card, config.zephyr.priorities) : { scenarios: [], issues: ['feature ausente'] };
				const items = Array.isArray(payload.items) ? payload.items : [];
				const names = items.map((item) => item.name);
				const keys = items.map((item) => item.key).filter(Boolean);
				const publish = g2Approvals ? publishScope(g2Approvals.data) : [];
				const outsideG1 = g2Approvals ? g2Approvals.data.g2.publish.filter((id) => !inScope(approvedScope(g2Approvals.data), id)) : [];
				const expected = parsedFeature.scenarios.map((scenario, index) => ({ id: `S${String(index + 1).padStart(2, '0')}`, name: scenario.name })).filter((entry) => publish.includes(entry.id));
				checks.push(check('G2.items', items.length > 0 && items.every((item) => ['criar', 'atualizar', 'reutilizar'].includes(item.operation)), 'todos os cenários têm operação válida'));
				checks.push(check('G2.approved-scope', publish.length > 0 && outsideG1.length === 0, outsideG1.length ? `cenário(s) a publicar sem aprovação no G1: ${outsideG1.join(', ')}` : 'o QA listou os cenários a publicar no Zephyr, todos aprovados no G1'));
				checks.push(check('G2.feature-parity', parsedFeature.issues.length === 0 && expected.length > 0 && JSON.stringify(names) === JSON.stringify(expected.map((entry) => entry.name)) && items.every((item, index) => item.scenario === expected[index]?.id), 'o payload contém exatamente os cenários a publicar no Zephyr, na ordem do .feature'));
				checks.push(check('G2.unique-names', new Set(names).size === names.length, 'nomes de casos são únicos'));
				checks.push(check('G2.unique-keys', new Set(keys).size === keys.length, 'chaves Zephyr são únicas'));
				checks.push(check('G2.warnings', (payload.warnings?.length ?? 0) === 0, 'payload não possui divergências pendentes'));

				// Política de propriedade: o agente só escreve o que criou.
				const ownership = ownershipOf(config);
				checks.push(check('G2.ownership-config', Boolean(ownership), 'qa-project.yaml declara a política de propriedade'));
				if (ownership) {
					const registryPath = path.resolve(root, ownership.zephyr.owned_registry.replaceAll('{CARD}', card));
					let ownedKeys = new Set();
					if (existsSync(registryPath)) {
						try { ownedKeys = new Set((readJson(registryPath).cases ?? []).map((entry) => entry.key)); } catch {}
					}
					const suffix = ownership.zephyr.automation_folder_suffix;
					checks.push(check('G2.team-read-only', payload.ownership?.teamCases === 'read-only', 'casos do time declarados como somente leitura'));
					checks.push(check('G2.own-folder', automationFolderOk(payload.ownership?.automationFolder?.name, suffix), `casos do agente ficam em pasta própria terminada em ${suffix}`));
					const teamKeys = items.map((item) => item.teamReference?.key).filter(Boolean);
					const touchesTeam = items.filter((item) => item.operation !== 'criar' && !(item.operation === 'atualizar' && item.owned === true && ownedKeys.has(item.key)));
					checks.push(check('G2.no-team-write', touchesTeam.length === 0 && items.every((item) => !item.key || !teamKeys.includes(item.key)), 'nenhum caso do time é criado, atualizado, renomeado ou movido'));
					checks.push(check('G2.team-references-read-only', items.every((item) => !item.teamReference || item.teamReference.access === 'read-only'), 'referências a casos do time são somente leitura'));
					checks.push(check('G2.items-in-own-folder', items.every((item) => item.folder === 'automation'), 'todo item é gravado na pasta do agente'));
				}

				// Padrão do Confluence para casos criados pelo agente.
				const confluenceName = new RegExp(`^\\[${card}\\]\\[[^\\]]+\\]\\[(Sucesso|Falha)\\] Validar \\S`);
				checks.push(check('G2.confluence-name', items.every((item) => confluenceName.test(item.name)), 'nomes seguem [Chave][Aplicação][Sucesso|Falha] Validar ...'));
				checks.push(check('G2.confluence-content', items.every((item) => item.objective && item.precondition?.length > 0 && item.steps?.length > 0 && item.priorityName && item.status), 'cada caso tem objetivo, precondição, passos, prioridade e status'));
			} catch (error) { checks.push(check('G2.payload-json', false, `payload inválido: ${error.message}`)); }
		}
		const planPath = path.join(root, 'qa/cards', card, 'zephyr', 'zephyr-dry-run.json');
		if (existsSync(planPath)) {
			const text = readFileSync(planPath, 'utf-8');
			checks.push(check('G2.open-decisions', !/decisionPending/i.test(text), 'plano Zephyr não pode conter decisionPending'));
		}
	}

	if (gate === 'G3') {
		checks.push(...verifyRecordedGate(root, state, 'G2'));

		// Testes do time são somente leitura: a entrega só pode adicionar arquivos nos diretórios do agente.
		const ownership = ownershipOf(config);
		checks.push(check('G3.ownership-config', Boolean(ownership), 'qa-project.yaml declara a política de propriedade'));
		if (ownership) {
			const changes = suppliedChanges ?? gitChanges(root, config.git?.base ?? 'main');
			if (changes === null) {
				checks.push(check('G3.ownership', false, 'não foi possível comparar a entrega com a branch base para provar que testes do time não foram alterados'));
			} else {
				const violations = checkAutomationOwnership(changes, ownership);
				checks.push(check('G3.ownership', violations.length === 0, violations.length ? `alterações fora dos diretórios do agente: ${violations.slice(0, 5).join('; ')}${violations.length > 5 ? ` (+${violations.length - 5})` : ''}` : 'a entrega só altera arquivos criados pelo agente'));
			}
		}
		checks.push(check('G3.run-id', Boolean(runId && /^[A-Za-z0-9._-]+$/.test(runId)), 'G3 exige --run-id válido'));
		checks.push(...validateAtddProof({ root, config, card, state, runId, ownership }));
		const approvals = readApprovals(root, config, card);
		checks.push(check('G3.approvals-file', Boolean(approvals), 'arquivo único de aprovações existe (<CARD>-APROVACOES.md)'));
		const data = approvals?.data;
		checks.push(check('G3.human-approval', Boolean(data?.approver && data.g3.approved && data.g3.runId === runId), 'o QA precisa preencher o Nome, o Run-id igual ao informado e marcar "Aprovo a execução e a entrega" em <CARD>-APROVACOES.md'));
		const decided = (data?.scenarios ?? []).filter((row) => DECISIONS.includes(row.decision));
		const g1Scope = data ? approvedScope(data) : [];
		const inG1 = (data?.scenarios ?? []).filter((row) => inScope(g1Scope, row.id));
		const everyItemDecided = inG1.length > 0 && inG1.every((row) => DECISIONS.includes(row.decision));
		checks.push(check('G3.decision-coverage', everyItemDecided, 'cada cenário aprovado no G1 tem uma decisão válida em <CARD>-APROVACOES.md'));
		const selectedIds = data ? selectedScenarioIds(data) : [];
		checks.push(check('G3.automated-selection', selectedIds.length > 0 && selectedIds.every((id) => inScope(g1Scope, id)), 'há cenário marcado como "automatizar" e todos foram aprovados no G1'));
		const artifact = canonicalArtifact(root, config, card, gate, runId);
		checks.push(check('G3.execution', Boolean(artifact && existsSync(artifact) && statSync(artifact).size > 0), 'execution.md do run existe e não está vazio'));
		if (artifact && existsSync(artifact)) {
			const executionText = readFileSync(artifact, 'utf-8');
			checks.push(check('G3.execution-result', /Resultado:\s*passed/i.test(executionText), 'execution.md registra Resultado: passed'));
			checks.push(check('G3.typecheck', /Typecheck:\s*passed/i.test(executionText), 'execution.md registra Typecheck: passed'));
			const executionRoot = path.dirname(artifact);
			const manifestPath = path.join(executionRoot, 'evidence-manifest.json');
			checks.push(check('G3.manifest', existsSync(manifestPath), 'manifesto de evidências existe'));
			if (existsSync(manifestPath)) {
				try {
					const manifest = readJson(manifestPath);
					checks.push(check('G3.result', manifest.result === 'passed', `execução deve estar verde (atual: ${manifest.result})`));
					checks.push(check('G3.manifest-typecheck', manifest.typecheck === 'passed', `manifesto deve registrar typecheck passed (atual: ${manifest.typecheck ?? 'ausente'})`));
					const entries = Array.isArray(manifest.entries) ? manifest.entries : [];
					const evidenceRoot = path.resolve(root, resolveTemplate(config.evidence.dir, { CARD: card, runId }));
					const evidenceExists = (relative) => {
						if (!relative) return false;
						const target = path.resolve(evidenceRoot, relative);
						return withinRoot(evidenceRoot, target) && existsSync(target) && statSync(target).isFile();
					};
					const traceable = entries.length > 0 && entries.every((entry) => {
						const steps = Array.isArray(entry.steps) ? entry.steps : [];
						const allPass = entry.status === 'PASS' && steps.length > 0 && steps.every((step) => step.status === 'PASS');
						const hasEvidence = steps.length > 0 && steps.every((step) => evidenceExists(step.screenshot));
						return Boolean(entry.zephyrKey && allPass && hasEvidence);
					});
					checks.push(check('G3.traceability', traceable, 'cada cenário e passo deve estar PASS, com chave Zephyr e arquivo de evidência'));
					const manifestScenarios = [...new Set(entries.map((entry) => entry.scenario).filter(Boolean))].sort();
					checks.push(check('G3.coverage', selectedIds.length > 0 && JSON.stringify([...selectedIds].sort()) === JSON.stringify(manifestScenarios), 'cenários executados correspondem exatamente aos marcados como "automatizar"'));
				} catch (error) { checks.push(check('G3.manifest-json', false, `manifesto inválido: ${error.message}`)); }
			}
		}
	}

	const valid = checks.length > 0 && checks.every((item) => item.ok);
	return { schemaVersion: 1, card, gate, valid, checks };
}

export function formatValidation(result) {
	const lines = [`${result.card} ${result.gate}: ${result.valid ? 'PRONTO' : 'BLOQUEADO'}`];
	for (const item of result.checks) lines.push(`  ${item.ok ? 'OK' : 'ERRO'} ${item.id}: ${item.message}`);
	return lines.join('\n');
}

import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';

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
		const scenario = line.match(/^(?:Scenario|Cenário):\s*(.+)$/);
		if (scenario) {
			current = { line: index + 1, name: scenario[1], tags, steps: [] };
			scenarios.push(current);
			tags = [];
			lastKind = null;
			continue;
		}
		const step = line.match(/^(Given|Dado|When|Quando|Then|Então|And|E|But|Mas)\s+(.+)$/);
		if (step && current) {
			const direct = ['Given', 'Dado'].includes(step[1]) ? 'given' : ['When', 'Quando'].includes(step[1]) ? 'when' : ['Then', 'Então'].includes(step[1]) ? 'then' : lastKind;
			if (direct) lastKind = direct;
			current.steps.push({ kind: direct, text: step[2] });
		}
	}
	const issues = [];
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

export function canonicalArtifact(root, config, card, gate, runId) {
	if (gate === 'G1') return path.resolve(root, resolveTemplate(config.artifacts.bdd_review, { CARD: card }));
	if (gate === 'G2') return path.resolve(root, resolveTemplate(config.artifacts.zephyr_sync ?? `qa/cards/{CARD}/zephyr/zephyr-sync-payload.json`, { CARD: card }));
	if (!runId || !/^[A-Za-z0-9._-]+$/.test(runId)) return null;
	return path.resolve(root, resolveTemplate(config.artifacts.executions_dir, { CARD: card, runId }), 'execution.md');
}

export function validateGate({ root = process.cwd(), card, gate, runId, state: suppliedState }) {
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
		if (existsSync(review)) {
			const text = readFileSync(review, 'utf-8');
			const approveAll = /^- \[x\] Aprovar todos os cenários/gim.test(text);
			const approvePartial = /^- \[x\] Aprovar parcialmente/gim.test(text);
			const requestChanges = /^- \[x\] Solicitar ajustes/gim.test(text);
			const approvalCount = [approveAll, approvePartial].filter(Boolean).length;
			checks.push(check('G1.human-decision', approvalCount === 1 && !requestChanges, requestChanges ? 'Solicitar ajustes bloqueia G1' : `revisão precisa marcar uma aprovação total ou parcial (${approvalCount})`));
			if (approvePartial) {
				const approvedSection = text.match(/(?:Cenários aprovados|Itens aprovados)\*{0,2}:?([\s\S]*?)(?:\n#{2,6}\s|\n\*\*Cenários rejeitados|$)/i)?.[1] ?? '';
				checks.push(check('G1.partial-selection', /(?:S\d{2}|VPOS-T\d+|\[[A-Z][A-Z0-9]+-\d+\])/i.test(approvedSection), 'aprovação parcial exige cenários aprovados explicitamente'));
			}
			const pendingSection = text.match(/## Pontos para decidir antes do G1([\s\S]*?)(?:\n##|$)/i)?.[1] ?? '';
			const openItems = (pendingSection.match(/^\d+\. \*\*/gm) ?? []).length;
			const resolutionSection = text.match(/## Resolução das pendências G1([\s\S]*?)(?:\n##|$)/i)?.[1] ?? '';
			const resolvedItems = (resolutionSection.match(/^- \[x\]/gim) ?? []).length;
			checks.push(check('G1.open-decisions', openItems === 0 || resolvedItems >= openItems, openItems ? `${openItems} pendência(s) exigem ${openItems} resoluções marcadas; encontradas ${resolvedItems}` : 'não há decisões abertas'));
		}
	}

	if (gate === 'G2') {
		checks.push(...verifyRecordedGate(root, state, 'G1'));
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
				const featureNames = parsedFeature.scenarios.map((item) => item.name);
				checks.push(check('G2.items', items.length > 0 && items.every((item) => ['criar', 'atualizar', 'reutilizar'].includes(item.operation)), 'todos os cenários têm operação válida'));
				checks.push(check('G2.feature-parity', parsedFeature.issues.length === 0 && JSON.stringify(names) === JSON.stringify(featureNames), 'payload contém os mesmos cenários da feature, na mesma ordem'));
				checks.push(check('G2.unique-names', new Set(names).size === names.length, 'nomes de casos são únicos'));
				checks.push(check('G2.unique-keys', new Set(keys).size === keys.length, 'chaves Zephyr são únicas'));
				checks.push(check('G2.warnings', (payload.warnings?.length ?? 0) === 0, 'payload não possui divergências pendentes'));
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
		checks.push(check('G3.run-id', Boolean(runId && /^[A-Za-z0-9._-]+$/.test(runId)), 'G3 exige --run-id válido'));
		const decisionPath = path.join(root, 'qa/approvals', card, 'automation-decision.md');
		const decisionText = existsSync(decisionPath) ? readFileSync(decisionPath, 'utf-8') : '';
		checks.push(check('G3.automation-decision', /\*\*Status:\*\* (APROVADO|CONCLUÍDO)/i.test(decisionText), 'decisão de automação exige status APROVADO ou CONCLUÍDO'));
		const allowedDecisions = new Set(['automatizar', 'manter-manual', 'automatizar-depois', 'não-aplicável', 'bloqueado']);
		const decisionRows = decisionText.split(/\r?\n/)
			.filter((line) => line.startsWith('|'))
			.map((line) => line.split('|').map((cell) => cell.trim()))
			.filter((cells) => allowedDecisions.has(cells[3]?.toLowerCase()));
		const automatedKeys = decisionRows.filter((cells) => cells[3].toLowerCase() === 'automatizar').map((cells) => cells[2]).filter(Boolean);
		let g2Items = [];
		const g2Artifact = state.gates?.G2?.artifact ? path.resolve(root, state.gates.G2.artifact) : null;
		if (g2Artifact && withinRoot(root, g2Artifact) && existsSync(g2Artifact)) {
			try { g2Items = readJson(g2Artifact).items ?? []; } catch {}
		}
		const everyItemDecided = g2Items.length > 0 && decisionRows.length === g2Items.length && g2Items.every((item, index) => {
			const label = `S${String(item.order ?? index + 1).padStart(2, '0')}`;
			return decisionRows.some((cells) => cells[1] === label || cells[1] === item.name);
		});
		checks.push(check('G3.decision-coverage', everyItemDecided, 'cada item do payload G2 possui exatamente uma decisão válida'));
		checks.push(check('G3.automated-selection', automatedKeys.length > 0 && automatedKeys.every((key) => /^VPOS-T\d+$/.test(key)), 'G3 exige pelo menos um caso VPOS selecionado para automatizar'));
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
					const manifestKeys = entries.map((entry) => entry.zephyrKey).sort();
					const selectedKeys = [...automatedKeys].sort();
					checks.push(check('G3.coverage', selectedKeys.length > 0 && JSON.stringify(selectedKeys) === JSON.stringify(manifestKeys), 'casos executados correspondem exatamente aos selecionados para automatizar'));
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

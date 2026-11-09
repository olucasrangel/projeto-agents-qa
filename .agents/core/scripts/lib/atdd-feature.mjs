import { readFileSync } from 'node:fs';
import path from 'node:path';
import { scenarioId, walk } from './atdd.mjs';
import { parseFeature } from './gate-validation.mjs';

/** Lê o .feature do card e devolve os cenários com id estável (S01, S02...) na ordem do arquivo. */
export function loadFeatureScenarios(root, card, priorities) {
	const bddDir = path.join(root, 'qa', 'cards', card, 'bdd');
	const files = walk(bddDir).filter((file) => path.basename(file) === `${card}.feature`);
	if (files.length !== 1) return { error: `esperado exatamente um ${card}.feature em ${path.relative(root, bddDir)} (encontrados ${files.length})` };
	const text = readFileSync(files[0], 'utf-8');
	const parsed = parseFeature(text, card, priorities);
	if (parsed.issues.length) return { error: `feature inválido: ${parsed.issues.join('; ')}` };
	return {
		featureName: text.match(/^Feature:\s*(.+)$/m)?.[1]?.trim() ?? card,
		items: parsed.scenarios.map((scenario, index) => ({
			id: scenarioId(index + 1),
			name: scenario.name,
			tags: scenario.tags,
			steps: scenario.steps,
			gherkin: [`Scenario: ${scenario.name}`, ...scenario.steps.map((step) => `  ${step.keyword} ${step.text}`)],
		})),
	};
}

/** Para cada cenário, o tipo (given, when, then) de cada passo, indexado pelo título usado em evidenceStep. */
export function stepKindsOf(items) {
	return new Map(items.map((item) => [item.id, new Map(item.steps.map((step) => [`${step.keyword} ${step.text}`, step.kind]))]));
}

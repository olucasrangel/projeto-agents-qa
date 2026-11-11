#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';

const card = process.argv[2]?.toUpperCase();
if (!card || !/^[A-Z][A-Z0-9]+-\d+$/.test(card)) {
	console.error('Uso: npm run qa:card:init -- PROJ-123');
	process.exit(1);
}

const projectRoot = process.cwd();
const projectConfig = parseYaml(readFileSync(path.join(projectRoot, '.agents/project/qa-project.yaml'), 'utf-8'));
const allowedProjects = projectConfig.jira?.project_keys ?? [];
if (allowedProjects.length && !allowedProjects.includes(card.split('-')[0])) {
	console.error(`Card ${card} fora dos projetos permitidos: ${allowedProjects.join(', ')}.`);
	process.exit(1);
}
const templateRoot = path.join(projectRoot, '.agents', 'project', 'templates');
const cardRoot = path.join(projectRoot, 'qa', 'cards', card);
const approvalRoot = path.join(projectRoot, 'qa', 'approvals', card);

function materialize(templateName, target, replacements = {}) {
	if (existsSync(target)) return false;
	const template = readFileSync(path.join(templateRoot, templateName), 'utf-8');
	const content = Object.entries({ CARD: card, ...replacements }).reduce(
		(value, [key, replacement]) =>
			value.replaceAll(`{${key}}`, String(replacement)),
		template,
	);
	mkdirSync(path.dirname(target), { recursive: true });
	writeFileSync(target, content);
	return true;
}

const directories = [
	path.join(cardRoot, 'context'),
	path.join(cardRoot, 'bdd'),
	path.join(cardRoot, 'zephyr'),
	path.join(cardRoot, 'automation'),
	path.join(approvalRoot, 'executions'),
];
for (const directory of directories) mkdirSync(directory, { recursive: true });

const files = [
	[
		'discovery.template.json',
		path.join(cardRoot, 'context', 'discovery.json'),
	],
	[
		'jira-context.template.md',
		path.join(cardRoot, 'context', 'jira-context.md'),
	],
	[
		'confluence-context.template.md',
		path.join(cardRoot, 'context', 'confluence-context.md'),
	],
	[
		'bdd-review.template.md',
		path.join(cardRoot, 'bdd', `${card}-review.md`),
	],
	[
		'zephyr-dry-run.template.json',
		path.join(cardRoot, 'zephyr', 'zephyr-dry-run.json'),
	],
	[
		'automation-plan.template.md',
		path.join(cardRoot, 'automation', 'automation-plan.md'),
	],
	[
		'PR_DESCRIPTION.dry-run.template.txt',
		path.join(cardRoot, 'PR_DESCRIPTION.txt'),
	],
	[
		'executions-readme.template.md',
		path.join(approvalRoot, 'executions', 'README.md'),
	],
	[
		'aprovacoes.template.md',
		path.join(approvalRoot, `${card}-APROVACOES.md`),
	],
];

let created = 0;
for (const [template, target, replacements] of files) {
	if (materialize(template, target, replacements)) created += 1;
}

console.log(`${card}: estrutura pronta em qa/cards e qa/approvals (${created} arquivo(s) criado(s)).`);

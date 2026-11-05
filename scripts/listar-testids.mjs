#!/usr/bin/env node
/**
 * Gera `projects/<projeto>/TESTIDS.md` com todos os `data-testid` que a suíte
 * consome. Esses testids são contrato com o frontend: se um deles é renomeado
 * lá, o teste correspondente quebra aqui. O arquivo é gerado a partir do
 * código, então não envelhece sozinho.
 *
 * Uso: npm run testids
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const SYSTEMS_DIR = 'projects';
const PATTERN = /(?:getByTestId|testId)\(\s*[`'"]([^`'"]+)[`'"]/g;

function sourceFiles(dir) {
	return readdirSync(dir).flatMap((entry) => {
		const full = path.join(dir, entry);
		if (statSync(full).isDirectory()) return sourceFiles(full);
		return full.endsWith('.ts') ? [full] : [];
	});
}

for (const system of readdirSync(SYSTEMS_DIR)) {
	const dir = path.join(SYSTEMS_DIR, system);
	if (!statSync(dir).isDirectory()) continue;

	const found = new Map();
	for (const file of sourceFiles(dir)) {
		const content = readFileSync(file, 'utf-8');
		for (const [, testid] of content.matchAll(PATTERN)) {
			const where = found.get(testid) ?? new Set();
			where.add(path.relative(dir, file));
			found.set(testid, where);
		}
	}

	const rows = [...found.entries()]
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([testid, where]) => {
			const dynamic = testid.includes('${') ? ' (dinâmico)' : '';
			return `| \`${testid}\`${dynamic} | ${[...where].sort().join(', ')} |`;
		});

	const out = path.join(dir, 'TESTIDS.md');
	writeFileSync(
		out,
		[
			`# data-testid consumidos — ${system}`,
			'',
			'Gerado por `npm run testids`. Não editar à mão.',
			'',
			'Estes atributos são contrato entre este repositório e o frontend:',
			'renomear um deles no produto quebra o teste que o referencia.',
			'',
			`Total: ${rows.length}`,
			'',
			'| data-testid | Onde é usado |',
			'| ----------- | ------------ |',
			...rows,
			'',
		].join('\n'),
	);
	console.log(`${out}: ${rows.length} testids`);
}

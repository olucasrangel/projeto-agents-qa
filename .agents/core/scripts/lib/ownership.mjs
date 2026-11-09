import { spawnSync } from 'node:child_process';

/**
 * Política de propriedade do agente de QA.
 * O agente só escreve o que criou: casos do Zephyr em pasta própria e testes em
 * diretórios próprios. Tudo o que é do time é somente leitura.
 */

const normalize = (value) => String(value).replaceAll('\\', '/').replace(/^\.\//, '').replace(/\/+$/, '');

export function ownershipOf(config) {
	const ownership = config?.ownership;
	if (!ownership?.zephyr?.automation_folder_suffix) return null;
	if (!Array.isArray(ownership.automation?.protected_roots) || !Array.isArray(ownership.automation?.owned_paths)) return null;
	return ownership;
}

export function automationFolderOk(name, suffix) {
	return typeof name === 'string' && typeof suffix === 'string' && name.trim().endsWith(suffix.trim());
}

/**
 * Devolve as alterações proibidas. Dentro das raízes protegidas, só é permitido
 * mexer em arquivos dos diretórios do agente. Qualquer outra criação, edição,
 * renomeação ou remoção é violação.
 */
export function checkAutomationOwnership(changes, ownership) {
	const roots = ownership.automation.protected_roots.map(normalize);
	const owned = ownership.automation.owned_paths.map(normalize);
	const violations = [];
	for (const change of changes) {
		const file = normalize(change.path);
		const inProtectedRoot = roots.some((root) => file === root || file.startsWith(`${root}/`));
		if (!inProtectedRoot) continue;
		if (owned.some((dir) => file.startsWith(`${dir}/`))) continue;
		violations.push(`${change.status} ${file}`);
	}
	return violations;
}

function git(root, args) {
	return spawnSync('git', args, { cwd: root, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function parseNameStatus(output) {
	return output
		.split(/\r?\n/)
		.filter(Boolean)
		.map((line) => {
			const [status, ...rest] = line.split('\t');
			return { status: status[0], path: rest.join('\t') };
		});
}

/** Alterações da branch atual contra a base, mais as pendentes na árvore de trabalho. Retorna null se não for possível comparar. */
export function gitChanges(root, base) {
	if (git(root, ['rev-parse', '--is-inside-work-tree']).status !== 0) return null;
	const baseRef = [base, `origin/${base}`].find((ref) => git(root, ['rev-parse', '--verify', '--quiet', ref]).status === 0);
	if (!baseRef) return null;
	const committed = git(root, ['diff', '--name-status', '--no-renames', `${baseRef}...HEAD`]);
	const working = git(root, ['diff', '--name-status', '--no-renames', 'HEAD']);
	const untracked = git(root, ['ls-files', '--others', '--exclude-standard']);
	if (committed.status !== 0 || working.status !== 0 || untracked.status !== 0) return null;
	return [
		...parseNameStatus(committed.stdout),
		...parseNameStatus(working.stdout),
		...untracked.stdout.split(/\r?\n/).filter(Boolean).map((file) => ({ status: 'A', path: file })),
	];
}

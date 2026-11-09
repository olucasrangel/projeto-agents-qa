const ANSI = /\u001b\[[0-9;]*m/g;

/**
 * Separa falha de asserção (o critério de aceite ainda não é atendido) de falha
 * de execução (seletor, timeout de ação, login, ambiente, passo não ligado).
 * Só a primeira prova um teste vermelho pelo motivo certo no ATDD.
 */
export function classifyFailure(error?: { message?: string }): 'assertion' | 'execution' {
	const message = (error?.message ?? '').replace(ANSI, '');
	return /(^|\n)\s*(Error: )?expect\(/.test(message) ? 'assertion' : 'execution';
}

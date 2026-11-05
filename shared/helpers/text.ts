const FILLER =
	'O curso foi desenhado para formar profissionais capazes de atuar de forma crítica, ética e colaborativa em contextos reais de trabalho, integrando fundamentos teóricos, prática supervisionada e uso intensivo de tecnologias educacionais. ';

/**
 * Gera um texto em português com no mínimo `minChars` caracteres, usado nos
 * campos do PPC que exigem quantidade mínima de caracteres e palavras.
 */
export function longText(minChars: number, seed: string): string {
	let text = `${seed} `;
	while (text.length < minChars + 50) text += FILLER;
	return text;
}

import { expect, Page } from '@playwright/test';
import { BasePage } from '../../../../shared/pages/BasePage';
import { E2E_PPC_AI_TIMEOUT_MS } from '../../config/env';

/**
 * Assistente de IA oferecido ao Infoprodutor no acesso ao formulário externo. A
 * oferta só aparece quando a feature está ligada no service e o PPC ainda não
 * tem Informações Gerais preenchidas.
 */
export interface AiAssistAnswers {
	objetivos: string;
	justificativa: string;
	publicoAlvo: string;
}

/** Mínimo de caracteres exigido em cada passo, na ordem do assistente. */
export const AI_ASSIST_MIN_CHARS = [200, 200, 100];

export const AI_ASSIST_MAX_CHARS = 500;

export class PpcAiAssistPage extends BasePage {
	readonly offer = this.testId('ppc-ai-assist');
	readonly acceptButton = this.testId('ai-assist-accept');
	readonly textarea = this.testId('ai-assist-textarea');
	readonly nextButton = this.testId('ai-assist-next');
	readonly loading = this.testId('ai-assist-loading');
	readonly externalForm = this.testId('ppc-external-form');

	constructor(page: Page) {
		super(page);
	}

	async accept(): Promise<void> {
		await expect(this.offer).toBeVisible({ timeout: 30 * 1000 });
		await this.acceptButton.click();
		await expect(this.textarea).toBeVisible();
	}

	/** Preenche o passo atual e avança. */
	async answerStep(answer: string): Promise<void> {
		await this.textarea.fill(answer);
		await expect(this.nextButton).toBeEnabled();
		await this.nextButton.click();
	}

	/**
	 * Responde aos três passos e dispara a geração. A conclusão é observada pela
	 * saída da tela de carregamento, que termina no formulário externo.
	 */
	async generateSuggestions(answers: AiAssistAnswers): Promise<void> {
		await this.answerStep(answers.objetivos);
		await this.answerStep(answers.justificativa);

		await this.textarea.fill(answers.publicoAlvo);
		await this.nextButton.click();

		await expect(this.loading).toBeVisible();
		await expect(this.externalForm).toBeVisible({
			timeout: E2E_PPC_AI_TIMEOUT_MS,
		});
	}
}

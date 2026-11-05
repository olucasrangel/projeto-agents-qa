import { expect, Page } from '@playwright/test';
import { BasePage } from '../../../shared/pages/BasePage';
import { E2E_LOCALE } from '../config/env';

/** Dashboard do Coordenador, com os cards de acesso aos módulos. */
export class DashboardPage extends BasePage {
	readonly title = this.testId('dashboard-title');
	readonly ppcCard = this.testId('card-ppc-button');
	readonly questionBankCard = this.testId('card-question-bank-button');

	constructor(page: Page) {
		super(page);
	}

	/** Acessa o módulo de PPC pelo card, como o Coordenador faz. */
	async openPPC(): Promise<void> {
		await expect(this.title).toBeVisible();
		await this.ppcCard.click();
		await this.page.waitForURL(`**/${E2E_LOCALE}/ppc`);
		await expect(this.testId('page-ppc-list')).toBeVisible();
	}

	/** Acessa o módulo de Banco de Questões pelo card. */
	async openQuestionBank(): Promise<void> {
		await expect(this.title).toBeVisible();
		await this.questionBankCard.click();
		await this.page.waitForURL(`**/${E2E_LOCALE}/question-bank`);
		await expect(this.testId('page-question-bank')).toBeVisible();
	}
}

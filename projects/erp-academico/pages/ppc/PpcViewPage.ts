import { expect, Page } from '@playwright/test';
import { BasePage } from '../../../../shared/pages/BasePage';
import { ppcUrl } from '../../config/env';

/** Visualização do PPC pelo Coordenador (somente leitura). */
export class PpcViewPage extends BasePage {
	readonly backToList = this.testId('btn-back-ppc-list');

	constructor(page: Page) {
		super(page);
	}

	/** Abre o PPC e percorre todas as abas. */
	async open(ppcId: number): Promise<void> {
		await this.page.goto(ppcUrl(`/${ppcId}`));
		await expect(this.backToList).toBeVisible();

		for (const tab of [
			'Informações Gerais',
			'Especialistas',
			'Carga Horária',
			'Disciplinas',
		]) {
			await this.page.getByRole('tab', { name: tab }).click();
		}
	}
}

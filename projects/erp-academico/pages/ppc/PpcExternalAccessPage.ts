import { Page } from '@playwright/test';
import { BasePage } from '../../../../shared/pages/BasePage';
import { appUrl } from '../../config/env';

export const TITULO_LINK_INVALIDO = 'Link inválido ou expirado';

/** Acesso externo do Infoprodutor pelo link com token. */
export class PpcExternalAccessPage extends BasePage {
	readonly invalidLinkTitle = this.page.getByText(TITULO_LINK_INVALIDO);
	readonly invalidLinkMessage = this.page.getByText(
		'O link que você utilizou não é válido ou já expirou.',
	);
	readonly externalForm = this.testId('ppc-external-form');

	constructor(page: Page) {
		super(page);
	}

	/** Abre o acesso externo com o token informado (ou sem token). */
	async gotoAccess(token?: string): Promise<void> {
		const base = appUrl('/ppc/external/access');
		await this.page.goto(token === undefined ? base : `${base}?token=${token}`);
	}

	/** Abre o formulário externo direto, sem passar pela validação do token. */
	async gotoFormWithoutSession(): Promise<void> {
		await this.page.goto(appUrl('/ppc/external/fill'));
	}
}

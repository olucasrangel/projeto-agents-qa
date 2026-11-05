import { expect, Locator, Page } from '@playwright/test';

/**
 * Base dos Page Objects. Cada página expõe seus elementos como `Locator` e as
 * ações de tela como métodos; regras de negócio e encadeamento entre páginas
 * ficam nos flows do projeto, e as asserções de resultado ficam nos testes.
 */
export abstract class BasePage {
	constructor(protected readonly page: Page) {}

	protected testId(id: string): Locator {
		return this.page.getByTestId(id);
	}

	/**
	 * Abre um menu e clica no item pedido. Menus de linha fecham sozinhos quando a
	 * lista é recarregada ou ainda estão animando, então a tentativa é repetida
	 * até o item aceitar o clique e a confirmação opcional passar.
	 */
	protected async clickMenuItem(
		menu: Locator,
		item: Locator,
		confirm?: () => Promise<void>,
		timeout = 90 * 1000,
	): Promise<void> {
		await expect(async () => {
			await menu.click();
			await item.click({ timeout: 5000 });
			if (confirm) await confirm();
		}).toPass({ timeout });
	}
}

import { expect, test } from '../../fixtures';

test.describe('Acesso externo do Infoprodutor com link inválido', () => {
	test('Link sem token cai na tela de link inválido', async ({
		page,
		ppcExternalAccessPage,
	}) => {
		await ppcExternalAccessPage.gotoAccess();

		await expect(ppcExternalAccessPage.invalidLinkTitle).toBeVisible({
			timeout: 30 * 1000,
		});
		await expect(page).toHaveURL(/invalid-token/);
	});

	test('Token inexistente cai na tela de link inválido', async ({
		ppcExternalAccessPage,
	}) => {
		await ppcExternalAccessPage.gotoAccess(
			`devin-e2e-token-invalido-${Date.now()}`,
		);

		await expect(ppcExternalAccessPage.invalidLinkTitle).toBeVisible({
			timeout: 30 * 1000,
		});
		await expect(ppcExternalAccessPage.invalidLinkMessage).toBeVisible();
		await expect(ppcExternalAccessPage.externalForm).toBeHidden();
	});

	test('Formulário externo sem sessão não abre', async ({
		ppcExternalAccessPage,
	}) => {
		await ppcExternalAccessPage.gotoFormWithoutSession();

		await expect(ppcExternalAccessPage.invalidLinkTitle).toBeVisible({
			timeout: 30 * 1000,
		});
		await expect(ppcExternalAccessPage.externalForm).toBeHidden();
	});
});

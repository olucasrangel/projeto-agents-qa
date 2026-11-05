import { Page } from '@playwright/test';
import { BasePage } from '../../../shared/pages/BasePage';
import { appUrl, coordinatorCredentials, E2E_LOCALE } from '../config/env';

/** Tela de login por credenciais do ERP Acadêmico. */
export class LoginPage extends BasePage {
	readonly username = this.testId('login-input-username');
	readonly password = this.testId('login-input-password');
	readonly submit = this.testId('login-button-submit');

	constructor(page: Page) {
		super(page);
	}

	async goto(): Promise<void> {
		await this.page.goto(appUrl());
	}

	/** Autentica o Coordenador e espera o dashboard. */
	async loginAsCoordinator(): Promise<void> {
		const { username, password } = coordinatorCredentials();

		await this.goto();
		await this.username.fill(username);
		await this.password.fill(password);
		await this.submit.click();

		await this.page.waitForURL(`**/${E2E_LOCALE}/dashboard**`);
	}
}

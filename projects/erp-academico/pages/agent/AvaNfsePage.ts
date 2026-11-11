import { expect, Locator, Page } from '@playwright/test';
import { BasePage } from '../../../../shared/pages/BasePage';

const DEFAULT_AVA_URL = 'https://infoprod.stage.platosedu.io';
const SERVICE_NFSE = 'service-option-NOTA_FISCAL_SERVICO';
const CREATE_PATH = '/service-invoice/request';

/** Resultado do POST que cria a solicitação de 2ª via. */
export interface CreatedRequest {
	status: number;
	body: string;
}

/** Dados da tela de detalhe de uma solicitação. */
export interface RequestDetail {
	id: string;
	status: string;
	competence: string;
	email: string;
}

export interface SessionOptions {
	/** Sufixo do usuário no .env (`_1`, `_2`, `_3`). Padrão: `_1`. */
	user?: string;
	/** Permite criar a solicitação (único POST liberado). Sem isso, toda escrita é abortada. */
	allowCreate?: boolean;
	/** Atrasa o POST de criação para observar o estado de envio. */
	createDelayMs?: number;
}

/** Credenciais de um aluno do AVA em hml (variáveis LMS_HML_USERNAME<sufixo>/PASSWORD<sufixo> do .env, lidas só aqui). */
function studentCredentials(suffix: string): { username: string; password: string } {
	const username = process.env[`LMS_HML_USERNAME${suffix}`];
	const password = process.env[`LMS_HML_PASSWORD${suffix}`];
	if (!username || !password) throw new Error(`Defina LMS_HML_USERNAME${suffix} e LMS_HML_PASSWORD${suffix} no .env para os testes do AVA.`);
	return { username, password };
}

function avaUrl(): string {
	return (process.env.LMS_HML_BASE_URL ?? DEFAULT_AVA_URL).replace(/\/$/, '');
}

/**
 * Autosserviços do aluno no AVA (hml), tela "Nova solicitação de serviço" com a 2ª via de NFS-e.
 * Usado pelos testes do PGPO-3266. As ações só leem a tela; nada é enviado.
 */
export class AvaNfsePage extends BasePage {
	readonly course = this.testId('field-course');
	readonly service = this.testId('field-service');
	readonly nfseOption = this.testId(SERVICE_NFSE);
	readonly competence = this.testId('field-competence');
	readonly email = this.testId('field-destinationEmail');
	readonly submit = this.testId('button-submit-create');
	readonly emailHint = this.page.getByText('A nota fiscal será enviada para este e-mail.');
	readonly updateEmailModal = this.page.getByText('Você deseja atualizar seu e-mail?');
	readonly sentMessage = this.page.getByText('Solicitação enviada');
	readonly keepOldEmailButton = this.testId('secundary-button');
	/** Escritas na API do AVA bloqueadas depois do login (tudo que não é a criação permitida). */
	readonly blockedWrites: string[] = [];
	/** Solicitações criadas por este teste. */
	readonly createdRequests: CreatedRequest[] = [];
	/** Verdadeiro enquanto o POST de criação está em andamento. */
	creationInFlight = false;

	constructor(page: Page) {
		super(page);
	}

	/** Esconde o tour guiado por CSS: ele cobre a tela e intercepta cliques. Remover os nós do DOM derruba o React. */
	private async disableTour(): Promise<void> {
		await this.page.addInitScript(() => {
			const hide = () => {
				const style = document.createElement('style');
				style.textContent = '.reactour__mask,.reactour__popover{display:none !important;pointer-events:none !important}';
				document.head.appendChild(style);
			};
			if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', hide);
			else hide();
		});
	}

	async loginAsStudent(options: SessionOptions = {}): Promise<void> {
		const { username, password } = studentCredentials(options.user ?? '_1');
		await this.disableTour();
		await this.page.goto(`${avaUrl()}/v2/lms/login`);
		await this.testId('input-login-username').fill(username);
		await this.testId('input-login-password').fill(password);
		await this.testId('login-submit-button').click();
		await this.page.waitForURL(/\/aluno\/dashboard/);
		await this.guardWrites(options);
	}

	/**
	 * Trava de segurança. Escritas (não GET) para a API do AVA são abortadas e registradas, exceto a criação da
	 * solicitação quando o teste a permite. Renovação de token e telemetria de terceiros passam.
	 */
	private async guardWrites(options: SessionOptions): Promise<void> {
		const avaHost = new URL(avaUrl()).host;
		await this.page.route('**/*', async (route) => {
			const request = route.request();
			const url = new URL(request.url());
			const isWrite = !['GET', 'OPTIONS', 'HEAD'].includes(request.method());
			if (!isWrite || url.host !== avaHost || /\/token$/.test(url.pathname)) {
				await route.continue();
				return;
			}
			if (options.allowCreate && request.method() === 'POST' && url.pathname.endsWith(CREATE_PATH)) {
				this.creationInFlight = true;
				if (options.createDelayMs) await new Promise((resolve) => setTimeout(resolve, options.createDelayMs));
				const response = await route.fetch();
				this.creationInFlight = false;
				this.createdRequests.push({ status: response.status(), body: request.postData() ?? '' });
				await route.fulfill({ response });
				return;
			}
			this.blockedWrites.push(`${request.method()} ${url.pathname}`);
			await route.abort();
		});
	}

	/** Espera a resposta da criação; devolve null se nenhuma solicitação for criada no prazo. */
	waitForCreation(timeout = 20000): Promise<CreatedRequest | null> {
		return this.page
			.waitForResponse((response) => response.request().method() === 'POST' && response.url().includes(CREATE_PATH), { timeout })
			.then((response) => ({ status: response.status(), body: response.request().postData() ?? '' }))
			.catch(() => null);
	}

	async chooseCompetence(index: number): Promise<void> {
		await this.competence.selectOption({ index });
	}

	/** Abre a lista de solicitações. Depois de um envio a própria tela já redireciona para ela, então não navega de novo. */
	async openRequestsList(): Promise<void> {
		const onList = () => /\/aluno\/auto-servicos\/?$/.test(new URL(this.page.url()).pathname);
		if (!onList()) await this.page.goto(`${avaUrl()}/v2/lms/aluno/auto-servicos`);
		await expect(async () => {
			if (!(await this.page.locator('tbody tr').first().isVisible())) {
				await this.page.reload();
				await expect(this.page.locator('tbody tr').first()).toBeVisible({ timeout: 10000 });
			}
		}).toPass({ timeout: 45000 });
	}

	/** Recarrega a lista e devolve o status da solicitação mais recente. */
	async newestRowStatus(): Promise<string> {
		await this.page.reload();
		await this.page.locator('tbody tr').first().waitFor();
		return (await this.requestRows().first().innerText()).replace(/\s+/g, ' ');
	}

	requestRows(): Locator {
		return this.page.locator('tbody tr');
	}

	async countRowsWithStatus(status: string): Promise<number> {
		await this.openRequestsList();
		return this.requestRows().filter({ hasText: status }).count();
	}

	/** Abre o detalhe da solicitação mais recente que está no status pedido (ou da primeira linha, sem status) e lê os dados. */
	async openRequestDetail(status?: string): Promise<RequestDetail> {
		await this.openRequestsList();
		const rows = status ? this.requestRows().filter({ hasText: status }) : this.requestRows();
		if ((await rows.count()) === 0) throw new Error(`Nenhuma solicitação${status ? ` no status ${status}` : ''} para este aluno.`);
		await rows.first().getByText('Ver detalhes').click();
		await this.page.waitForURL(/auto-servicos\/\d+/);
		await this.page.getByText('Mês/ Ano:').waitFor();
		await this.page.getByText('E-mail:').first().waitFor();
		const text = await this.page.locator('body').innerText();
		const pick = (label: RegExp): string => text.match(label)?.[1]?.trim() ?? '';
		return {
			id: pick(/Solicitação (\d+)/),
			status: pick(/(EM PROCESSAMENTO|CONCLUÍDO|FALHA|ERRO)/i),
			competence: pick(/Mês\/ Ano:\s*([^\n]+)/),
			email: pick(/E-mail:\s*([^\n]+)/),
		};
	}

	async chooseCompetenceByLabel(label: string): Promise<void> {
		await this.competence.selectOption({ label });
	}

	async keepOldEmail(): Promise<void> {
		await this.keepOldEmailButton.click();
	}

	async openNewRequest(): Promise<void> {
		await this.page.goto(`${avaUrl()}/v2/lms/aluno/auto-servicos/create`);
		await this.testId('assistance-create-form').waitFor();
	}

	/** Abre a lista de serviços; ela só carrega depois de o curso ser escolhido, então repete até a opção aparecer. */
	async openServiceList(): Promise<void> {
		await expect(async () => {
			await this.service.click({ timeout: 5000 });
			await expect(this.nfseOption).toBeVisible({ timeout: 3000 });
		}).toPass({ timeout: 30000 });
	}

	async chooseNfseService(): Promise<void> {
		await this.course.selectOption({ index: 1 });
		await this.openServiceList();
		await this.nfseOption.click();
		await this.competence.waitFor();
	}

	/** Abre a tela já com o serviço de NFS-e escolhido e a competência vazia. */
	async openNfseForm(): Promise<void> {
		await this.openNewRequest();
		await this.chooseNfseService();
	}

	async chooseFirstCompetence(): Promise<void> {
		await this.competence.selectOption({ index: 1 });
	}

	async registeredEmail(): Promise<string> {
		return this.email.inputValue();
	}

	async fillEmail(value: string): Promise<void> {
		await this.email.fill(value);
	}

	/** Clica em "Enviar solicitação" mesmo desabilitado, como o usuário tentaria; botão desabilitado ignora o clique. */
	async trySubmit(): Promise<void> {
		await this.submit.click({ force: true, timeout: 5000 });
	}

	async closeModalWithEscape(): Promise<void> {
		await this.page.keyboard.press('Escape');
	}

	optionLocator(): Locator {
		return this.nfseOption;
	}
}

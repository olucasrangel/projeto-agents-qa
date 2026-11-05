import { expect, Page } from '@playwright/test';
import { stat } from 'node:fs/promises';
import { BasePage } from '../../../../shared/pages/BasePage';
import { ppcUrl } from '../../config/env';
import { FinishData } from '../../data/ppc';

export interface CreatedPPC {
	accessLink: string;
	infoproducerEmail: string;
}

export interface DownloadedDocument {
	filename: string;
	bytes: number;
}

export interface ListFilters {
	status?: string;
	sort?: string;
}

export const PPC_LIST_TAB = {
	EM_REVISAO: 0,
	CONCLUIDOS: 1,
} as const;

export type PPCListTab = (typeof PPC_LIST_TAB)[keyof typeof PPC_LIST_TAB];

type RowAction =
	| 'copy_link'
	| 'review'
	| 'pause'
	| 'resume'
	| 'cancel'
	| 'finish'
	| 'versioned'
	| 'ppc_completo';

/** Lista de PPCs do Coordenador: abas, busca, filtros, paginação e menu da linha. */
export class PpcListPage extends BasePage {
	readonly container = this.testId('page-ppc-list');
	readonly searchInput = this.testId('ppc-search-input');
	readonly filterButton = this.testId('ppc-button-filter');
	readonly clearButton = this.testId('ppc-button-clear');
	readonly statusFilter = this.testId('ppc-filter-status');
	readonly sortFilter = this.testId('ppc-filter-sort');
	readonly pageSize = this.testId('ppc-pagination-page-size');
	readonly nextPage = this.testId('ppc-pagination-next');
	readonly createButton = this.testId('ppc-button-create');
	readonly confirmationModal = this.testId('ppc-confirmation-modal');
	readonly confirmButton = this.testId('ppc-modal-confirm-button');
	readonly finishModal = this.testId('ppc-finish-modal');

	constructor(page: Page) {
		super(page);
	}

	async goto(): Promise<void> {
		await this.page.goto(ppcUrl());
		await expect(this.container).toBeVisible();
	}

	tab(tab: PPCListTab) {
		return this.testId(`ppc-tab-${tab}`);
	}

	/** Abre a lista já na aba informada. */
	async openTab(tab: PPCListTab = PPC_LIST_TAB.EM_REVISAO): Promise<void> {
		await this.goto();
		await this.tab(tab).click();
		await expect(this.searchInput).toBeVisible();
	}

	rowMenu(ppcId: number) {
		return this.testId(`ppc-actions-menu-${ppcId}`);
	}

	rowAction(action: RowAction, ppcId: number) {
		return this.testId(`ppc-action-${action}-${ppcId}`);
	}

	// ── Busca, filtros e paginação ──────────────────────────────

	/** Filtra a lista pelo identificador do PPC. */
	async filterById(ppcId: number): Promise<void> {
		await this.searchInput.fill(String(ppcId));
		await this.filterButton.click();
	}

	/**
	 * Preenche a busca. A chamada só sai depois do debounce de 1s da tela, então
	 * quem chama confere o resultado com `expectListedIds`.
	 */
	async search(term: string): Promise<void> {
		await this.searchInput.fill(term);
	}

	/** Seleciona status e/ou ordenação e aciona o botão Filtrar. */
	async applyFilters({ status, sort }: ListFilters): Promise<void> {
		if (status) await this.statusFilter.selectOption(status);
		if (sort) await this.sortFilter.selectOption(sort);
		await this.filterButton.click();
	}

	/** Limpa busca, status e ordenação pelo botão Limpar. */
	async clearFilters(): Promise<void> {
		await this.clearButton.click();
	}

	/** Troca a quantidade de itens por página; a lista volta para a página 1. */
	async changePageSize(size: number): Promise<void> {
		await this.pageSize.selectOption(String(size));
	}

	/** Avança para a próxima página pela seta da paginação. */
	async goToNextPage(): Promise<void> {
		await this.nextPage.click();
	}

	/**
	 * Identificadores dos PPCs exibidos na página atual, na ordem da tabela. Cada
	 * linha é reconhecida pelo menu de ações, que carrega o id no `data-testid`.
	 */
	async listedIds(): Promise<number[]> {
		const testIds = await this.page
			.locator('[data-testid^="ppc-actions-menu-"]')
			.evaluateAll((nodes) =>
				nodes.map((node) => node.getAttribute('data-testid') ?? ''),
			);
		return testIds.map((testId) =>
			Number(testId.replace('ppc-actions-menu-', '')),
		);
	}

	/** Status exibidos na página atual, na ordem da tabela. */
	async listedStatuses(): Promise<string[]> {
		const testIds = await this.page
			.locator('[data-testid^="ppc-status-"]')
			.evaluateAll((nodes) =>
				nodes.map((node) => node.getAttribute('data-testid') ?? ''),
			);
		return testIds.map((testId) => testId.replace('ppc-status-', ''));
	}

	/**
	 * Espera a lista estabilizar no conjunto esperado de identificadores, em vez de
	 * dormir pelo debounce da busca ou pelo recarregamento do filtro.
	 */
	async expectListedIds(expected: number[]): Promise<void> {
		await expect
			.poll(() => this.listedIds(), { timeout: 30 * 1000 })
			.toEqual(expected);
	}

	// ── Menu da linha ───────────────────────────────────────────

	/** Abre a lista, seleciona a aba e filtra pelo identificador do PPC. */
	private async openRow(
		ppcId: number,
		tab: PPCListTab = PPC_LIST_TAB.EM_REVISAO,
	): Promise<void> {
		await this.goto();
		if (tab !== PPC_LIST_TAB.EM_REVISAO) {
			await this.tab(tab).click();
		}
		await this.filterById(ppcId);
		await expect(this.rowMenu(ppcId)).toBeVisible({ timeout: 30 * 1000 });
	}

	/**
	 * Executa uma ação do menu da linha do PPC. A lista é recarregada depois do
	 * filtro, então o menu pode fechar sozinho e a tentativa é repetida.
	 */
	private async runRowAction(
		ppcId: number,
		action: RowAction,
		confirm: () => Promise<void>,
	): Promise<void> {
		await this.clickMenuItem(
			this.rowMenu(ppcId).getByRole('button'),
			this.rowAction(action, ppcId),
			confirm,
		);
	}

	/** Ações oferecidas pelo menu da linha, na ordem em que aparecem. */
	async rowActions(
		ppcId: number,
		tab: PPCListTab = PPC_LIST_TAB.EM_REVISAO,
	): Promise<string[]> {
		await this.openRow(ppcId, tab);

		const items = this.page.locator(
			`[data-testid^="ppc-action-"][data-testid$="-${ppcId}"]`,
		);

		// O refetch da lista fecha o menu recém-aberto, por isso a abertura é
		// repetida até os itens ficarem visíveis.
		await expect(async () => {
			await this.rowMenu(ppcId).getByRole('button').click();
			await expect(items.first()).toBeVisible({ timeout: 5 * 1000 });
		}).toPass({ timeout: 60 * 1000 });

		const testIds = await items.evaluateAll((nodes) =>
			nodes.map((node) => node.getAttribute('data-testid') ?? ''),
		);
		await this.page.keyboard.press('Escape');

		return testIds.map((testId) =>
			testId.replace('ppc-action-', '').replace(`-${ppcId}`, ''),
		);
	}

	/** Cria o PPC pela lista aberta e devolve o link exibido no modal de resultado. */
	async createPPC(
		knowledgeArea: string,
		infoproducerEmail: string,
	): Promise<CreatedPPC> {
		await expect(this.container).toBeVisible();
		await this.createButton.click();

		await this.testId('input-area-conhecimento').fill(knowledgeArea);
		await this.testId('input-email').fill(infoproducerEmail);
		await this.testId('btn-submit').click();

		const linkInput = this.testId('input-link');
		await expect(linkInput).toBeVisible();
		const accessLink = await linkInput.inputValue();
		expect(accessLink).toContain('token=');

		await this.testId('btn-close-result').click();

		return { accessLink, infoproducerEmail };
	}

	/**
	 * Copia o link do Infoprodutor pela ação Copiar Link do menu de ações e devolve
	 * o conteúdo da área de transferência.
	 */
	async copyAccessLink(ppcId: number): Promise<string> {
		await this.page
			.context()
			.grantPermissions(['clipboard-read', 'clipboard-write']);

		await this.goto();
		await this.filterById(ppcId);

		await this.runRowAction(ppcId, 'copy_link', async () => {
			await expect(this.page.getByText(/link copiado/i).first()).toBeVisible({
				timeout: 10 * 1000,
			});
		});

		const link = await this.page.evaluate(() => navigator.clipboard.readText());
		expect(link).toContain('token=');
		return link;
	}

	/**
	 * Abre o PPC no modo de revisão pela ação Revisar do menu da lista, que é o
	 * caminho do Coordenador para revisar campo a campo.
	 */
	async openReviewMode(ppcId: number): Promise<void> {
		await this.goto();
		await this.filterById(ppcId);

		await this.runRowAction(ppcId, 'review', async () => {
			await expect(this.testId('general-info-review-tab')).toBeVisible({
				timeout: 30 * 1000,
			});
		});
	}

	/**
	 * Executa pausa, retomada ou cancelamento pelo menu da lista, confirmando o
	 * modal e esperando o toast de sucesso.
	 */
	private async changeStatus(
		ppcId: number,
		action: 'pause' | 'resume' | 'cancel',
		question: string,
		success: RegExp,
	): Promise<void> {
		await this.openRow(ppcId);
		await this.runRowAction(ppcId, action, async () => {
			await expect(this.confirmationModal).toBeVisible({ timeout: 5000 });
			await expect(this.page.getByText(question)).toBeVisible();
			await this.confirmButton.click();
			await expect(this.page.getByText(success).first()).toBeVisible({
				timeout: 30 * 1000,
			});
		});
	}

	/** Pausa o PPC. O status passa para STAND_BY. */
	async pause(ppcId: number): Promise<void> {
		await this.changeStatus(
			ppcId,
			'pause',
			'Você deseja pausar esse projeto?',
			/ppc pausado com sucesso/i,
		);
	}

	/** Retoma o PPC pausado. O status volta ao anterior. */
	async resume(ppcId: number): Promise<void> {
		await this.changeStatus(
			ppcId,
			'resume',
			'Você deseja retomar esse projeto?',
			/ppc retomado com sucesso/i,
		);
	}

	/** Cancela o PPC. CANCELADO é estado terminal. */
	async cancel(ppcId: number): Promise<void> {
		await this.changeStatus(
			ppcId,
			'cancel',
			'Você deseja cancelar esse projeto?',
			/ppc cancelado com sucesso/i,
		);
	}

	/**
	 * Dispara uma ação de download do menu da linha e devolve o arquivo recebido.
	 * O documento é gerado pelo backend, então a espera é maior que a dos modais.
	 */
	private async downloadRowDocument(
		ppcId: number,
		action: 'versioned' | 'ppc_completo',
		tab: PPCListTab,
	): Promise<DownloadedDocument> {
		await this.openRow(ppcId, tab);

		const esperaDownload = this.page.waitForEvent('download', {
			timeout: 5 * 60 * 1000,
		});

		await this.runRowAction(ppcId, action, async () => {
			await expect(this.rowAction(action, ppcId)).toBeHidden({
				timeout: 10 * 1000,
			});
		});

		const download = await esperaDownload;
		const caminho = await download.path();
		expect(caminho).toBeTruthy();
		const { size } = await stat(caminho as string);

		return { filename: download.suggestedFilename(), bytes: size };
	}

	/** Gera e baixa o PPC versionado. */
	async downloadVersionedDocument(
		ppcId: number,
		tab: PPCListTab = PPC_LIST_TAB.EM_REVISAO,
	): Promise<DownloadedDocument> {
		return this.downloadRowDocument(ppcId, 'versioned', tab);
	}

	/** Baixa o documento do PPC completo, disponível apenas em CONCLUIDO. */
	async downloadPPCCompleto(ppcId: number): Promise<DownloadedDocument> {
		return this.downloadRowDocument(
			ppcId,
			'ppc_completo',
			PPC_LIST_TAB.CONCLUIDOS,
		);
	}

	/** Conclui o PPC aprovado informando as classificações CAPES e OCDE. */
	async finish(ppcId: number, data: FinishData): Promise<void> {
		await this.goto();
		await this.filterById(ppcId);

		await this.runRowAction(ppcId, 'finish', async () => {
			await expect(this.finishModal).toBeVisible({ timeout: 5000 });
		});

		await this.testId('finish-capes-evaluation-area').fill(
			data.capesEvaluationArea,
		);
		await this.testId('finish-capes-main-area').fill(data.capesMainArea);
		await this.testId('finish-capes-knowledge-area').fill(
			data.capesKnowledgeArea,
		);
		await this.testId('finish-ocde-classification').fill(
			data.ocdeClassification,
		);
		await this.testId('finish-confirm-button').click();

		await expect(this.finishModal).toBeHidden();
	}
}

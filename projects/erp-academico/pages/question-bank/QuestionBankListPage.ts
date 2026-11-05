import { expect, Locator, Page } from '@playwright/test';
import { BasePage } from '../../../../shared/pages/BasePage';
import {
	E2E_QB_BLOOM,
	E2E_QB_PDF,
	E2E_QB_QUESTIONS,
	questionBankUrl,
} from '../../config/env';
import { QB_STATUS } from '../../api/QuestionBankApi';

export interface NewQuestionBank {
	discipline: string;
	course: string;
	infoproducerEmail: string;
	numberOfQuestions?: string;
	bloom?: string;
	pdfPath?: string;
}

type RowAction = 'EDIT' | 'VIEW' | 'SEND_TO_COSMOS' | 'DELETE';

const QB_STATUS_LABEL: Record<string, string> = {
	[QB_STATUS.aguardando]: 'Aguardando',
	[QB_STATUS.processando]: 'Processando',
	[QB_STATUS.pronta]: 'Pronta',
	[QB_STATUS.erro]: 'Erro',
	[QB_STATUS.finalizada]: 'Finalizada',
};

/** Rótulo que a listagem exibe para cada estado devolvido pela API. */
export function statusLabel(status: string): string {
	return QB_STATUS_LABEL[status] ?? status;
}

/** Listagem do Banco de Questões, com criação, filtro e menu da linha. */
export class QuestionBankListPage extends BasePage {
	readonly container = this.testId('page-question-bank');
	readonly searchInput = this.testId('question-bank-search-input');
	readonly createButton = this.testId('question-bank-button-create');
	readonly createModal = this.testId('add-questions-modal');
	readonly exportModal = this.testId('export-to-cosmos-modal');
	readonly deleteModal = this.testId('delete-question-bank-modal');
	readonly detailPage = this.testId('page-question-detail');

	constructor(page: Page) {
		super(page);
	}

	async goto(): Promise<void> {
		await this.page.goto(questionBankUrl());
		await expect(this.container).toBeVisible();
	}

	/**
	 * Cria o banco de questões pelo modal da listagem, com upload real do arquivo.
	 * O input de arquivo é escondido atrás da área clicável, então o arquivo é
	 * entregue direto ao input e a barra de progresso é aguardada, que é a condição
	 * que habilita o botão de envio.
	 */
	async create(data: NewQuestionBank): Promise<void> {
		await this.createButton.click();
		const modal = this.createModal;
		await expect(modal).toBeVisible();

		await modal.getByTestId('field-discipline').fill(data.discipline);
		await modal.getByTestId('field-course').fill(data.course);
		await modal
			.getByTestId('field-infoproducer-email')
			.fill(data.infoproducerEmail);
		await modal
			.getByTestId('field-number-of-questions')
			.selectOption(data.numberOfQuestions ?? E2E_QB_QUESTIONS);
		await modal
			.getByTestId('field-bloom')
			.selectOption(data.bloom ?? E2E_QB_BLOOM);

		await modal
			.locator('input[type="file"]')
			.setInputFiles(data.pdfPath ?? E2E_QB_PDF);
		await expect(modal.getByTestId('upload-progress-bar')).toBeVisible();

		const submit = modal.getByTestId('add-questions-submit');
		await expect(submit).toBeEnabled();
		await submit.click();

		await expect(modal).toBeHidden({ timeout: 60 * 1000 });
	}

	/** Linha da listagem cujo identificador é exatamente o informado. */
	rowById(id: number): Locator {
		return this.page.getByRole('row').filter({
			has: this.page.getByRole('cell', { name: String(id), exact: true }),
		});
	}

	/** Filtra a listagem pelo identificador do banco, que a busca aceita. */
	async filterById(id: number): Promise<Locator> {
		await this.searchInput.fill(String(id));
		const row = this.rowById(id);
		await expect(row).toBeVisible({ timeout: 30 * 1000 });
		return row;
	}

	/**
	 * Executa uma ação do menu da linha. O menu fecha sozinho quando a listagem é
	 * recarregada depois do filtro, então a tentativa é repetida.
	 */
	private async runRowAction(
		id: number,
		action: RowAction,
		confirm: () => Promise<void>,
	): Promise<void> {
		await this.clickMenuItem(
			this.testId(`question-bank-actions-menu-${id}`).getByRole('button'),
			this.testId(`question-bank-action-${action}-${id}`),
			confirm,
		);
	}

	/** Abre o detalhe do banco em modo de edição pela ação Editar. */
	async openDetailForEdit(id: number): Promise<void> {
		await this.runRowAction(id, 'EDIT', async () => {
			await expect(this.detailPage).toBeVisible({ timeout: 30 * 1000 });
		});
		expect(this.page.url()).toContain(`/question-bank/${id}`);
	}

	/** Abre o detalhe do banco em modo de leitura pela ação Visualizar. */
	async openDetailForView(id: number): Promise<void> {
		await this.runRowAction(id, 'VIEW', async () => {
			await expect(this.detailPage).toBeVisible({ timeout: 30 * 1000 });
		});
	}

	/**
	 * Envia o banco para o Cosmos pela ação da listagem, escolhendo a coleção na
	 * busca do modal. Devolve o rótulo da coleção escolhida.
	 */
	async exportToCosmos(id: number, collectionTerm: string): Promise<string> {
		const modal = this.exportModal;

		await this.runRowAction(id, 'SEND_TO_COSMOS', async () => {
			await expect(modal).toBeVisible({ timeout: 5000 });
		});

		await modal.getByTestId('export-to-cosmos-search').fill(collectionTerm);
		const firstOption = this.testId('select-search-option-0');
		await expect(firstOption).toBeVisible({ timeout: 30 * 1000 });
		const label = (await firstOption.innerText()).trim();
		await firstOption.click();

		await modal.getByTestId('export-to-cosmos-submit').click();
		await expect(modal).toBeHidden({ timeout: 60 * 1000 });

		return label;
	}

	/** Exclui pela tela o banco criado pelo teste. */
	async delete(id: number): Promise<void> {
		await this.goto();
		await this.filterById(id);

		const modal = this.deleteModal;
		await this.runRowAction(id, 'DELETE', async () => {
			await expect(modal).toBeVisible({ timeout: 5000 });
		});
		await modal.getByTestId('delete-question-bank-confirm').click();
		await expect(modal).toBeHidden({ timeout: 60 * 1000 });
	}
}

import { expect, Page } from '@playwright/test';
import { BasePage } from '../../../../shared/pages/BasePage';
import { longText } from '../../../../shared/helpers/text';
import { E2E_LOCALE } from '../../config/env';
import { DISCIPLINE_TYPE } from '../../data/ppc';
import { DisciplineRow, DisciplinesTable } from './components/DisciplinesTable';

/** Campos de revisão que a tela do Coordenador expõe por disciplina. */
const DISCIPLINE_REVIEW_FIELDS = 5;

export interface DisciplineReviewResult {
	/** Campos aprovados na aba Disciplinas. */
	aprovados: number;
	/** Campo reprovado, quando o cenário pede correção. */
	reprovado: string | null;
	/** Identificador da disciplina que teve um campo reprovado. */
	reprovadoId: string | null;
}

/** Modo de revisão do PPC pelo Coordenador, campo a campo. */
export class PpcReviewPage extends BasePage {
	readonly disciplines = new DisciplinesTable(this.page);
	readonly generalInfoTab = this.testId('general-info-review-tab');
	readonly specialistsTab = this.testId('specialists-review-tab');
	readonly approveButton = this.testId('review-panel-approve-button');

	constructor(page: Page) {
		super(page);
	}

	private async openTab(name: string): Promise<void> {
		await this.page.getByRole('tab', { name }).click();
	}

	/**
	 * Aprova, um a um, os painéis de revisão visíveis na tela. Depois da aprovação
	 * o painel passa a exibir Desaprovar, então o botão sai da contagem. Campos já
	 * reprovados mantêm o botão desabilitado e são ignorados.
	 */
	private async approveVisiblePanels(): Promise<number> {
		const approve = this.approveButton;
		await expect(
			this.page.locator('[data-testid^="review-panel-"]').first(),
		).toBeVisible();

		let aprovados = 0;

		for (;;) {
			const restantes = await approve.count();
			if (restantes === 0) break;

			const habilitados = await approve.evaluateAll((buttons) =>
				buttons.map((button) => !(button as HTMLButtonElement).disabled),
			);
			const alvo = habilitados.indexOf(true);
			if (alvo < 0) break;

			await approve.nth(alvo).click();
			aprovados++;
			await expect
				.poll(() => approve.count(), { timeout: 30 * 1000 })
				.toBeLessThan(restantes);
		}

		return aprovados;
	}

	/** Reprova o primeiro campo visível com o comentário obrigatório. */
	private async rejectFirstVisiblePanel(comment: string): Promise<void> {
		await this.testId('review-panel-correction-button').first().click();
		await this.testId('review-panel-textarea').first().fill(comment);
		await this.testId('review-panel-save-button').first().click();
		await expect(this.page.getByText(comment).first()).toBeVisible();
	}

	/** Revisa e aprova os campos da aba Informações Gerais. */
	async reviewGeneralInfo(): Promise<number> {
		await this.openTab('Informações Gerais');
		await expect(this.generalInfoTab).toBeVisible();
		return this.approveVisiblePanels();
	}

	/** Revisa e aprova cada especialista cadastrado pelo Infoprodutor. */
	async reviewSpecialists(): Promise<number> {
		await this.openTab('Especialistas');
		await expect(this.specialistsTab).toBeVisible();

		const ids = await this.page
			.locator('[data-testid^="specialist-status-"]')
			.evaluateAll((els) =>
				els.map(
					(el) =>
						el
							.getAttribute('data-testid')
							?.replace('specialist-status-', '') ?? '',
				),
			);
		let aprovados = 0;

		for (const id of ids.filter(Boolean)) {
			await this.clickMenuItem(
				this.page
					.locator('tr', { has: this.testId(`specialist-status-${id}`) })
					.getByRole('button', { name: 'Ações' }),
				this.testId(`btn-review-specialist-${id}`),
				undefined,
				60 * 1000,
			);
			await expect(this.testId('review-specialist-fullname')).toBeVisible();

			aprovados += await this.approveVisiblePanels();

			await this.testId('btn-back-specialist-list').click();
			await expect(this.specialistsTab).toBeVisible();
		}

		return aprovados;
	}

	/** Abre a aba Disciplinas do modo de revisão e devolve as linhas da matriz. */
	private async openDisciplinesTab(): Promise<DisciplineRow[]> {
		await this.openTab('Disciplinas');
		await expect(this.disciplines.table).toBeVisible();
		return this.disciplines.readRows();
	}

	/**
	 * Preenche pela tela as disciplinas Anhanguera vinculadas pelo Infoprodutor.
	 * Sem ementa, conteúdo programático e referências do Coordenador elas seguem
	 * pendentes e o backend recusa a finalização da revisão. A Ambientação da ordem
	 * 1 já vem preenchida.
	 */
	async fillAnhangueraDisciplines(): Promise<number> {
		const rows = await this.openDisciplinesTab();
		const pendentes = rows.filter(
			(row) => row.type === DISCIPLINE_TYPE.anhanguera && row.order !== '1',
		);
		expect(pendentes.length).toBeGreaterThan(0);

		for (const row of pendentes) {
			await this.clickMenuItem(
				this.disciplines.actionsMenu(row.id),
				this.disciplines.menuItem('preencher', row.id),
				undefined,
				60 * 1000,
			);

			const syllabus = this.testId('textarea-syllabus');
			await expect(syllabus).toBeVisible();
			await syllabus.fill(
				longText(750, `Ementa da disciplina Anhanguera ${row.order}.`),
			);

			for (let lesson = 1; lesson <= 4; lesson++) {
				await this.testId(`textarea-programContent-${lesson}`).fill(
					longText(250, `Conteúdo programático da aula ${lesson}.`),
				);
				await this.testId(`textarea-bibliographicReference-${lesson}`).fill(
					longText(250, `Referência bibliográfica ${lesson}.`),
				);
			}

			await this.testId('btn-save').click();
			await expect(syllabus).toBeHidden();
			await expect(this.disciplines.table).toBeVisible();
		}

		return pendentes.length;
	}

	/**
	 * Revisa campo a campo as disciplinas criadas pelo Infoprodutor. Quando
	 * `rejectComment` é informado, o primeiro campo da primeira disciplina é
	 * reprovado com o comentário obrigatório e os demais são aprovados.
	 */
	async reviewInfoproducerDisciplines(
		rejectComment?: string,
	): Promise<DisciplineReviewResult> {
		const rows = await this.openDisciplinesTab();
		const disciplinas = rows.filter(
			(row) => row.type === DISCIPLINE_TYPE.infoproducer,
		);
		expect(disciplinas.length).toBeGreaterThan(0);

		let aprovados = 0;
		let reprovado: string | null = null;
		let reprovadoId: string | null = null;

		for (const row of disciplinas) {
			await this.clickMenuItem(
				this.disciplines.actionsMenu(row.id),
				this.disciplines.menuItem('revisar', row.id),
				undefined,
				60 * 1000,
			);
			await expect(this.testId('review-discipline-name')).toBeVisible();
			await expect(
				this.page.locator('[data-testid^="review-panel-DISCIPLINAS-"]'),
			).toHaveCount(DISCIPLINE_REVIEW_FIELDS);

			if (rejectComment && !reprovado) {
				await this.rejectFirstVisiblePanel(rejectComment);
				reprovado = `disciplina ${row.order}`;
				reprovadoId = row.id;
			}

			aprovados += await this.approveVisiblePanels();

			await this.testId('btn-back-discipline-list').click();
			await expect(this.disciplines.table).toBeVisible();
		}

		return { aprovados, reprovado, reprovadoId };
	}

	/**
	 * Finaliza a revisão pela tela: o botão fica na aba Disciplinas e exige a
	 * confirmação do modal. Ao final o Coordenador volta para a lista de PPC.
	 */
	async finishReview(): Promise<void> {
		await this.openTab('Disciplinas');
		await this.testId('btn-finish-review').click();
		await expect(this.testId('ppc-confirmation-modal')).toBeVisible();
		await this.testId('ppc-modal-confirm-button').click();
		await this.page.waitForURL(`**/${E2E_LOCALE}/ppc`, { timeout: 60 * 1000 });
	}
}

import { expect, Page, Response } from '@playwright/test';
import { BasePage } from '../../../../shared/pages/BasePage';
import { longText } from '../../../../shared/helpers/text';
import {
	DISCIPLINE_STATUS,
	DISCIPLINE_TYPE,
	DisciplineStatus,
	DisciplineType,
	INFOPRODUCER_DISCIPLINE_COUNT,
	REQUIRED_DISTRIBUTION_TOTAL,
	SPECIALIST_CPF,
} from '../../data/ppc';
import { DisciplinesTable } from './components/DisciplinesTable';

export interface ExpectedInitialDisciplines {
	/** Disciplinas Anhanguera que o Infoprodutor precisa selecionar. */
	anhanguera: number;
	/** Disciplinas que o Infoprodutor precisa criar e preencher. */
	infoproducer: number;
}

/**
 * Formulário externo do PPC preenchido pelo Infoprodutor: Informações Gerais,
 * Especialistas, Carga Horária e Disciplinas, até o envio para revisão.
 */
export class PpcExternalFormPage extends BasePage {
	readonly disciplines = new DisciplinesTable(this.page);
	readonly form = this.testId('ppc-external-form');
	readonly title = this.testId('input-title');
	readonly generalObjective = this.testId('textarea-general-objective');
	readonly justification = this.testId('textarea-justification');
	readonly targetAudience = this.testId('textarea-target-audience');
	readonly titleSuggestions = this.testId('title-suggestions');
	readonly nextTabButton = this.testId('ppc-tabs-next-button');
	readonly workloadTable = this.testId('workload-table');
	readonly continueButton = this.page.getByRole('button', {
		name: 'Continuar',
	});
	readonly addSpecialistButton = this.page.getByRole('button', {
		name: 'Adicionar Especialista',
	});
	readonly disciplineNameInput = this.testId('input-discipline-name');

	constructor(page: Page) {
		super(page);
	}

	specificObjective(index: number) {
		return this.testId(`input-specific-objective-${index}`);
	}

	/**
	 * Abre o link de acesso enviado ao Infoprodutor e valida o token. O formulário
	 * pode oferecer o assistente de IA antes de aparecer; o preenchimento manual
	 * segue pelo botão Pular.
	 */
	async openAccessLink(link: string): Promise<void> {
		await this.page.goto(link);

		const skipAssistant = this.page.getByRole('button', { name: 'Pular' });
		const assistantOffered = await skipAssistant
			.waitFor({ state: 'visible', timeout: 20 * 1000 })
			.then(() => true)
			.catch(() => false);
		if (assistantOffered) {
			await skipAssistant.click();
		}

		await expect(this.form).toBeVisible();
		await expect(this.title).toBeVisible();
	}

	async fillGeneralInfo(title: string): Promise<void> {
		await this.title.fill(title);
		await this.generalObjective.fill(
			longText(1000, 'Objetivo geral do curso.'),
		);
		await this.specificObjective(1).fill(
			'Analisar fundamentos teóricos da área.',
		);
		await this.specificObjective(2).fill(
			'Aplicar técnicas em situações reais de trabalho.',
		);
		await this.specificObjective(3).fill(
			'Avaliar resultados com base em evidências.',
		);
		await this.justification.fill(
			longText(750, 'Justificativa da oferta do curso.'),
		);
		await this.targetAudience.fill(longText(1250, 'Público-alvo do curso.'));
		await this.testId('radio-whatsapp').click();

		await this.nextTabButton.click();
		await expect(this.testId('ppc-tab-1')).toBeEnabled();
	}

	/** Cadastra um especialista e volta para a lista de especialistas. */
	async addSpecialist(name: string): Promise<void> {
		await this.addSpecialistButton.click();

		await this.page.locator('input[name="fullName"]').fill(name);
		await this.page
			.locator('select[name="formationTypeId"]')
			.selectOption({ index: 1 });
		await this.page
			.locator('input[placeholder="000.000.000-00"]')
			.fill(SPECIALIST_CPF);
		await this.page
			.locator('input[name="email"]')
			.fill(`${name.toLowerCase().replace(/[^a-z0-9]+/g, '.')}@example.com`);

		// A validação de envio exige um docente responsável pelo curso; o campo é
		// bloqueado quando já existe outro responsável cadastrado.
		const responsavel = this.page.getByRole('checkbox', {
			name: 'Este docente é o responsável pelo Curso',
		});
		if (await responsavel.isEditable()) {
			// O input do checkbox fica atrás do controle visual do Chakra, então o
			// clique real acontece no rótulo.
			await this.page
				.getByText('Este docente é o responsável pelo Curso')
				.click();
			await expect(responsavel).toBeChecked();
		}

		await this.page.getByRole('button', { name: 'Salvar' }).click();
		await expect(this.addSpecialistButton).toBeVisible();
	}

	async goToWorkload(): Promise<void> {
		await this.continueButton.click();
		await expect(this.workloadTable).toBeVisible();
	}

	/**
	 * Preenche a carga horária respeitando as regras da tela: distribuição total de
	 * 40h, mínimo de 8h de videoaulas e mínimo de 6 disciplinas do Infoprodutor.
	 * Tutoria e banco de questões são fixos, então o material escrito absorve a
	 * diferença até fechar as 40h.
	 */
	async fillWorkload(): Promise<void> {
		const setValue = async (field: string, value: number) => {
			await this.testId(`workload-input-${field}`).fill(String(value));
		};

		await setValue(
			'infoproducerDisciplineCount',
			INFOPRODUCER_DISCIPLINE_COUNT,
		);
		await setValue('liveVideoLessonsWorkload', 4);
		await setValue('recordedVideoLessonsWorkload', 4);
		await setValue('podcastWorkload', 0);
		await setValue('extraMaterialWorkload', 0);
		await setValue('scientificWrittenMaterialWorkload', 0);

		const totalRow = this.testId('workload-row-total').last();
		const readTotal = async () => {
			const cells = await totalRow.locator('td').allInnerTexts();
			return Number(cells.at(-1)?.trim());
		};

		const fixedTotal = await readTotal();
		await setValue(
			'scientificWrittenMaterialWorkload',
			REQUIRED_DISTRIBUTION_TOTAL - fixedTotal,
		);
		await expect.poll(readTotal).toBe(REQUIRED_DISTRIBUTION_TOTAL);

		await this.continueButton.click();
		await expect(this.testId('ppc-tab-3')).toBeEnabled();
	}

	/**
	 * Valida a matriz que o backend cria ao concluir a carga horária: a primeira
	 * linha é a Ambientação (Anhanguera, já completa e fixa), seguida das
	 * disciplinas Anhanguera a selecionar e das disciplinas do Infoprodutor,
	 * todas vazias.
	 */
	async assertInitialDisciplines(
		expected: ExpectedInitialDisciplines,
	): Promise<void> {
		const total = 1 + expected.anhanguera + expected.infoproducer;

		await expect(this.disciplines.table).toBeVisible();
		await expect
			.poll(async () => (await this.disciplines.readRows()).length, {
				message: 'disciplinas criadas pelo backend',
			})
			.toBeGreaterThanOrEqual(1 + expected.infoproducer);

		const rows = await this.disciplines.readRows();
		const resumo = rows
			.map((row) => `${row.order} ${row.name} [${row.type}/${row.status}]`)
			.join(' | ');

		// As asserções são soft para que uma divergência na matriz inicial não
		// interrompa a validação do restante do fluxo.
		expect.soft(rows, `matriz recebida: ${resumo}`).toHaveLength(total);

		expect.soft(rows[0], `matriz recebida: ${resumo}`).toMatchObject({
			order: '1',
			name: 'Ambientação',
			type: DISCIPLINE_TYPE.anhanguera,
		});

		const anhanguera = rows
			.slice(1)
			.filter((row) => row.type === DISCIPLINE_TYPE.anhanguera);
		const infoproducer = rows.filter(
			(row) => row.type === DISCIPLINE_TYPE.infoproducer,
		);

		expect
			.soft(anhanguera, `Anhanguera a selecionar — matriz recebida: ${resumo}`)
			.toHaveLength(expected.anhanguera);
		expect
			.soft(infoproducer, `Infoprodutor a criar — matriz recebida: ${resumo}`)
			.toHaveLength(expected.infoproducer);

		for (const row of [...anhanguera, ...infoproducer]) {
			expect
				.soft(row.name, `disciplina ${row.order} deveria estar vazia`)
				.toBe('(Vazio)');
			expect
				.soft(row.status, `disciplina ${row.order} deveria estar incompleta`)
				.toContain(DISCIPLINE_STATUS.incompleta);
		}
	}

	/** Define a data de início da primeira disciplina e aplica em sequência. */
	async applyStartDate(date: string): Promise<void> {
		const apply = this.page.getByRole('button', { name: 'Aplicar' });
		await this.page.locator('input[type="date"]').fill(date);
		await apply.click();
		await expect(apply).toBeEnabled();
	}

	private async disciplineIdsByTypeAndStatus(
		type: DisciplineType,
		status: DisciplineStatus,
	): Promise<string[]> {
		return this.page.locator('[data-testid^="discipline-type-"]').evaluateAll(
			(els, filters) =>
				els
					.map((el) => ({
						id: el
							.getAttribute('data-testid')
							?.replace('discipline-type-', ''),
						type: el.textContent ?? '',
					}))
					.filter((row) => Boolean(row.id) && row.type.includes(filters.type))
					.filter((row) =>
						(
							document.querySelector(
								`[data-testid="discipline-status-${row.id}"]`,
							)?.textContent ?? ''
						).includes(filters.status),
					)
					.map((row) => row.id as string),
			{ type, status },
		);
	}

	/**
	 * Vincula uma disciplina do catálogo Anhanguera em cada posição ainda vazia.
	 * Sem isso a validação do envio reprova o PPC.
	 */
	async linkAnhangueraDisciplines(): Promise<void> {
		const pending = await this.disciplineIdsByTypeAndStatus(
			DISCIPLINE_TYPE.anhanguera,
			DISCIPLINE_STATUS.incompleta,
		);

		// Cada posição recebe uma disciplina diferente do catálogo, como o
		// Infoprodutor faria: a mesma disciplina não pode ser reaproveitada.
		for (let index = 0; index < pending.length; index++) {
			const id = pending[index] as string;

			await this.disciplines.actionsMenu(id).click();
			await this.disciplines.menuItem('editar', id).click();
			await expect(
				this.page.getByText('Escolha uma disciplina Anhanguera'),
			).toBeVisible();

			await this.page
				.getByRole('button', { name: 'Vincular', exact: true })
				.nth(index)
				.click();
			await this.page
				.getByRole('dialog')
				.getByRole('button', { name: 'Vincular', exact: true })
				.click();

			await expect(this.disciplines.table).toBeVisible();
		}

		await expect
			.poll(() =>
				this.disciplineIdsByTypeAndStatus(
					DISCIPLINE_TYPE.anhanguera,
					DISCIPLINE_STATUS.incompleta,
				),
			)
			.toEqual([]);
	}

	/** Preenche todas as disciplinas do Infoprodutor que estão incompletas. */
	async fillInfoproducerDisciplines(specialistName: string): Promise<void> {
		// Só as disciplinas do tipo INFOPRODUTOR são preenchidas aqui; as
		// disciplinas Anhanguera já vêm cadastradas e não são editáveis.
		const ids = await this.page
			.locator('[data-testid^="discipline-type-"]')
			.evaluateAll(
				(els, type) =>
					els
						.filter((el) => (el.textContent ?? '').includes(type))
						.map(
							(el) =>
								el
									.getAttribute('data-testid')
									?.replace('discipline-type-', '') ?? '',
						),
				DISCIPLINE_TYPE.infoproducer,
			);

		for (const id of ids.filter(Boolean)) {
			await this.disciplines.actionsMenu(id).click();
			await this.disciplines.menuItem('editar', id).click();
			await expect(this.disciplineNameInput).toBeVisible();

			if (!(await this.disciplineNameInput.inputValue())) {
				await this.disciplineNameInput.fill(`Disciplina E2E ${id}`);
			}
			await this.testId('select-educator').selectOption({
				label: specialistName,
			});
			await this.testId('textarea-syllabus').fill(
				longText(750, `Ementa da disciplina ${id}.`),
			);

			for (let lesson = 1; lesson <= 4; lesson++) {
				await this.testId(`textarea-programContent-${lesson}`).fill(
					longText(250, `Conteúdo programático da aula ${lesson}.`),
				);
				await this.testId(`textarea-bibliographicReference-${lesson}`).fill(
					longText(250, `Referência bibliográfica ${lesson}.`),
				);
			}

			await this.saveDiscipline(id);
		}
	}

	/**
	 * Salva a disciplina aberta e espera o formulário fechar. O salvamento passa por
	 * server action, então uma recusa da API só aparece em toast de duração curta;
	 * ler a resposta da action faz a falha dizer o motivo da recusa.
	 */
	private async saveDiscipline(disciplineId: string): Promise<void> {
		const form = this.disciplineNameInput;
		let recusa = '';

		const capturarRecusa = async (response: Response): Promise<void> => {
			if (response.request().method() !== 'POST') return;
			const corpo = await response.text().catch(() => '');
			const erro = /"error":"([^"]+)"/.exec(corpo);
			if (erro?.[1]) recusa = erro[1];
		};

		this.page.on('response', capturarRecusa);
		try {
			await this.testId('btn-save').click();
			await expect
				.poll(
					async () => {
						if (!(await form.isVisible())) return 'salvo';
						return recusa
							? `recusado pela API: ${recusa}`
							: 'formulário ainda aberto';
					},
					{
						timeout: 30 * 1000,
						message: `salvar a disciplina ${disciplineId} do Infoprodutor`,
					},
				)
				.toBe('salvo');
		} finally {
			this.page.off('response', capturarRecusa);
		}
	}

	/**
	 * Percorre o assistente do formulário externo até a aba Disciplinas. As abas são
	 * um wizard, então o caminho passa por Especialistas e Carga Horária.
	 */
	async goToDisciplinesTab(): Promise<void> {
		await this.nextTabButton.click();
		await this.continueButton.click();
		await expect(this.workloadTable).toBeVisible();
		await this.continueButton.click();
		await expect(this.disciplines.table).toBeVisible();
	}

	/**
	 * Ajusta a disciplina reprovada pelo Coordenador. Em modo de correção só os
	 * campos reprovados ficam editáveis, e o nome é o campo que a suíte reprova.
	 */
	async adjustRejectedDiscipline(
		disciplineId: string,
		name: string,
	): Promise<void> {
		await this.disciplines.actionsMenu(disciplineId).click();
		await this.disciplines.menuItem('editar', disciplineId).click();

		await expect(this.disciplineNameInput).toBeVisible();
		await expect(this.disciplineNameInput).toBeEditable();
		await this.disciplineNameInput.fill(name);

		await this.saveDiscipline(disciplineId);
		await expect(this.disciplines.table).toBeVisible();
	}

	/**
	 * Envia o PPC preenchido para revisão do Coordenador. O botão só abre o modal de
	 * confirmação quando a validação de completude passa, então a recusa da
	 * validação é capturada da resposta da server action para a falha dizer o
	 * motivo em vez de apenas não encontrar o modal.
	 */
	async submit(): Promise<void> {
		const dialog = this.page.getByRole('dialog');
		const confirmacao = dialog.getByText('Você deseja enviar seu projeto?');
		let recusa = '';

		const capturarRecusa = async (response: Response): Promise<void> => {
			if (response.request().method() !== 'POST') return;
			const corpo = await response.text().catch(() => '');
			if (!corpo.includes('"message"') && !corpo.includes('"error"')) return;
			const mensagens = [...corpo.matchAll(/"message":"([^"]+)"/g)].map(
				(m) => m[1],
			);
			const erro = /"error":"([^"]+)"/.exec(corpo);
			if (mensagens.length) recusa = mensagens.join(' | ');
			else if (erro?.[1] && erro[1] !== 'null') recusa = erro[1];
		};

		this.page.on('response', capturarRecusa);
		try {
			await this.page
				.getByRole('button', { name: 'Finalizar e enviar' })
				.click();
			await expect
				.poll(
					async () => {
						if (await confirmacao.isVisible()) return 'confirmação aberta';
						return recusa
							? `envio recusado: ${recusa}`
							: 'confirmação não apareceu';
					},
					{ timeout: 30 * 1000, message: 'enviar o PPC para revisão' },
				)
				.toBe('confirmação aberta');
		} finally {
			this.page.off('response', capturarRecusa);
		}

		await dialog.getByRole('button', { name: 'Enviar' }).click();

		await expect(
			this.page.getByText('PPC submetido para revisão com sucesso!'),
		).toBeVisible();
	}
}

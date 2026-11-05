import { expect, test } from '../../fixtures';
import { QB_STATUS, QuestionBankApi } from '../../api/QuestionBankApi';
import {
	E2E_QB_COLLECTION,
	E2E_QB_EXPORT_TIMEOUT_MS,
	E2E_QB_ID,
} from '../../config/env';
import { registrarBanco } from '../../flows/records';
import { statusLabel } from '../../pages/question-bank/QuestionBankListPage';

/**
 * Gestão das questões já geradas e envio para o Cosmos.
 *
 * Esta spec não cria banco nem faz upload, então pode rodar com frequência: ela
 * consome um banco em COMPLETO — o informado em E2E_QB_ID ou o mais recente —, o
 * leva até FINALIZADO e, por isso, gasta um registro por execução.
 */
let api: QuestionBankApi;
let bankId: number | undefined;

test.beforeAll(async () => {
	api = await QuestionBankApi.login();
	bankId = E2E_QB_ID ? Number(E2E_QB_ID) : await api.findLatestReady();

	if (bankId && (await api.getStatus(bankId)) !== QB_STATUS.pronta) {
		throw new Error(
			`O banco ${bankId} informado em E2E_QB_ID não está em ${QB_STATUS.pronta}`,
		);
	}
});

test.afterAll(async () => {
	await api?.dispose();
});

test.describe.serial('Banco de Questões em stage: gestão e envio', () => {
	test.beforeEach(() => {
		test.skip(
			!bankId,
			'nenhum banco COMPLETO disponível em stage; rode a spec de geração primeiro ou informe E2E_QB_ID',
		);
	});

	test('Coordenador abre o banco pronto e vê as questões geradas', async ({
		loginPage,
		dashboardPage,
		questionBankListPage: lista,
		questionBankDetailPage: detalhe,
	}) => {
		const id = bankId as number;
		const detail = await api.getDetail(id);
		registrarBanco(id, `reutilizado na gestão (${detail.status})`);

		await loginPage.loginAsCoordinator();
		await dashboardPage.openQuestionBank();

		const row = await lista.filterById(id);
		await expect(row).toContainText(statusLabel(QB_STATUS.pronta));

		await lista.openDetailForEdit(id);
		await detalhe.expectQuestions(detail);
	});

	test('Coordenador edita o enunciado e exclui uma questão', async ({
		loginPage,
		questionBankListPage: lista,
		questionBankDetailPage: detalhe,
	}) => {
		const id = bankId as number;
		const antes = await api.getDetail(id);
		const primeira = antes.questions[0];
		expect(primeira, 'o banco precisa ter questões para a gestão').toBeTruthy();

		const novoEnunciado = `${primeira!.statement} [revisado pelo E2E]`;

		await loginPage.loginAsCoordinator();
		await lista.goto();
		await lista.filterById(id);
		await lista.openDetailForEdit(id);
		await detalhe.editStatement(primeira!.id, novoEnunciado);

		await expect
			.poll(async () => {
				const detail = await api.getDetail(id);
				return detail.questions.find((q) => q.id === primeira!.id)?.statement;
			})
			.toBe(novoEnunciado);

		if (antes.questions.length < 2) {
			test.info().annotations.push({
				type: 'nota',
				description:
					'o banco tinha uma única questão, então a exclusão de questão não foi exercitada',
			});
			return;
		}

		const alvo = antes.questions[1]!;
		await lista.goto();
		await lista.filterById(id);
		await lista.openDetailForEdit(id);
		await detalhe.deleteQuestion(alvo.id);

		const depois = await api.getDetail(id);
		expect(depois.questions.map((q) => q.id)).not.toContain(alvo.id);
		expect(depois.questions).toHaveLength(antes.questions.length - 1);
	});

	test('Coordenador envia o banco para o Cosmos e ele fica FINALIZADO', async ({
		loginPage,
		questionBankListPage: lista,
		questionBankDetailPage: detalhe,
	}) => {
		const id = bankId as number;
		test.setTimeout(E2E_QB_EXPORT_TIMEOUT_MS + 3 * 60 * 1000);

		await loginPage.loginAsCoordinator();
		await lista.goto();
		await lista.filterById(id);

		const colecao = await lista.exportToCosmos(id, E2E_QB_COLLECTION);

		// O envio também é assíncrono: o registro volta para PROCESSANDO enquanto as
		// questões são publicadas no Cosmos.
		const status = await api.waitForExport(id);
		expect(status).toBe(QB_STATUS.finalizada);
		const detail = await api.getDetail(id);
		expect(detail.collectionId).toBeTruthy();
		expect(colecao).toContain(detail.collectionName ?? '');
		registrarBanco(
			id,
			`enviado ao Cosmos na coleção ${detail.collectionId} (${detail.status})`,
		);

		await lista.goto();
		const row = await lista.filterById(id);
		await expect(row).toContainText(statusLabel(QB_STATUS.finalizada));

		await detalhe.gotoById(id);
		await expect(detalhe.linkedCollection).toContainText(
			detail.collectionName ?? '',
		);
	});
});

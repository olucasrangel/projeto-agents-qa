import { expect, test } from '../../fixtures';
import {
	QB_PENDING_STATUS,
	QB_STATUS,
	QuestionBankApi,
} from '../../api/QuestionBankApi';
import {
	E2E_QB_CLEANUP,
	E2E_QB_COURSE,
	E2E_QB_DISCIPLINE,
	E2E_QB_QUESTIONS,
	E2E_QB_TIMEOUT_MS,
	infoproducerEmail,
} from '../../config/env';
import { registrarBanco } from '../../flows/records';
import { statusLabel } from '../../pages/question-bank/QuestionBankListPage';

/**
 * Geração de questões com IA a partir do upload de um arquivo.
 *
 * Esta spec é a única que gasta armazenamento no S3 e uma chamada de geração por
 * execução, então está marcada com @custo-alto e fica fora da execução
 * agendada. Rode explicitamente com E2E_QB_EXPENSIVE=1.
 */
let api: QuestionBankApi;
let bankId: number;

const stamp = Date.now();
const discipline = `${E2E_QB_DISCIPLINE} E2E ${stamp}`;

test.beforeAll(async () => {
	api = await QuestionBankApi.login();
});

test.afterAll(async () => {
	await api?.dispose();
});

test.describe.serial(
	'Banco de Questões em stage: geração com IA @custo-alto',
	() => {
		test('Coordenador cria o banco com upload do arquivo', async ({
			loginPage,
			dashboardPage,
			questionBankListPage: lista,
		}) => {
			test.slow();

			await loginPage.loginAsCoordinator();
			await dashboardPage.openQuestionBank();
			await lista.create({
				discipline,
				course: E2E_QB_COURSE,
				infoproducerEmail: infoproducerEmail(stamp),
			});

			bankId = await api.findByDiscipline(discipline);
			const status = await api.getStatus(bankId);
			expect(QB_PENDING_STATUS).toContain(status);
			registrarBanco(bankId, `criado pelo upload do arquivo (${status})`);

			const row = await lista.filterById(bankId);
			await expect(row).toContainText(statusLabel(status));
		});

		test('A geração assíncrona conclui e as questões têm a estrutura esperada', async ({
			loginPage,
			questionBankListPage: lista,
			questionBankDetailPage: detalhe,
		}) => {
			test.setTimeout(E2E_QB_TIMEOUT_MS + 3 * 60 * 1000);

			const status = await api.waitForGeneration(bankId);
			registrarBanco(bankId, `geração encerrada em ${status}`);
			expect(
				status,
				'a geração em stage terminou fora de COMPLETO, o que é divergência de produto ou de ambiente',
			).toBe(QB_STATUS.pronta);

			const detail = await api.getDetail(bankId);
			expect(detail.questions).toHaveLength(Number(E2E_QB_QUESTIONS));
			expect(detail.discipline).toBe(discipline);
			expect(detail.course).toBe(E2E_QB_COURSE);

			for (const question of detail.questions) {
				expect(question.statement.trim()).not.toBe('');
				expect(question.explanation.trim()).not.toBe('');
				expect(question.alternatives.length).toBeGreaterThanOrEqual(2);
				expect(
					question.alternatives.filter((alternative) => alternative.isCorrect),
				).toHaveLength(1);
			}

			await loginPage.loginAsCoordinator();
			await lista.goto();
			const row = await lista.filterById(bankId);
			await expect(row).toContainText(statusLabel(QB_STATUS.pronta));

			await lista.openDetailForView(bankId);
			await detalhe.expectQuestions(detail);
		});

		test('O banco criado pelo teste é excluído pela tela', async ({
			loginPage,
			questionBankListPage: lista,
		}) => {
			test.skip(
				!E2E_QB_CLEANUP,
				'o banco gerado é mantido como insumo COMPLETO da spec de gestão; rode com E2E_QB_CLEANUP=1 para excluir',
			);

			await loginPage.loginAsCoordinator();
			await lista.delete(bankId);

			await expect
				.poll(() => api.list({ discipline, pageSize: 20 }))
				.toHaveLength(0);
			registrarBanco(bankId, 'excluído pela tela ao final da execução');
		});
	},
);

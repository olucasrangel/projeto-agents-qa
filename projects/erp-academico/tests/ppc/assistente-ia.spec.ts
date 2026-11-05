import { expect, test } from '../../fixtures';
import { CoordinatorApi } from '../../api/CoordinatorApi';
import { E2E_PPC_AI_TIMEOUT_MS } from '../../config/env';
import { criarPPC } from '../../flows/ppc.flow';
import { registrarPPC } from '../../flows/records';
import { AI_ASSIST_MIN_CHARS } from '../../pages/ppc/PpcAiAssistPage';
import { longText } from '../../../../shared/helpers/text';

/**
 * Assistente de IA do Infoprodutor: a partir de três respostas curtas, a IA
 * escreve as Informações Gerais do PPC.
 *
 * Cada execução gasta uma chamada de geração, então a spec está marcada com
 * @custo-alto e fica fora da execução agendada. Rode explicitamente com
 * E2E_QB_EXPENSIVE=1.
 */
const RESPOSTAS = {
	objetivos: longText(
		AI_ASSIST_MIN_CHARS[0] ?? 200,
		'Formar profissionais capazes de analisar benefícios por incapacidade e conduzir perícias médicas com base na legislação previdenciária.',
	),
	justificativa: longText(
		AI_ASSIST_MIN_CHARS[1] ?? 200,
		'A demanda por especialistas em perícia médica previdenciária cresce com o volume de requerimentos de auxílio por incapacidade.',
	),
	publicoAlvo: longText(
		AI_ASSIST_MIN_CHARS[2] ?? 100,
		'Graduados em direito, medicina e serviço social que atuam com benefícios previdenciários.',
	),
};

let api: CoordinatorApi;
let ppcId: number;
let accessLink: string;

test.beforeAll(async () => {
	api = await CoordinatorApi.login();
});

test.afterAll(async () => {
	await api?.dispose();
});

test.describe.serial('Assistente de IA do Infoprodutor @custo-alto', () => {
	test('Coordenador cria o PPC e copia o link do Infoprodutor', async ({
		page,
		ppcListPage,
	}) => {
		ppcId = await criarPPC(page, api);
		accessLink = await ppcListPage.copyAccessLink(ppcId);
		registrarPPC(ppcId, 'criado para o assistente de IA (AGUARDANDO_RETORNO)');
	});

	test('O assistente só avança quando a resposta atinge o mínimo de caracteres', async ({
		page,
		ppcAiAssistPage,
	}) => {
		await page.goto(accessLink);
		await ppcAiAssistPage.accept();

		const minimo = AI_ASSIST_MIN_CHARS[0] ?? 200;
		await ppcAiAssistPage.textarea.fill('a'.repeat(minimo - 1));
		await expect(ppcAiAssistPage.nextButton).toBeDisabled();

		await ppcAiAssistPage.textarea.fill('a'.repeat(minimo));
		await expect(ppcAiAssistPage.nextButton).toBeEnabled();
	});

	test('A geração escreve as Informações Gerais e sugere nomes de curso', async ({
		page,
		ppcAiAssistPage,
		ppcExternalFormPage: form,
	}) => {
		test.setTimeout(E2E_PPC_AI_TIMEOUT_MS + 3 * 60 * 1000);

		await page.goto(accessLink);
		await ppcAiAssistPage.accept();
		await ppcAiAssistPage.generateSuggestions(RESPOSTAS);

		// Os mínimos conferidos aqui são os mesmos que o service exige da IA.
		await expect(form.title).not.toHaveValue('');
		expect((await form.generalObjective.inputValue()).length).toBeGreaterThanOrEqual(
			1000,
		);
		expect((await form.justification.inputValue()).length).toBeGreaterThanOrEqual(
			750,
		);
		expect((await form.targetAudience.inputValue()).length).toBeGreaterThanOrEqual(
			1250,
		);

		for (const indice of [1, 2, 3]) {
			await expect(form.specificObjective(indice)).not.toHaveValue('');
		}

		const sugestoes = form.titleSuggestions.getByRole('button');
		await expect(sugestoes).toHaveCount(3);

		const segunda = sugestoes.nth(1);
		const nomeEscolhido = (await segunda.textContent())?.trim() ?? '';
		await segunda.click();
		await expect(form.title).toHaveValue(nomeEscolhido);

		registrarPPC(ppcId, 'Informações Gerais escritas pelo assistente de IA');

		// A geração não salva nada: o PPC segue aguardando o envio do formulário.
		expect(await api.getStatus(ppcId)).toBe('AGUARDANDO_RETORNO');
	});
});

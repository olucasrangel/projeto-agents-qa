import { expect, test } from '../../fixtures';
import { CoordinatorApi } from '../../api/CoordinatorApi';
import { criarPPC } from '../../flows/ppc.flow';
import { registrarPPC } from '../../flows/records';

let api: CoordinatorApi;
let ppcId: number;

test.beforeAll(async () => {
	api = await CoordinatorApi.login();
});

test.afterAll(async () => {
	await api?.dispose();
});

test.describe.serial('Pausar, retomar e cancelar o PPC em stage', () => {
	test('Coordenador cria o PPC que será pausado e cancelado', async ({
		page,
	}) => {
		test.slow();
		ppcId = await criarPPC(page, api);
		registrarPPC(ppcId, 'criado para o cenário de pausa e cancelamento');
	});

	test('Coordenador pausa o PPC e o menu passa a oferecer Retomar', async ({
		loginPage,
		ppcListPage: lista,
	}) => {
		await loginPage.loginAsCoordinator();
		await lista.pause(ppcId);

		expect(await api.getStatus(ppcId)).toBe('STAND_BY');
		registrarPPC(ppcId, 'pausado pela tela (STAND_BY)');

		const acoes = await lista.rowActions(ppcId);
		expect(acoes).toContain('resume');
		expect(acoes).not.toContain('pause');
		expect(acoes).not.toContain('review');
		expect(acoes).not.toContain('cancel');
	});

	test('Coordenador retoma o PPC e ele volta ao status anterior', async ({
		loginPage,
		ppcListPage: lista,
	}) => {
		await loginPage.loginAsCoordinator();
		await lista.resume(ppcId);

		expect(await api.getStatus(ppcId)).toBe('AGUARDANDO_RETORNO');
		registrarPPC(ppcId, 'retomado pela tela (AGUARDANDO_RETORNO)');

		const acoes = await lista.rowActions(ppcId);
		expect(acoes).toContain('pause');
		expect(acoes).toContain('cancel');
		expect(acoes).not.toContain('resume');
	});

	test('Coordenador cancela o PPC e sobra apenas Visualizar', async ({
		loginPage,
		ppcListPage: lista,
	}) => {
		await loginPage.loginAsCoordinator();
		await lista.cancel(ppcId);

		expect(await api.getStatus(ppcId)).toBe('CANCELADO');
		registrarPPC(ppcId, 'cancelado pela tela (CANCELADO)');

		expect(await lista.rowActions(ppcId)).toEqual(['view']);
	});
});

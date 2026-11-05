import { expect, test } from '../../fixtures';
import { CoordinatorApi, PPCListItem } from '../../api/CoordinatorApi';
import { PPC_LIST_TAB } from '../../pages/ppc/PpcListPage';

let api: CoordinatorApi;
let emRevisao: PPCListItem[] = [];

/** Primeiro PPC da aba Revisão; a existência é garantida pelo skip do spec. */
function alvo(): PPCListItem {
	const item = emRevisao[0];
	if (!item) {
		throw new Error('Nenhum PPC em revisão disponível em stage');
	}
	return item;
}

test.beforeAll(async () => {
	api = await CoordinatorApi.login();
	const todos = await api.listPPCs(50);
	emRevisao = todos.filter((item) => item.status !== 'CONCLUIDO');
});

test.afterAll(async () => {
	await api?.dispose();
});

test.describe.serial('Listagem de PPCs do Coordenador em stage', () => {
	test.beforeEach(async ({ loginPage }) => {
		test.skip(
			emRevisao.length === 0,
			'Nenhum PPC em revisão em stage: rode tests/ppc/fluxo-completo.spec.ts antes.',
		);
		await loginPage.loginAsCoordinator();
	});

	test('Busca pelo identificador deixa apenas o PPC procurado', async ({
		ppcListPage: lista,
	}) => {
		const ppc = alvo();

		await lista.openTab();
		await lista.search(String(ppc.id));
		await lista.expectListedIds([Number(ppc.id)]);

		await lista.clearFilters();
		await expect
			.poll(async () => (await lista.listedIds()).length)
			.toBeGreaterThan(1);
	});

	test('Busca pelo nome encontra o PPC correspondente', async ({
		ppcListPage: lista,
	}) => {
		const ppc = alvo();

		await lista.openTab();
		await lista.search(ppc.ppcName);
		await expect
			.poll(() => lista.listedIds(), { timeout: 30 * 1000 })
			.toContain(Number(ppc.id));
	});

	test('Filtro por status mostra apenas o status escolhido', async ({
		ppcListPage: lista,
	}) => {
		const status = alvo().status;

		await lista.openTab();
		await lista.applyFilters({ status });

		await expect
			.poll(
				async () => {
					const statuses = await lista.listedStatuses();
					return statuses.length > 0 && statuses.every((s) => s === status);
				},
				{ timeout: 30 * 1000 },
			)
			.toBe(true);
	});

	test('Ordenação por identificador respeita a direção escolhida', async ({
		ppcListPage: lista,
	}) => {
		await lista.openTab();

		await lista.applyFilters({ sort: 'id:ASC' });
		await expect
			.poll(
				async () => {
					const ids = await lista.listedIds();
					return (
						ids.length > 0 &&
						ids.every((id, i) => i === 0 || Number(ids[i - 1]) < id)
					);
				},
				{ timeout: 30 * 1000 },
			)
			.toBe(true);
		const crescente = await lista.listedIds();

		await lista.applyFilters({ sort: 'id:DESC' });
		await expect
			.poll(async () => (await lista.listedIds())[0], { timeout: 30 * 1000 })
			.not.toBe(crescente[0]);
		const decrescente = await lista.listedIds();
		expect(decrescente).toEqual([...decrescente].sort((a, b) => b - a));
	});

	test('Paginação troca a quantidade por página e avança de página', async ({
		ppcListPage: lista,
	}) => {
		await lista.openTab();
		await lista.changePageSize(5);

		await expect
			.poll(async () => (await lista.listedIds()).length, {
				timeout: 30 * 1000,
			})
			.toBe(5);
		const primeiraPagina = await lista.listedIds();

		await lista.goToNextPage();
		await expect
			.poll(async () => (await lista.listedIds())[0], { timeout: 30 * 1000 })
			.not.toBe(primeiraPagina[0]);

		const segundaPagina = await lista.listedIds();
		expect(
			segundaPagina.filter((id) => primeiraPagina.includes(id)),
		).toEqual([]);
	});

	test('Aba Concluídos mostra apenas PPCs concluídos', async ({
		ppcListPage: lista,
	}) => {
		await lista.openTab(PPC_LIST_TAB.CONCLUIDOS);

		// A troca de aba refaz a busca, então a lista da aba anterior ainda fica
		// na tela por alguns instantes.
		await expect
			.poll(async () => [...new Set(await lista.listedStatuses())], {
				timeout: 30 * 1000,
			})
			.toEqual(['CONCLUIDO']);
		expect((await lista.listedIds()).length).toBeGreaterThan(0);

		await lista.openTab(PPC_LIST_TAB.EM_REVISAO);
		await expect
			.poll(() => lista.listedStatuses(), { timeout: 30 * 1000 })
			.not.toContain('CONCLUIDO');
	});
});

import { expect, test } from '../../fixtures';
import { CoordinatorApi } from '../../api/CoordinatorApi';
import { E2E_PPC_CONCLUIDO_ID } from '../../config/env';
import { registrarPPC } from '../../flows/records';
import { PPC_LIST_TAB } from '../../pages/ppc/PpcListPage';

let api: CoordinatorApi;
let ppcId: number | null = null;

test.beforeAll(async () => {
	api = await CoordinatorApi.login();
	ppcId = E2E_PPC_CONCLUIDO_ID
		? Number(E2E_PPC_CONCLUIDO_ID)
		: await api.findLatestByStatus('CONCLUIDO');
});

test.afterAll(async () => {
	await api?.dispose();
});

test.describe.serial('Documentos do PPC em stage', () => {
	test.beforeEach(() => {
		test.skip(
			ppcId === null,
			'Nenhum PPC CONCLUIDO em stage: rode tests/ppc/fluxo-completo.spec.ts antes ou informe E2E_PPC_CONCLUIDO_ID.',
		);
	});

	test('Coordenador baixa o PPC versionado', async ({
		loginPage,
		ppcListPage,
	}) => {
		test.slow();
		const id = ppcId as number;

		await loginPage.loginAsCoordinator();
		const documento = await ppcListPage.downloadVersionedDocument(
			id,
			PPC_LIST_TAB.CONCLUIDOS,
		);

		expect(documento.bytes).toBeGreaterThan(0);
		registrarPPC(
			id,
			`PPC versionado baixado (${documento.filename}, ${documento.bytes} bytes)`,
		);
	});

	test('Coordenador baixa o documento do PPC completo', async ({
		loginPage,
		ppcListPage,
	}) => {
		test.slow();
		const id = ppcId as number;

		await loginPage.loginAsCoordinator();
		const documento = await ppcListPage.downloadPPCCompleto(id);

		expect(documento.bytes).toBeGreaterThan(0);
		registrarPPC(
			id,
			`PPC completo baixado (${documento.filename}, ${documento.bytes} bytes)`,
		);
	});
});

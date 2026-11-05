import { expect, test } from '../../fixtures';
import { CoordinatorApi } from '../../api/CoordinatorApi';
import { CLASSIFICACAO_CONCLUSAO } from '../../data/ppc';
import { criarEPreencherPPC } from '../../flows/ppc.flow';
import { registrarPPC } from '../../flows/records';

let api: CoordinatorApi;
let ppcId: number;

test.beforeAll(async () => {
	api = await CoordinatorApi.login();
});

test.afterAll(async () => {
	await api?.dispose();
});

test.describe.serial('Fluxo completo do PPC em stage', () => {
	test('Coordenador cria o PPC, copia o link e o Infoprodutor preenche e envia', async ({
		page,
	}) => {
		test.slow();
		({ ppcId } = await criarEPreencherPPC(page, api));
	});

	test('Coordenador revisa todos os campos e aprova o PPC', async ({
		loginPage,
		ppcViewPage,
		ppcListPage,
		ppcReviewPage: review,
	}) => {
		test.slow();
		await loginPage.loginAsCoordinator();
		await ppcViewPage.open(ppcId);
		await ppcListPage.openReviewMode(ppcId);

		expect(await review.fillAnhangueraDisciplines()).toBeGreaterThan(0);
		expect(await review.reviewGeneralInfo()).toBeGreaterThan(0);
		expect(await review.reviewSpecialists()).toBeGreaterThan(0);
		expect(
			(await review.reviewInfoproducerDisciplines()).aprovados,
		).toBeGreaterThan(0);
		expect(await api.pendingReviews(ppcId)).toHaveLength(0);

		await review.finishReview();
		expect(await api.getStatus(ppcId)).toBe('APROVADO');
		registrarPPC(ppcId, 'revisão finalizada sem reprovações (APROVADO)');
	});

	test('Coordenador conclui o PPC com as classificações CAPES e OCDE', async ({
		loginPage,
		ppcListPage,
	}) => {
		await loginPage.loginAsCoordinator();
		await ppcListPage.finish(ppcId, CLASSIFICACAO_CONCLUSAO);

		expect(await api.getStatus(ppcId)).toBe('CONCLUIDO');
		registrarPPC(ppcId, 'concluído com CAPES e OCDE (CONCLUIDO)');
	});
});

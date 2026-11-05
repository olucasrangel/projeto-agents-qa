import { expect, test } from '../../fixtures';
import { CoordinatorApi } from '../../api/CoordinatorApi';
import { CLASSIFICACAO_CONCLUSAO } from '../../data/ppc';
import { criarEPreencherPPC } from '../../flows/ppc.flow';
import { registrarPPC } from '../../flows/records';

let api: CoordinatorApi;
let ppcId: number;
let accessLink: string;
let disciplinaReprovada: string;

test.beforeAll(async () => {
	api = await CoordinatorApi.login();
});

test.afterAll(async () => {
	await api?.dispose();
});

test.describe.serial('Revisão do PPC com campo reprovado', () => {
	test('Coordenador cria o PPC, copia o link e o Infoprodutor preenche e envia', async ({
		page,
	}) => {
		test.slow();
		({ ppcId, accessLink } = await criarEPreencherPPC(page, api));
	});

	test('Revisão com um campo reprovado leva o PPC para AGUARDANDO_AJUSTES', async ({
		loginPage,
		ppcViewPage,
		ppcListPage,
		ppcReviewPage: review,
	}) => {
		test.slow();
		await loginPage.loginAsCoordinator();
		await ppcViewPage.open(ppcId);
		await ppcListPage.openReviewMode(ppcId);

		await review.fillAnhangueraDisciplines();
		await review.reviewGeneralInfo();
		await review.reviewSpecialists();
		const { reprovado, reprovadoId } =
			await review.reviewInfoproducerDisciplines(
				'Ajuste solicitado pelo teste E2E',
			);
		expect(reprovado).toBeTruthy();
		expect(reprovadoId).toBeTruthy();
		disciplinaReprovada = reprovadoId as string;
		expect(await api.pendingReviews(ppcId)).toHaveLength(0);

		await review.finishReview();
		expect(await api.getStatus(ppcId)).toBe('AGUARDANDO_AJUSTES');
		registrarPPC(
			ppcId,
			`revisão finalizada com um campo da ${reprovado} reprovado (AGUARDANDO_AJUSTES)`,
		);
	});

	test('Infoprodutor ajusta a disciplina reprovada e reenvia para revisão', async ({
		ppcExternalFormPage: form,
	}) => {
		test.slow();
		await form.openAccessLink(accessLink);
		await form.goToDisciplinesTab();
		await form.adjustRejectedDiscipline(
			disciplinaReprovada,
			`Disciplina ajustada E2E ${Date.now()}`,
		);
		await form.submit();

		expect(await api.getStatus(ppcId)).toBe('EM_REVISAO');
		registrarPPC(ppcId, 'ajustado pelo Infoprodutor e reenviado (EM_REVISAO)');
	});

	test('Coordenador aprova o ajuste, finaliza a revisão e conclui o PPC', async ({
		loginPage,
		ppcListPage,
		ppcReviewPage: review,
	}) => {
		test.slow();
		await loginPage.loginAsCoordinator();
		await ppcListPage.openReviewMode(ppcId);

		await review.reviewGeneralInfo();
		await review.reviewSpecialists();
		await review.reviewInfoproducerDisciplines();
		expect(await api.pendingReviews(ppcId)).toHaveLength(0);

		await review.finishReview();
		expect(await api.getStatus(ppcId)).toBe('APROVADO');
		registrarPPC(ppcId, 'ajuste aprovado na segunda revisão (APROVADO)');

		await ppcListPage.finish(ppcId, CLASSIFICACAO_CONCLUSAO);

		expect(await api.getStatus(ppcId)).toBe('CONCLUIDO');
		registrarPPC(ppcId, 'concluído com CAPES e OCDE (CONCLUIDO)');
	});
});

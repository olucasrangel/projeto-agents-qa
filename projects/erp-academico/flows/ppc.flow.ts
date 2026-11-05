import { expect, Page } from '@playwright/test';
import { CoordinatorApi } from '../api/CoordinatorApi';
import { E2E_KNOWLEDGE_AREA, infoproducerEmail } from '../config/env';
import {
	ANHANGUERA_DISCIPLINE_COUNT,
	INFOPRODUCER_DISCIPLINE_COUNT,
} from '../data/ppc';
import { DashboardPage } from '../pages/DashboardPage';
import { LoginPage } from '../pages/LoginPage';
import { PpcExternalFormPage } from '../pages/ppc/PpcExternalFormPage';
import { PpcListPage } from '../pages/ppc/PpcListPage';
import { registrarPPC } from './records';

/**
 * Cria um PPC pela tela e devolve o identificador. Usado pelos cenários que só
 * precisam de um PPC em AGUARDANDO_RETORNO, sem o preenchimento completo.
 */
export async function criarPPC(
	page: Page,
	api: CoordinatorApi,
): Promise<number> {
	const email = infoproducerEmail(Date.now());

	await new LoginPage(page).loginAsCoordinator();
	await new DashboardPage(page).openPPC();
	await new PpcListPage(page).createPPC(E2E_KNOWLEDGE_AREA, email);

	const ppcId = await api.findPPCByInfoproducerEmail(email);
	expect(await api.getStatus(ppcId)).toBe('AGUARDANDO_RETORNO');

	return ppcId;
}

export interface PPCEmRevisao {
	ppcId: number;
	accessLink: string;
	specialistName: string;
}

/**
 * Executa o trecho comum aos cenários de revisão: o Coordenador cria o PPC e
 * copia o link, e o Infoprodutor preenche todas as abas e envia para revisão.
 */
export async function criarEPreencherPPC(
	page: Page,
	api: CoordinatorApi,
): Promise<PPCEmRevisao> {
	const stamp = Date.now();
	const email = infoproducerEmail(stamp);
	const courseTitle = `Curso E2E PPC ${stamp}`;
	const specialistName = `Especialista E2E ${stamp}`;
	const startDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
		.toISOString()
		.slice(0, 10);

	const list = new PpcListPage(page);
	const form = new PpcExternalFormPage(page);

	await new LoginPage(page).loginAsCoordinator();
	await new DashboardPage(page).openPPC();

	const created = await list.createPPC(E2E_KNOWLEDGE_AREA, email);

	const ppcId = await api.findPPCByInfoproducerEmail(email);
	expect(await api.getStatus(ppcId)).toBe('AGUARDANDO_RETORNO');

	// O link usado pelo Infoprodutor vem da ação Copiar Link do menu de ações.
	const accessLink = await list.copyAccessLink(ppcId);
	expect(accessLink).toBe(created.accessLink);

	await form.openAccessLink(accessLink);
	await form.fillGeneralInfo(courseTitle);
	await form.addSpecialist(specialistName);
	await form.goToWorkload();
	await form.fillWorkload();
	await form.assertInitialDisciplines({
		anhanguera: ANHANGUERA_DISCIPLINE_COUNT,
		infoproducer: INFOPRODUCER_DISCIPLINE_COUNT,
	});
	await form.applyStartDate(startDate);
	await form.linkAnhangueraDisciplines();
	await form.fillInfoproducerDisciplines(specialistName);
	await form.submit();

	expect(await api.getStatus(ppcId)).toBe('EM_REVISAO');
	registrarPPC(ppcId, 'criado, preenchido e enviado (EM_REVISAO)');

	return { ppcId, accessLink, specialistName };
}

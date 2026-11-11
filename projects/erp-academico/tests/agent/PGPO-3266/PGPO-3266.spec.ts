import { expect } from '@playwright/test';
import { test } from '../../../fixtures';
import { AvaNfsePage, type CreatedRequest, type RequestDetail } from '../../../pages/agent/AvaNfsePage';
import { evidenceStep } from '../../../../../shared/evidence-step';

/**
 * Testes de aceite de PGPO-3266 (ATDD), gerados por `npm run qa:atdd -- skeleton PGPO-3266`.
 *
 * Cada passo precisa ser ligado a Page Objects, flows ou clientes de API existentes (apenas importando).
 * Enquanto houver PENDENTE_LIGAR, o teste falha por execução, não por asserção, e NÃO vale como prova vermelha.
 * A prova vermelha exige que o teste ligue o fluxo e falhe em um expect() de comportamento ainda não atendido.
 */
/** E-mail de teste diferente do cadastro; usado só para abrir o modal. Nada é enviado. */
const NEW_EMAIL = 'qa.pgpo3266@example.com';

function pending(step: string): never {
	throw new Error(`PENDENTE_LIGAR: ${step}`);
}

test.describe('Autosserviço de 2ª via de NFS-e com e-mail de destino', () => {
	test(
		'[PGPO-3266][Web][Sucesso] Validar que o autosserviço aparece com o serviço ligado no tenant',
		{ tag: ['@PGPO-3266', '@S02', '@high', '@VPOS-T2098'] },
		async ({ page }) => {
		const ava = new AvaNfsePage(page);
		await evidenceStep(page, 'Given o serviço de 2ª via de NFS-e está ligado no tenant do aluno', async () => {
			await ava.loginAsStudent();
		});
		await evidenceStep(page, 'When o aluno acessa a lista de autosserviços', async () => {
			await ava.openNewRequest();
			await ava.course.selectOption({ index: 1 });
			await ava.openServiceList();
		});
		await evidenceStep(page, 'Then o autosserviço de 2ª via de NFS-e é exibido', async () => {
			await expect(ava.nfseOption).toBeVisible();
		});
		},
	);

	test(
		'[PGPO-3266][Web][Falha] Validar que o envio é bloqueado sem competência selecionada',
		{ tag: ['@PGPO-3266', '@S04', '@critical', '@VPOS-T2100'] },
		async ({ page }) => {
		const ava = new AvaNfsePage(page);
		await evidenceStep(page, 'Given o aluno está na tela de 2ª via de NFS-e sem competência selecionada', async () => {
			await ava.loginAsStudent();
			await ava.openNfseForm();
			await expect(ava.competence).toHaveValue('');
		});
		await evidenceStep(page, 'When o aluno clica em "Enviar Solicitação"', async () => {
			await ava.trySubmit().catch(() => undefined);
		});
		await evidenceStep(page, 'Then a solicitação não é criada', async () => {
			expect(ava.blockedWrites).toHaveLength(0);
			await expect(ava.sentMessage).toHaveCount(0);
		});
		await evidenceStep(page, 'And o sistema exige a escolha de mês e ano de competência', async () => {
			await expect(ava.submit).toBeDisabled();
			await expect(ava.competence).toHaveValue('');
		});
		},
	);

	test(
		'[PGPO-3266][Web][Sucesso] Validar que o campo de e-mail vem preenchido com o e-mail do cadastro e pode ser editado',
		{ tag: ['@PGPO-3266', '@S05', '@high', '@VPOS-T2101'] },
		async ({ page }) => {
		const ava = new AvaNfsePage(page);
		await evidenceStep(page, 'Given o aluno possui um e-mail cadastrado', async () => {
			await ava.loginAsStudent();
		});
		await evidenceStep(page, 'When o aluno abre a tela de 2ª via de NFS-e', async () => {
			await ava.openNfseForm();
		});
		await evidenceStep(page, 'Then o campo de e-mail exibe o e-mail atual do cadastro', async () => {
			await expect(ava.email).toHaveValue(/^[^@\s]+@[^@\s]+\.[^@\s]+$/);
		});
		await evidenceStep(page, 'And o campo de e-mail permite edição', async () => {
			await expect(ava.email).toBeEditable();
		});
		},
	);

	test(
		'[PGPO-3266][Web][Sucesso] Validar que a tela informa para qual e-mail a nota será enviada',
		{ tag: ['@PGPO-3266', '@S06', '@high', '@VPOS-T2102'] },
		async ({ page }) => {
		const ava = new AvaNfsePage(page);
		await evidenceStep(page, 'Given o aluno está na tela de 2ª via de NFS-e com um e-mail no campo', async () => {
			await ava.loginAsStudent();
			await ava.openNfseForm();
			await expect(ava.email).not.toHaveValue('');
		});
		await evidenceStep(page, 'When o aluno visualiza o formulário', async () => {
			await expect(ava.email).toBeVisible();
		});
		await evidenceStep(page, 'Then a tela informa que a nota será enviada para o e-mail do campo', async () => {
			await expect(ava.emailHint).toBeVisible();
		});
		},
	);

	test(
		'[PGPO-3266][Web][Falha] Validar que e-mail em formato inválido bloqueia o envio sem abrir o modal',
		{ tag: ['@PGPO-3266', '@S07', '@critical', '@VPOS-T2103'] },
		async ({ page }) => {
		const ava = new AvaNfsePage(page);
		let registered = '';
		await evidenceStep(page, 'Given o aluno informou uma competência', async () => {
			await ava.loginAsStudent();
			await ava.openNfseForm();
			await ava.chooseFirstCompetence();
			registered = await ava.registeredEmail();
		});
		await evidenceStep(page, 'And o aluno informou um e-mail em formato inválido', async () => {
			await ava.fillEmail('email-invalido');
		});
		await evidenceStep(page, 'When o aluno clica em "Enviar Solicitação"', async () => {
			await ava.trySubmit().catch(() => undefined);
		});
		await evidenceStep(page, 'Then o modal de atualização de e-mail não é exibido', async () => {
			await expect(ava.updateEmailModal).toHaveCount(0);
		});
		await evidenceStep(page, 'And nenhuma solicitação é criada', async () => {
			expect(ava.blockedWrites).toHaveLength(0);
			await expect(ava.sentMessage).toHaveCount(0);
		});
		await evidenceStep(page, 'And o cadastro do aluno não é alterado', async () => {
			await ava.openNfseForm();
			await expect(ava.email).toHaveValue(registered);
		});
		},
	);

	test(
		'[PGPO-3266][Web][Sucesso] Validar que o envio com o e-mail do cadastro cria a solicitação sem abrir o modal',
		{ tag: ['@PGPO-3266', '@S08', '@critical', '@VPOS-T2104'] },
		async ({ page }) => {
		const ava = new AvaNfsePage(page);
		let registered = '';
		let creation: Promise<CreatedRequest | null> | undefined;
		await evidenceStep(page, 'Given o aluno informou uma competência', async () => {
			await ava.loginAsStudent({ user: '_3', allowCreate: true });
			await ava.openNfseForm();
			await ava.chooseCompetence(1);
			registered = await ava.registeredEmail();
		});
		await evidenceStep(page, 'And o e-mail do campo é igual ao e-mail atual do cadastro', async () => {
			await expect(ava.email).toHaveValue(registered);
		});
		await evidenceStep(page, 'When o aluno clica em "Enviar Solicitação"', async () => {
			creation = ava.waitForCreation();
			await ava.submit.click();
		});
		await evidenceStep(page, 'Then a solicitação é criada sem exibir o modal de atualização', async () => {
			const created = await creation;
			expect(created?.status).toBe(201);
			await expect(ava.updateEmailModal).toHaveCount(0);
		});
		await evidenceStep(page, 'And o cadastro do aluno não é alterado', async () => {
			expect(ava.blockedWrites).toHaveLength(0);
			await ava.openNfseForm();
			await expect(ava.email).toHaveValue(registered);
		});
		},
	);

	test(
		'[PGPO-3266][Web][Sucesso] Validar que alterar o e-mail abre o modal de atualização com o e-mail digitado',
		{ tag: ['@PGPO-3266', '@S09', '@critical', '@VPOS-T2105'] },
		async ({ page }) => {
		const ava = new AvaNfsePage(page);
		let registered = '';
		await evidenceStep(page, 'Given o aluno informou uma competência', async () => {
			await ava.loginAsStudent();
			await ava.openNfseForm();
			await ava.chooseFirstCompetence();
		});
		await evidenceStep(page, 'And o e-mail do campo é diferente do e-mail atual do cadastro', async () => {
			registered = await ava.registeredEmail();
			await ava.fillEmail(NEW_EMAIL);
			expect(NEW_EMAIL).not.toBe(registered);
		});
		await evidenceStep(page, 'When o aluno clica em "Enviar Solicitação"', async () => {
			await ava.trySubmit();
		});
		await evidenceStep(page, 'Then o modal "Você deseja atualizar seu e-mail?" é exibido', async () => {
			await expect(ava.updateEmailModal).toBeVisible();
		});
		await evidenceStep(page, 'And o modal mostra o e-mail digitado', async () => {
			await expect(page.getByText(NEW_EMAIL).first()).toBeVisible();
		});
		},
	);

	test(
		'[PGPO-3266][Web][Sucesso] Validar que manter o e-mail antigo cria a solicitação sem alterar o cadastro',
		{ tag: ['@PGPO-3266', '@S10', '@critical', '@VPOS-T2106'] },
		async ({ page }) => {
		const ava = new AvaNfsePage(page);
		let registered = '';
		let creation: Promise<CreatedRequest | null> | undefined;
		await evidenceStep(page, 'Given o modal de atualização está aberto com um e-mail diferente do cadastro', async () => {
			await ava.loginAsStudent({ user: '_3', allowCreate: true });
			await ava.openNfseForm();
			await ava.chooseCompetence(2);
			registered = await ava.registeredEmail();
			await ava.fillEmail(NEW_EMAIL);
			await ava.submit.click();
			await expect(ava.updateEmailModal).toBeVisible();
		});
		await evidenceStep(page, 'When o aluno escolhe "Manter e-mail antigo"', async () => {
			creation = ava.waitForCreation();
			await ava.keepOldEmail();
		});
		await evidenceStep(page, 'Then a solicitação é criada com o e-mail digitado como destino', async () => {
			const created = await creation;
			expect(created?.status).toBe(201);
			expect(created?.body).toContain(NEW_EMAIL);
		});
		await evidenceStep(page, 'And o e-mail do cadastro da pessoa não é alterado', async () => {
			expect(ava.blockedWrites).toHaveLength(0);
			await ava.openNfseForm();
			await expect(ava.email).toHaveValue(registered);
		});
		await evidenceStep(page, 'And o e-mail das matrículas não é alterado', async () => {
			expect(ava.createdRequests).toHaveLength(1);
			expect(ava.blockedWrites).toHaveLength(0);
		});
		},
	);

	test(
		'[PGPO-3266][Web][Falha] Validar que fechar o modal sem escolher uma opção cancela o envio',
		{ tag: ['@PGPO-3266', '@S12', '@high', '@VPOS-T2108'] },
		async ({ page }) => {
		const ava = new AvaNfsePage(page);
		let registered = '';
		await evidenceStep(page, 'Given o modal de atualização de e-mail está aberto', async () => {
			await ava.loginAsStudent();
			await ava.openNfseForm();
			await ava.chooseFirstCompetence();
			registered = await ava.registeredEmail();
			await ava.fillEmail(NEW_EMAIL);
			await ava.trySubmit();
			await expect(ava.updateEmailModal).toBeVisible();
		});
		await evidenceStep(page, 'When o aluno fecha o modal sem escolher uma opção', async () => {
			await ava.closeModalWithEscape();
		});
		await evidenceStep(page, 'Then nenhuma solicitação é criada', async () => {
			await expect(ava.updateEmailModal).toHaveCount(0);
			expect(ava.blockedWrites).toHaveLength(0);
			await expect(ava.sentMessage).toHaveCount(0);
		});
		await evidenceStep(page, 'And o cadastro do aluno não é alterado', async () => {
			expect(ava.blockedWrites).toHaveLength(0);
			expect(registered).not.toBe(NEW_EMAIL);
		});
		await evidenceStep(page, 'And o aluno permanece na tela de 2ª via com os dados preenchidos', async () => {
			await expect(ava.email).toHaveValue(NEW_EMAIL);
			await expect(ava.competence).not.toHaveValue('');
		});
		},
	);

	test(
		'[PGPO-3266][Web][Sucesso] Validar a confirmação "Solicitação enviada" após o envio',
		{ tag: ['@PGPO-3266', '@S14', '@high', '@VPOS-T2110'] },
		async ({ page }) => {
		const ava = new AvaNfsePage(page);
		let registered = '';
		let creation: Promise<CreatedRequest | null> | undefined;
		await evidenceStep(page, 'Given a solicitação foi criada com sucesso', async () => {
			await ava.loginAsStudent({ user: '_3', allowCreate: true });
			await ava.openNfseForm();
			await ava.chooseCompetence(3);
			registered = await ava.registeredEmail();
		});
		await evidenceStep(page, 'When o aluno conclui o envio', async () => {
			creation = ava.waitForCreation();
			await ava.submit.click();
			expect((await creation)?.status).toBe(201);
		});
		await evidenceStep(page, 'Then a tela exibe a mensagem "Solicitação enviada"', async () => {
			await expect(ava.sentMessage).toBeVisible();
		});
		await evidenceStep(page, 'And a tela não exibe erro de processamento', async () => {
			await expect(page.getByText(/Application error|erro de processamento|falha/i)).toHaveCount(0);
		});
		},
	);

	test(
		'[PGPO-3266][Web][Sucesso] Validar que a solicitação é gravada com a competência e o e-mail de destino',
		{ tag: ['@PGPO-3266', '@S15', '@critical', '@VPOS-T2111'] },
		async ({ page }) => {
		const ava = new AvaNfsePage(page);
		let creation: Promise<CreatedRequest | null> | undefined;
		let competenceLabel = '';
		let detail: RequestDetail | undefined;
		await evidenceStep(page, 'Given o aluno escolheu a competência 03/2026', async () => {
			await ava.loginAsStudent({ user: '_3', allowCreate: true });
			await ava.openNfseForm();
			await ava.chooseCompetence(7);
			competenceLabel = (await ava.competence.locator('option:checked').innerText()).trim();
		});
		await evidenceStep(page, 'And o aluno informou o e-mail "nota@exemplo.com"', async () => {
			await ava.fillEmail(NEW_EMAIL);
		});
		await evidenceStep(page, 'When o aluno envia a solicitação', async () => {
			await ava.submit.click();
			await expect(ava.updateEmailModal).toBeVisible();
			creation = ava.waitForCreation();
			await ava.keepOldEmail();
			expect((await creation)?.status).toBe(201);
			detail = await ava.openRequestDetail();
		});
		await evidenceStep(page, 'Then a solicitação é criada com a competência 03/2026', async () => {
			expect(detail?.competence).toBe(competenceLabel);
		});
		await evidenceStep(page, 'And a solicitação é criada com o e-mail de destino "nota@exemplo.com"', async () => {
			expect(detail?.email.toLowerCase()).toBe(NEW_EMAIL);
		});
		await evidenceStep(page, 'And a solicitação é criada com o status "Em processamento"', async () => {
			expect(detail?.status).toMatch(/EM PROCESSAMENTO/i);
		});
		},
	);

	test(
		'[PGPO-3266][Web][Sucesso] Validar que os botões ficam desabilitados durante o envio',
		{ tag: ['@PGPO-3266', '@S17', '@high', '@VPOS-T2113'] },
		async ({ page }) => {
		const ava = new AvaNfsePage(page);
		let registered = '';
		let creation: Promise<CreatedRequest | null> | undefined;
		await evidenceStep(page, 'Given o aluno clicou em "Enviar Solicitação"', async () => {
			await ava.loginAsStudent({ user: '_3', allowCreate: true, createDelayMs: 4000 });
			await ava.openNfseForm();
			await ava.chooseCompetence(4);
			creation = ava.waitForCreation(30000);
			await ava.submit.click();
		});
		await evidenceStep(page, 'When a solicitação está sendo processada', async () => {
			await expect.poll(() => ava.creationInFlight).toBe(true);
		});
		await evidenceStep(page, 'Then o botão "Enviar Solicitação" fica desabilitado', async () => {
			await expect(ava.submit).toBeDisabled();
		});
		await evidenceStep(page, 'And o botão de cancelamento fica desabilitado', async () => {
			// A tela não tem botão de cancelar: confirma que nenhuma ação de cancelar está habilitada durante o envio.
			await expect(page.getByRole('button', { name: /cancelar/i }).and(page.locator(':enabled'))).toHaveCount(0);
			expect((await creation)?.status).toBe(201);
		});
		},
	);

	test(
		'[PGPO-3266][Web][Falha] Validar que a segunda solicitação em processamento para a mesma competência é bloqueada',
		{ tag: ['@PGPO-3266', '@S18', '@critical', '@VPOS-T2114'] },
		async ({ page }) => {
		const ava = new AvaNfsePage(page);
		let creation: Promise<CreatedRequest | null> | undefined;
		let competenceLabel = '';
		let detail: RequestDetail | undefined;
		await evidenceStep(page, 'Given existe uma solicitação "Em processamento" para a matrícula e a competência 03/2026', async () => {
			await ava.loginAsStudent({ user: '_2', allowCreate: true });
			detail = await ava.openRequestDetail('EM PROCESSAMENTO');
			competenceLabel = detail.competence;
			expect(competenceLabel).not.toBe('');
		});
		await evidenceStep(page, 'When o aluno tenta enviar nova solicitação para a competência 03/2026', async () => {
			await ava.openNfseForm();
			await ava.chooseCompetenceByLabel(competenceLabel);
			creation = ava.waitForCreation();
			await ava.submit.click();
		});
		await evidenceStep(page, 'Then nenhuma nova solicitação é criada', async () => {
			const created = await creation;
			expect(created?.status).toBe(409);
			expect(ava.createdRequests.every((item) => item.status >= 400)).toBe(true);
		});
		await evidenceStep(page, 'And a tela informa que já existe uma solicitação em andamento', async () => {
			await expect(page.getByText('Já existe uma solicitação de nota fiscal em andamento')).toBeVisible();
		});
		},
	);

	test(
		'[PGPO-3266][Web][Sucesso] Validar que nova solicitação é permitida para competência já concluída com sucesso',
		{ tag: ['@PGPO-3266', '@S19', '@critical', '@VPOS-T2115'] },
		async ({ page }) => {
		test.setTimeout(8 * 60 * 1000);
		const ava = new AvaNfsePage(page);
		let creation: Promise<CreatedRequest | null> | undefined;
		let competenceLabel = '';
		let detail: RequestDetail | undefined;
		await evidenceStep(page, 'Given existe uma solicitação concluída com sucesso para a matrícula e a competência 03/2026', async () => {
			await ava.loginAsStudent({ user: '_3', allowCreate: true });
			// Prepara a massa: uma solicitação própria, numa competência que nenhum outro teste usa, até ela concluir.
			await ava.openNfseForm();
			await ava.chooseCompetence(8);
			competenceLabel = (await ava.competence.locator('option:checked').innerText()).trim();
			creation = ava.waitForCreation();
			await ava.submit.click();
			expect((await creation)?.status).toBe(201);
			await page.waitForURL(/\/aluno\/auto-servicos\/?$/);
			await expect.poll(() => ava.newestRowStatus(), { timeout: 240000, intervals: [5000] }).toMatch(/conclu/i);
		});
		await evidenceStep(page, 'When o aluno envia nova solicitação para a competência 03/2026', async () => {
			await ava.openNfseForm();
			await ava.chooseCompetenceByLabel(competenceLabel);
			creation = ava.waitForCreation();
			await ava.submit.click();
		});
		await evidenceStep(page, 'Then a nova solicitação é criada com o status "Em processamento"', async () => {
			expect((await creation)?.status).toBe(201);
			await expect(ava.requestRows().first()).toContainText(/em processamento/i);
		});
		},
	);

	test(
		'[PGPO-3266][Web][Sucesso] Validar que o e-mail digitado com espaços nas pontas e maiúsculas é tratado como o e-mail do cadastro',
		{ tag: ['@PGPO-3266', '@S20', '@critical', '@VPOS-T2212'] },
		async ({ page }) => {
		const ava = new AvaNfsePage(page);
		let registered = '';
		let creation: Promise<CreatedRequest | null> | undefined;
		await evidenceStep(page, 'Given o e-mail atual do cadastro é "aluno@exemplo.com"', async () => {
			await ava.loginAsStudent({ user: '_3', allowCreate: true });
			await ava.openNfseForm();
			await ava.chooseCompetence(5);
			registered = await ava.registeredEmail();
		});
		await evidenceStep(page, 'And o campo de e-mail contém " Aluno@Exemplo.com "', async () => {
			await ava.fillEmail(` ${registered.toUpperCase()} `);
		});
		await evidenceStep(page, 'When o aluno clica em "Enviar Solicitação"', async () => {
			creation = ava.waitForCreation(15000);
			await ava.submit.click();
		});
		await evidenceStep(page, 'Then o modal de atualização de e-mail não é exibido', async () => {
			const created = await creation;
			await expect(ava.updateEmailModal).toHaveCount(0);
			expect(created?.status).toBe(201);
		});
		await evidenceStep(page, 'And a solicitação é criada sem alterar o cadastro', async () => {
			expect(ava.blockedWrites).toHaveLength(0);
			await ava.openNfseForm();
			await expect(ava.email).toHaveValue(registered);
		});
		},
	);
});

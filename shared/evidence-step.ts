import { test, type Page } from '@playwright/test';
import { EVIDENCE_CAPTURE_ERROR, STEP_EVIDENCE_PREFIX } from './evidence-reporter';

/**
 * Executa um passo do cenário e tira um print ao final dele, que vai para PASS/
 * se o passo passou ou para FAIL/ se lançou erro. O erro original é relançado,
 * então o passo continua falhando do jeito que falharia sem o helper.
 *
 * Só grava print para testes com tag @CARD e @VPOS-Txxx, porque o reporter
 * descarta os demais. Uso:
 *
 *   await evidenceStep(page, 'Abre a tela de login', async () => {
 *     await page.goto('/login');
 *   });
 */
export async function evidenceStep<T>(
	page: Page,
	title: string,
	body: () => Promise<T>,
): Promise<T> {
	return test.step(title, async () => {
		let outcome: 'PASS' | 'FAIL' = 'PASS';
		try {
			return await body();
		} catch (error) {
			outcome = 'FAIL';
			throw error;
		} finally {
			await captureStep(page, outcome, title);
		}
	});
}

async function captureStep(page: Page, outcome: 'PASS' | 'FAIL', title: string): Promise<void> {
	const testInfo = test.info();
	if (page.isClosed()) {
		testInfo.annotations.push({
			type: EVIDENCE_CAPTURE_ERROR,
			description: `página fechada antes do print do passo "${title}"`,
		});
		return;
	}
	try {
		const sensitiveFields = page.locator(
			'input[type="email"], input[type="password"], [data-evidence-mask="true"]',
		);
		const screenshot = await page.screenshot({
			animations: 'disabled',
			caret: 'hide',
			mask: [sensitiveFields],
		});
		await testInfo.attach(`${STEP_EVIDENCE_PREFIX}${outcome}|${title}`, {
			body: screenshot,
			contentType: 'image/png',
		});
	} catch (error) {
		testInfo.annotations.push({
			type: EVIDENCE_CAPTURE_ERROR,
			description:
				error instanceof Error ? error.message : 'erro desconhecido na captura do passo',
		});
	}
}

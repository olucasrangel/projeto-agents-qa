import { test as base } from '@playwright/test';
import {
	EVIDENCE_CAPTURE_ERROR,
	FINAL_SCENARIO_SCREENSHOT,
} from '../../../shared/evidence-reporter';
import { DashboardPage } from '../pages/DashboardPage';
import { LoginPage } from '../pages/LoginPage';
import { PpcAiAssistPage } from '../pages/ppc/PpcAiAssistPage';
import { PpcExternalAccessPage } from '../pages/ppc/PpcExternalAccessPage';
import { PpcExternalFormPage } from '../pages/ppc/PpcExternalFormPage';
import { PpcListPage } from '../pages/ppc/PpcListPage';
import { PpcReviewPage } from '../pages/ppc/PpcReviewPage';
import { PpcViewPage } from '../pages/ppc/PpcViewPage';
import { QuestionBankDetailPage } from '../pages/question-bank/QuestionBankDetailPage';
import { QuestionBankListPage } from '../pages/question-bank/QuestionBankListPage';

/** Page Objects do ERP Acadêmico injetados em cada teste. */
export interface ErpAcademicoPages {
	loginPage: LoginPage;
	dashboardPage: DashboardPage;
	ppcListPage: PpcListPage;
	ppcViewPage: PpcViewPage;
	ppcReviewPage: PpcReviewPage;
	ppcExternalAccessPage: PpcExternalAccessPage;
	ppcExternalFormPage: PpcExternalFormPage;
	ppcAiAssistPage: PpcAiAssistPage;
	questionBankListPage: QuestionBankListPage;
	questionBankDetailPage: QuestionBankDetailPage;
}

interface ScenarioEvidenceFixture {
	_scenarioEvidence: void;
}

export const test = base.extend<ErpAcademicoPages & ScenarioEvidenceFixture>({
	_scenarioEvidence: [
		async ({ page }, use, testInfo) => {
			await use();
			if (!testInfo.tags.some((tag) => /^@[A-Z][A-Z0-9]+-\d+$/.test(tag))) return;
			if (testInfo.status === 'skipped') return;
			if (page.isClosed()) {
				testInfo.annotations.push({
					type: EVIDENCE_CAPTURE_ERROR,
					description: 'página fechada antes da captura final',
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
				await testInfo.attach(FINAL_SCENARIO_SCREENSHOT, {
					body: screenshot,
					contentType: 'image/png',
				});
			} catch (error) {
				testInfo.annotations.push({
					type: EVIDENCE_CAPTURE_ERROR,
					description:
						error instanceof Error ? error.message : 'erro desconhecido na captura',
				});
			}
		},
		{ auto: true },
	],
	loginPage: async ({ page }, use) => use(new LoginPage(page)),
	dashboardPage: async ({ page }, use) => use(new DashboardPage(page)),
	ppcListPage: async ({ page }, use) => use(new PpcListPage(page)),
	ppcViewPage: async ({ page }, use) => use(new PpcViewPage(page)),
	ppcReviewPage: async ({ page }, use) => use(new PpcReviewPage(page)),
	ppcExternalAccessPage: async ({ page }, use) =>
		use(new PpcExternalAccessPage(page)),
	ppcExternalFormPage: async ({ page }, use) =>
		use(new PpcExternalFormPage(page)),
	ppcAiAssistPage: async ({ page }, use) => use(new PpcAiAssistPage(page)),
	questionBankListPage: async ({ page }, use) =>
		use(new QuestionBankListPage(page)),
	questionBankDetailPage: async ({ page }, use) =>
		use(new QuestionBankDetailPage(page)),
});

export { expect } from '@playwright/test';

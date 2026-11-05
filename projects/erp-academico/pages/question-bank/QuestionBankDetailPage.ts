import { expect, Page } from '@playwright/test';
import { BasePage } from '../../../../shared/pages/BasePage';
import { E2E_LOCALE, questionBankUrl } from '../../config/env';
import { QuestionBankDetail } from '../../api/QuestionBankApi';

/** Detalhe do banco de questões: questões geradas, edição e exclusão. */
export class QuestionBankDetailPage extends BasePage {
	readonly container = this.testId('page-question-detail');
	readonly saveButton = this.testId('question-detail-save');
	readonly linkedCollection = this.testId('question-detail-linked-collection');
	readonly deleteQuestionModal = this.testId('delete-question-modal');

	constructor(page: Page) {
		super(page);
	}

	statement(questionId: string) {
		return this.testId(`question-${questionId}-statement`);
	}

	explanation(questionId: string) {
		return this.testId(`question-${questionId}-explanation`);
	}

	alternative(questionId: string, alternativeId: string) {
		return this.testId(`question-${questionId}-alternative-${alternativeId}`);
	}

	/**
	 * Abre o detalhe pela URL. A listagem só oferece as ações Editar e Visualizar
	 * para bancos em COMPLETO, então é assim que se olha um banco já FINALIZADO.
	 */
	async gotoById(id: number): Promise<void> {
		await this.page.goto(questionBankUrl(`/${id}`));
		await expect(this.container).toBeVisible({ timeout: 30 * 1000 });
	}

	/** Confere na tela o que a API devolveu para cada questão. */
	async expectQuestions(detail: QuestionBankDetail): Promise<void> {
		for (const question of detail.questions) {
			await expect(this.statement(question.id)).toHaveValue(question.statement);
			await expect(this.explanation(question.id)).toHaveValue(
				question.explanation,
			);

			for (const alternative of question.alternatives) {
				await expect(
					this.alternative(question.id, alternative.id),
				).toHaveValue(alternative.text);
			}

			const correct = question.alternatives.filter(
				(alternative) => alternative.isCorrect,
			);
			expect(
				correct,
				`A questão ${question.id} precisa ter exatamente uma alternativa correta`,
			).toHaveLength(1);
		}
	}

	/** Edita o enunciado da questão e salva pela tela. */
	async editStatement(questionId: string, statement: string): Promise<void> {
		await this.statement(questionId).fill(statement);
		await this.saveButton.click();
		await this.page.waitForURL(`**/${E2E_LOCALE}/question-bank`, {
			timeout: 60 * 1000,
		});
	}

	/** Exclui uma questão, com a confirmação do modal. */
	async deleteQuestion(questionId: string): Promise<void> {
		await this.testId(`question-${questionId}-delete`).click();
		await expect(this.deleteQuestionModal).toBeVisible();
		await this.testId('delete-question-modal-confirm').click();
		await expect(this.deleteQuestionModal).toBeHidden();
		await expect(this.statement(questionId)).toBeHidden();
	}
}

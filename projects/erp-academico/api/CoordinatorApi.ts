import { APIRequestContext } from '@playwright/test';
import { apiUrl as url, authenticateAsCoordinator } from './auth';

export interface PPCListItem {
	id: number;
	ppcName: string;
	status: string;
}

export interface PPCReviewItem {
	id: string;
	section: string;
	field: string;
	reviewStatus: string;
}

export interface PPCDisciplineItem {
	id: number;
	order: string;
	type: string;
	status: string;
}

interface PPCDetails {
	status: string;
	infoprodutorEmail: string;
	reviews: PPCReviewItem[];
	disciplines: PPCDisciplineItem[];
}

/**
 * Cliente da API do service-erp-academic autenticado como Coordenador.
 *
 * A interface do Coordenador chama a API por server actions do Next, então o
 * navegador não fala direto com o backend. O cliente abaixo é usado para os
 * pontos do fluxo que ainda não existem na interface (finalizar a revisão) e
 * para conferir o status do PPC entre as etapas.
 */
export class CoordinatorApi {
	private constructor(
		private readonly context: APIRequestContext,
		private readonly token: string,
	) {}

	static async login(): Promise<CoordinatorApi> {
		const { context, token } = await authenticateAsCoordinator();
		return new CoordinatorApi(context, token);
	}

	private get headers(): Record<string, string> {
		return { Authorization: `Bearer ${this.token}` };
	}

	async dispose(): Promise<void> {
		await this.context.dispose();
	}

	async listPPCs(pageSize = 20): Promise<PPCListItem[]> {
		const response = await this.context.get(url('/ppc'), {
			headers: this.headers,
			params: { page: 1, pageSize, sortBy: 'id', sortOrder: 'DESC' },
		});
		if (!response.ok()) {
			throw new Error(
				`Falha ao listar PPCs (${response.status()}): ${await response.text()}`,
			);
		}
		const body = (await response.json()) as { data: PPCListItem[] };
		return body.data;
	}

	async getDetails(ppcId: number): Promise<PPCDetails> {
		const response = await this.context.get(url(`/ppc/${ppcId}`), {
			headers: this.headers,
		});
		if (!response.ok()) {
			throw new Error(
				`Falha ao buscar detalhes do PPC ${ppcId} (${response.status()}): ${await response.text()}`,
			);
		}
		return (await response.json()) as PPCDetails;
	}

	async getStatus(ppcId: number): Promise<string> {
		return (await this.getDetails(ppcId)).status;
	}

	/** Localiza o PPC recém-criado pelo e-mail único do Infoprodutor. */
	async findPPCByInfoproducerEmail(email: string): Promise<number> {
		const items = await this.listPPCs();
		for (const item of items) {
			const details = await this.getDetails(item.id);
			if (details.infoprodutorEmail?.toLowerCase() === email.toLowerCase()) {
				return item.id;
			}
		}
		throw new Error(`Nenhum PPC encontrado para o e-mail ${email}`);
	}

	/** PPC mais recente no status informado, ou null quando não existe. */
	async findLatestByStatus(
		status: string,
		pageSize = 50,
	): Promise<number | null> {
		const items = await this.listPPCs(pageSize);
		return items.find((item) => item.status === status)?.id ?? null;
	}

	/** Revisões que ainda não foram aprovadas nem reprovadas pelo Coordenador. */
	async pendingReviews(ppcId: number): Promise<PPCReviewItem[]> {
		const { reviews } = await this.getDetails(ppcId);
		return reviews.filter(
			(review) =>
				review.reviewStatus !== 'APROVADO' &&
				review.reviewStatus !== 'REPROVADO',
		);
	}
}

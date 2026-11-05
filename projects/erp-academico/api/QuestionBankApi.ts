import { APIRequestContext } from '@playwright/test';
import { apiUrl, authenticateAsCoordinator } from './auth';
import { E2E_QB_EXPORT_TIMEOUT_MS, E2E_QB_TIMEOUT_MS } from '../config/env';

/** Estados do registro de geração observados no frontend em stage. */
export const QB_STATUS = {
	aguardando: 'EM_PROCESSAMENTO',
	processando: 'PROCESSANDO',
	pronta: 'COMPLETO',
	erro: 'FALHOU',
	finalizada: 'FINALIZADO',
} as const;

/** Estados em que a geração ainda não terminou. */
export const QB_PENDING_STATUS: string[] = [
	QB_STATUS.aguardando,
	QB_STATUS.processando,
];

export interface QuestionBankListItem {
	id: number;
	discipline: string;
	course: string;
	status: string;
	createdAt: string;
}

export interface QuestionAlternative {
	id: string;
	text: string;
	isCorrect: boolean;
}

export interface GeneratedQuestion {
	id: string;
	statement: string;
	explanation: string;
	alternatives: QuestionAlternative[];
}

export interface QuestionBankDetail {
	id: number;
	discipline: string;
	course: string;
	status: string;
	createdAt: string;
	collectionId?: number;
	collectionName?: string;
	questions: GeneratedQuestion[];
}

export interface CosmosCollection {
	key: number;
	name: string;
}

export interface ListFilters {
	status?: string;
	discipline?: string;
	pageSize?: number;
}

/**
 * Cliente da API do service-erp-academic para o módulo Banco de Questões.
 *
 * A interface chama a API por server actions do Next, então o navegador não fala
 * direto com o backend. O cliente é usado para observar o status da geração
 * assíncrona, resolver o identificador do registro criado pela tela e conferir
 * as questões geradas — nunca para substituir uma ação que a interface faz.
 */
export class QuestionBankApi {
	private constructor(
		private readonly context: APIRequestContext,
		private readonly token: string,
	) {}

	static async login(): Promise<QuestionBankApi> {
		const { context, token } = await authenticateAsCoordinator();
		return new QuestionBankApi(context, token);
	}

	private get headers(): Record<string, string> {
		return { Authorization: `Bearer ${this.token}` };
	}

	async dispose(): Promise<void> {
		await this.context.dispose();
	}

	async list(filters: ListFilters = {}): Promise<QuestionBankListItem[]> {
		const params: Record<string, string | number> = {
			page: 1,
			page_size: filters.pageSize ?? 10,
			sortBy: 'createdAt',
			sortOrder: 'DESC',
		};
		if (filters.status) params.status = filters.status;
		if (filters.discipline) params.discipline = filters.discipline;

		const response = await this.context.get(apiUrl('/generation-requests'), {
			headers: this.headers,
			params,
		});
		if (!response.ok()) {
			throw new Error(
				`Falha ao listar bancos de questões (${response.status()}): ${await response.text()}`,
			);
		}
		const body = (await response.json()) as { data: QuestionBankListItem[] };
		return body.data;
	}

	async getDetail(id: number): Promise<QuestionBankDetail> {
		const response = await this.context.get(
			apiUrl(`/generation-requests/${id}`),
			{ headers: this.headers },
		);
		if (!response.ok()) {
			throw new Error(
				`Falha ao buscar o banco de questões ${id} (${response.status()}): ${await response.text()}`,
			);
		}
		return (await response.json()) as QuestionBankDetail;
	}

	async getStatus(id: number): Promise<string> {
		return (await this.getDetail(id)).status;
	}

	/** Localiza o registro criado pela tela pelo nome único da disciplina. */
	async findByDiscipline(discipline: string): Promise<number> {
		const items = await this.list({ discipline, pageSize: 20 });
		const found = items.find((item) => item.discipline === discipline);
		if (!found) {
			throw new Error(
				`Nenhum banco de questões encontrado para a disciplina ${discipline}`,
			);
		}
		return found.id;
	}

	/** Banco mais recente em COMPLETO, que é o estado que habilita a gestão. */
	async findLatestReady(): Promise<number | undefined> {
		const items = await this.list({ status: QB_STATUS.pronta, pageSize: 20 });
		return items[0]?.id;
	}

	/** Coleções do Cosmos oferecidas pela busca do modal de envio. */
	async searchCollections(term: string): Promise<CosmosCollection[]> {
		const response = await this.context.get(apiUrl('/collection/filter'), {
			headers: this.headers,
			params: { filter: term },
		});
		if (!response.ok()) {
			throw new Error(
				`Falha ao buscar coleções do Cosmos (${response.status()}): ${await response.text()}`,
			);
		}
		const body = (await response.json()) as {
			collections: CosmosCollection[];
		};
		return body.collections ?? [];
	}

	/** Remove o registro criado pelo teste, para stage não acumular dados. */
	async remove(id: number): Promise<void> {
		const response = await this.context.delete(
			apiUrl(`/generation-requests/${id}`),
			{ headers: this.headers },
		);
		if (!response.ok()) {
			throw new Error(
				`Falha ao excluir o banco de questões ${id} (${response.status()}): ${await response.text()}`,
			);
		}
	}

	/** Aguarda o fim da geração por IA, que passa por EM_PROCESSAMENTO e PROCESSANDO. */
	async waitForGeneration(
		id: number,
		timeoutMs = E2E_QB_TIMEOUT_MS,
	): Promise<string> {
		return this.waitUntilSettled(id, QB_PENDING_STATUS, timeoutMs, 'A geração');
	}

	/**
	 * Aguarda o fim do envio ao Cosmos. O registro volta para PROCESSANDO enquanto
	 * as questões são publicadas e só então chega a FINALIZADO.
	 */
	async waitForExport(
		id: number,
		timeoutMs = E2E_QB_EXPORT_TIMEOUT_MS,
	): Promise<string> {
		return this.waitUntilSettled(
			id,
			[...QB_PENDING_STATUS, QB_STATUS.pronta],
			timeoutMs,
			'O envio ao Cosmos',
		);
	}

	/**
	 * Observa o status real do registro até ele sair dos estados de processamento,
	 * sem espera fixa. Devolve o status alcançado, inclusive FALHOU, para o teste
	 * reportar o que o ambiente fez em vez de só estourar o tempo.
	 */
	private async waitUntilSettled(
		id: number,
		pending: string[],
		timeoutMs: number,
		etapa: string,
	): Promise<string> {
		const started = Date.now();
		let status = await this.getStatus(id);

		while (pending.includes(status)) {
			if (Date.now() - started > timeoutMs) {
				throw new Error(
					`${etapa} do banco ${id} ainda está em ${status} depois de ${Math.round(
						(Date.now() - started) / 1000,
					)}s (limite de ${Math.round(timeoutMs / 1000)}s).`,
				);
			}
			await new Promise((resolve) => setTimeout(resolve, 10 * 1000));
			status = await this.getStatus(id);
		}

		return status;
	}
}

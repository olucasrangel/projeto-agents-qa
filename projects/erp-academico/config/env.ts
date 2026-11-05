import nodePath from 'node:path';

/**
 * Configuração do sistema Cosmos ERP Acadêmico. O padrão aponta para stage e a
 * suíte não deve ser executada contra produção.
 */
const DEFAULT_BASE_URL = 'https://infoprod.stage.platosedu.io/erp-academico';
const DEFAULT_API_URL =
	'https://infoprod.stage.platosedu.io/api/service-erp-academic';

function required(name: string): string {
	const value = process.env[name];
	if (!value) {
		throw new Error(
			`Variável de ambiente ${name} não definida. Consulte o README do repositório.`,
		);
	}
	return value;
}

export const E2E_BASE_URL = process.env.E2E_BASE_URL ?? DEFAULT_BASE_URL;
export const E2E_API_URL = process.env.E2E_API_URL ?? DEFAULT_API_URL;
export const E2E_LOCALE = process.env.E2E_LOCALE ?? 'pt';

export function coordinatorCredentials(): {
	username: string;
	password: string;
} {
	return {
		username: required('ERP_STAGE_COORD_USERNAME'),
		password: required('ERP_STAGE_COORD_PASSWORD'),
	};
}

export const E2E_KNOWLEDGE_AREA = process.env.E2E_PPC_AREA ?? 'Engenharia';

export function infoproducerEmail(stamp: number): string {
	const template = process.env.E2E_INFOPRODUCER_EMAIL;
	if (template) return template.replace('{stamp}', String(stamp));
	return `devin.e2e+${stamp}@example.com`;
}

/** URL absoluta dentro da aplicação, já com o prefixo de idioma. */
export function appUrl(path = ''): string {
	return `${E2E_BASE_URL.replace(/\/$/, '')}/${E2E_LOCALE}${path}`;
}

export function ppcUrl(path = ''): string {
	return appUrl(`/ppc${path}`);
}

export function questionBankUrl(path = ''): string {
	return appUrl(`/question-bank${path}`);
}

/**
 * PPC concluído usado pela spec de documentos, quando informado. Sem ele a spec
 * procura o CONCLUIDO mais recente em stage.
 */
export const E2E_PPC_CONCLUIDO_ID = process.env.E2E_PPC_CONCLUIDO_ID;

/**
 * Tempo máximo de espera pela geração do Assistente de IA do Infoprodutor, que
 * escreve as Informações Gerais a partir das respostas dos três passos.
 */
export const E2E_PPC_AI_TIMEOUT_MS = Number(
	process.env.E2E_PPC_AI_TIMEOUT_MS ?? 5 * 60 * 1000,
);

/** PDF enviado no upload da geração de questões. */
export const E2E_QB_PDF =
	process.env.E2E_QB_PDF ??
	nodePath.join(__dirname, '..', 'data', 'material-didatico.pdf');

/** Quantidade de questões pedida na geração (a tela aceita 5, 10, 15 e 20). */
export const E2E_QB_QUESTIONS = process.env.E2E_QB_QUESTIONS ?? '5';

/** Nível da taxonomia de Bloom pedido na geração. */
export const E2E_QB_BLOOM = process.env.E2E_QB_BLOOM ?? 'APLICAR';

/** Tempo máximo de espera pela geração assíncrona. Padrão de 15 minutos. */
export const E2E_QB_TIMEOUT_MS = Number(
	process.env.E2E_QB_TIMEOUT_MS ?? 15 * 60 * 1000,
);

/**
 * Tempo máximo de espera pelo envio ao Cosmos, que também é assíncrono: o
 * registro passa por PROCESSANDO antes de chegar a FINALIZADO.
 */
export const E2E_QB_EXPORT_TIMEOUT_MS = Number(
	process.env.E2E_QB_EXPORT_TIMEOUT_MS ?? 10 * 60 * 1000,
);

/** Banco de questões COMPLETO usado pela spec de gestão, quando informado. */
export const E2E_QB_ID = process.env.E2E_QB_ID;

/**
 * Exclui ao final o banco criado pela spec de geração. O padrão é manter o
 * registro, porque ele é o insumo COMPLETO que a spec de gestão consome.
 */
export const E2E_QB_CLEANUP = process.env.E2E_QB_CLEANUP === '1';

/**
 * Termo usado para buscar a coleção do Cosmos no envio. O padrão é um código de
 * coleção específico: termos genéricos trazem a coleção 4126, cujo envio fica
 * preso em PROCESSANDO em stage (ver relatorio-notas.md).
 */
export const E2E_QB_COLLECTION = process.env.E2E_QB_COLLECTION ?? 'WBA0597_v1';

/** Curso informado na geração e esperado no detalhe. */
export const E2E_QB_COURSE =
	process.env.E2E_QB_COURSE ?? 'Previdência social';

/**
 * Disciplina informada na geração. O padrão acompanha o material didático de
 * `data/material-didatico.pdf`, porque a IA gera as questões a partir dele.
 */
export const E2E_QB_DISCIPLINE =
	process.env.E2E_QB_DISCIPLINE ??
	'Benefícios por Incapacidade, Perícia Médica e Auxílio-Acidente';

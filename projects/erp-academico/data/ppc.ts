/** Massa e regras de preenchimento do PPC usadas pelos testes em stage. */

/** Distribuição total de horas exigida pela tela de carga horária. */
export const REQUIRED_DISTRIBUTION_TOTAL = 40;

/** Quantidade de disciplinas do Infoprodutor informada na carga horária. */
export const INFOPRODUCER_DISCIPLINE_COUNT = 6;

/**
 * Disciplinas Anhanguera que o Infoprodutor seleciona, sem contar a Ambientação.
 * A regra de negócio esperada são 3 (matriz inicial de 10 disciplinas).
 */
export const ANHANGUERA_DISCIPLINE_COUNT = Number(
	process.env.E2E_ANHANGUERA_DISCIPLINE_COUNT ?? 3,
);

export const SPECIALIST_CPF = process.env.E2E_SPECIALIST_CPF ?? '39053344705';

/** Rótulos de tipo de disciplina exibidos na tabela de disciplinas. */
export const DISCIPLINE_TYPE = {
	anhanguera: 'Anhanguera',
	infoproducer: 'Infoprodutor',
} as const;

/** Rótulos de situação de disciplina exibidos na tabela de disciplinas. */
export const DISCIPLINE_STATUS = {
	incompleta: 'Incompleta',
	completa: 'Completa',
} as const;

export type DisciplineType =
	(typeof DISCIPLINE_TYPE)[keyof typeof DISCIPLINE_TYPE];
export type DisciplineStatus =
	(typeof DISCIPLINE_STATUS)[keyof typeof DISCIPLINE_STATUS];

export interface FinishData {
	capesEvaluationArea: string;
	capesMainArea: string;
	capesKnowledgeArea: string;
	ocdeClassification: string;
}

/** Classificações CAPES e OCDE informadas na conclusão do PPC. */
export const CLASSIFICACAO_CONCLUSAO: FinishData = {
	capesEvaluationArea: 'Engenharias',
	capesMainArea: 'Engenharias III',
	capesKnowledgeArea: 'Engenharia de Produção',
	ocdeClassification: '0714',
};

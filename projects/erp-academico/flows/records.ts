import { test } from '@playwright/test';
import { RECORD_ANNOTATION } from '../../../shared/reporter';

/** Registra no relatório o PPC criado em stage e o status observado. */
export function registrarPPC(ppcId: number, situacao: string): void {
	test.info().annotations.push({
		type: RECORD_ANNOTATION,
		description: `PPC ${ppcId}: ${situacao}`,
	});
}

/** Registra no relatório o banco de questões usado ou criado em stage. */
export function registrarBanco(id: number, situacao: string): void {
	test.info().annotations.push({
		type: RECORD_ANNOTATION,
		description: `Banco de questões ${id}: ${situacao}`,
	});
}

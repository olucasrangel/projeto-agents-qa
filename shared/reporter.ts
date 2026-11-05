import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type {
	FullResult,
	Reporter,
	TestCase,
	TestResult,
} from '@playwright/test/reporter';

/**
 * Anotação usada pelos testes para registrar, no relatório, os registros reais
 * criados no ambiente (por exemplo o PPC criado em stage e o status final).
 */
export const RECORD_ANNOTATION = 'registro';

export interface MarkdownReporterOptions {
	/** Título do relatório, normalmente o sistema e o módulo cobertos. */
	title: string;
	/** Ambiente exercitado, exibido no cabeçalho. */
	environment: string;
	/** Caminho do arquivo gerado. */
	output: string;
	/** Arquivo de cobertura e limitações anexado ao final do relatório. */
	notes?: string;
	/** Título da seção que lista os registros criados. */
	recordsTitle?: string;
}

interface TestLine {
	spec: string;
	title: string;
	status: string;
	seconds: string;
	error?: string;
}

function stripAnsi(value: string): string {
	return value.replace(/\u001B\[[0-9;]*m/g, '').trim();
}

function icon(status: string): string {
	if (status === 'passed') return 'passou';
	if (status === 'skipped') return 'não executado';
	return 'falhou';
}

function currentCommit(): string {
	try {
		return execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
			encoding: 'utf-8',
		}).trim();
	} catch {
		return 'desconhecido';
	}
}

/**
 * Gera um relatório curto em Markdown por execução, para o time acompanhar o
 * que passou e o que ainda falta cobrir sem precisar abrir o relatório HTML.
 */
export default class MarkdownReporter implements Reporter {
	private readonly lines: TestLine[] = [];
	private readonly records: string[] = [];
	private startedAt = Date.now();

	constructor(private readonly options: MarkdownReporterOptions) {}

	onBegin(): void {
		this.startedAt = Date.now();
	}

	onTestEnd(test: TestCase, result: TestResult): void {
		this.lines.push({
			spec: path.basename(test.location.file),
			title: test.title,
			status: icon(result.status),
			seconds: (result.duration / 1000).toFixed(1),
			error: stripAnsi(result.error?.message?.split('\n')[0] ?? '') || undefined,
		});

		for (const annotation of [...test.annotations, ...result.annotations]) {
			if (
				annotation.type === RECORD_ANNOTATION &&
				annotation.description &&
				!this.records.includes(annotation.description)
			) {
				this.records.push(annotation.description);
			}
		}
	}

	onEnd(result: FullResult): void {
		const passed = this.lines.filter((line) => line.status === 'passou').length;
		const minutes = ((Date.now() - this.startedAt) / 60000).toFixed(1);

		const parts = [
			`# ${this.options.title}`,
			'',
			`- Execução: ${new Date().toLocaleString('pt-BR')}`,
			`- Ambiente: ${this.options.environment}`,
			`- Commit da suíte: ${currentCommit()}`,
			`- Resultado: ${passed} de ${this.lines.length} testes passaram em ${minutes} min (${result.status})`,
			'',
			'## Testes',
			'',
			'| Spec | Teste | Resultado | Duração |',
			'| ---- | ----- | --------- | ------- |',
			...this.lines.map(
				(line) =>
					`| ${line.spec} | ${line.title} | ${line.status} | ${line.seconds}s |`,
			),
			'',
		];

		const failures = this.lines.filter((line) => line.status === 'falhou');
		if (failures.length > 0) {
			parts.push(
				'## Falhas',
				'',
				...failures.map(
					(line) => `- ${line.title}: ${line.error ?? 'sem mensagem'}`,
				),
				'',
			);
		}

		if (this.records.length > 0) {
			parts.push(
				`## ${this.options.recordsTitle ?? 'Registros criados nesta execução'}`,
				'',
				...this.records.map((record) => `- ${record}`),
				'',
			);
		}

		const notes = this.options.notes;
		if (notes && existsSync(notes)) {
			parts.push(readFileSync(notes, 'utf-8').trim(), '');
		}

		mkdirSync(path.dirname(this.options.output), { recursive: true });
		writeFileSync(this.options.output, parts.join('\n'));
		console.log(`\nRelatório em Markdown: ${this.options.output}`);
	}
}

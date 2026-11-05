import { randomUUID } from 'node:crypto';
import {
	copyFileSync,
	existsSync,
	mkdirSync,
	renameSync,
	writeFileSync,
} from 'node:fs';
import path from 'node:path';
import type {
	FullResult,
	Reporter,
	TestCase,
	TestResult,
} from '@playwright/test/reporter';

export const FINAL_SCENARIO_SCREENSHOT = 'scenario-final-screenshot';
export const EVIDENCE_CAPTURE_ERROR = 'evidence-capture-error';

interface EvidenceReporterOptions {
	project: string;
	environment: string;
	evidenceRoot?: string;
	approvalsRoot?: string;
	zephyrProjectKey?: string;
	uploadMode?: 'dry-run' | 'real';
}

interface EvidenceEntry {
	card: string;
	zephyrKey: string | null;
	title: string;
	spec: string;
	status: 'PASS' | 'FAIL' | 'SKIPPED';
	playwrightStatus: string;
	expectedStatus: string;
	durationMs: number;
	retry: number;
	screenshot: string | null;
	captureError: string | null;
	metadataError: string | null;
	upload: {
		target: 'test-execution';
		status: 'dry-run' | 'pending' | 'blocked';
	};
}

function safeRunId(value?: string): string {
	const candidate = value?.trim();
	if (candidate && /^[A-Za-z0-9._-]+$/.test(candidate)) return candidate;
	return `${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`;
}

function slug(value: string): string {
	return value
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase()
		.replace(/@[A-Z0-9-]+/gi, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '')
		.slice(0, 80) || 'cenario';
}

function atomicJson(target: string, value: unknown): void {
	mkdirSync(path.dirname(target), { recursive: true });
	const temporary = `${target}.tmp-${process.pid}`;
	writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`);
	renameSync(temporary, target);
}

function resultStatus(status: string): EvidenceEntry['status'] {
	if (status === 'passed') return 'PASS';
	if (status === 'skipped') return 'SKIPPED';
	return 'FAIL';
}

/**
 * Persiste evidências de cenários rastreados por @CARD e @VPOS-Txxx.
 * O upload real fica fora deste reporter enquanto o projeto estiver em dry-run.
 */
export default class EvidenceReporter implements Reporter {
	private readonly entries = new Map<string, EvidenceEntry[]>();
	private readonly runId = safeRunId(process.env.E2E_RUN_ID);
	private startedAt = new Date().toISOString();

	constructor(private readonly options: EvidenceReporterOptions) {}

	onBegin(): void {
		this.startedAt = new Date().toISOString();
	}

	onTestEnd(test: TestCase, result: TestResult): void {
		const cardTags = test.tags.filter((tag) => /^@[A-Z][A-Z0-9]+-\d+$/.test(tag));
		if (cardTags.length === 0) return;
		const card = cardTags[0]?.slice(1);
		if (!card) return;

		const zephyrPrefix = this.options.zephyrProjectKey ?? 'VPOS';
		const zephyrPattern = new RegExp(`^@${zephyrPrefix}-T\\d+$`);
		const zephyrTags = test.tags.filter((tag) => zephyrPattern.test(tag));
		const zephyrKey = zephyrTags.length === 1 ? zephyrTags[0]?.slice(1) ?? null : null;
		const status = resultStatus(result.status);
		const attachment = result.attachments.find(
			(item) => item.name === FINAL_SCENARIO_SCREENSHOT,
		);
		const captureError = [...test.annotations, ...result.annotations].find(
			(item) => item.type === EVIDENCE_CAPTURE_ERROR,
		)?.description;
		const metadataErrors = [
			...(cardTags.length === 1 ? [] : [`esperada uma tag de card; encontradas ${cardTags.length}`]),
			...(zephyrTags.length === 1
				? []
				: [`esperada uma tag ${zephyrPrefix}; encontradas ${zephyrTags.length}`]),
		];

		const cardRoot = path.join(this.options.evidenceRoot ?? 'evidence', card, this.runId);
		let screenshot: string | null = null;
		if (attachment && status !== 'SKIPPED') {
			const fileName = `${zephyrKey ?? 'UNMAPPED'}__${slug(test.title)}__r${result.retry}.png`;
			const target = path.join(cardRoot, status, fileName);
			mkdirSync(path.dirname(target), { recursive: true });
			if (attachment.body) writeFileSync(target, attachment.body);
			else if (attachment.path && existsSync(attachment.path)) copyFileSync(attachment.path, target);
			screenshot = path.relative(cardRoot, target);
		}

		const entry: EvidenceEntry = {
			card,
			zephyrKey,
			title: test.title,
			spec: path.relative(process.cwd(), test.location.file),
			status,
			playwrightStatus: result.status,
			expectedStatus: test.expectedStatus,
			durationMs: result.duration,
			retry: result.retry,
			screenshot,
			captureError: captureError ?? (!attachment && status !== 'SKIPPED' ? 'screenshot final ausente' : null),
			metadataError: metadataErrors.length > 0 ? metadataErrors.join('; ') : null,
			upload: {
				target: 'test-execution',
				status: !zephyrKey
					? 'blocked'
					: this.options.uploadMode === 'real'
						? 'pending'
						: 'dry-run',
			},
		};

		const cardEntries = this.entries.get(card) ?? [];
		cardEntries.push(entry);
		this.entries.set(card, cardEntries);
	}

	onEnd(result: FullResult): void {
		for (const [card, entries] of this.entries) {
			const manifest = {
				schemaVersion: 1,
				runId: this.runId,
				card,
				project: this.options.project,
				environment: this.options.environment,
				zephyrProjectKey: this.options.zephyrProjectKey ?? 'VPOS',
				testCycle: { required: true, key: null, created: false },
				uploadMode: this.options.uploadMode ?? 'dry-run',
				startedAt: this.startedAt,
				finishedAt: new Date().toISOString(),
				result: result.status,
				entries,
			};
			const evidenceRoot = path.join(this.options.evidenceRoot ?? 'evidence', card, this.runId);
			const executionRoot = path.join(
				this.options.approvalsRoot ?? 'qa/approvals',
				card,
				'executions',
				this.runId,
			);
			atomicJson(path.join(evidenceRoot, 'evidence-manifest.json'), manifest);
			atomicJson(path.join(executionRoot, 'evidence-manifest.json'), manifest);

			const lines = [
				`# Execução ${this.runId} — ${card}`,
				'',
				`- Projeto: ${this.options.project}`,
				`- Ambiente: ${this.options.environment}`,
				`- Resultado: ${result.status}`,
				`- Ciclo Zephyr: não criado (${this.options.uploadMode ?? 'dry-run'})`,
				'',
				'| Cenário | Chave VPOS | Resultado | Screenshot |',
				'|---|---|---|---|',
				...entries.map(
					(entry) =>
						`| ${entry.title.replaceAll('|', '\\|')} | ${entry.zephyrKey ?? 'não mapeada'} | ${entry.status} | ${entry.screenshot ?? 'indisponível'} |`,
				),
				'',
			];
			mkdirSync(executionRoot, { recursive: true });
			writeFileSync(path.join(executionRoot, 'execution.md'), lines.join('\n'));
			console.log(`Evidências de ${card}: ${evidenceRoot}`);
		}
	}
}

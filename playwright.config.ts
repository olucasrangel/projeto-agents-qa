import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import { resolveProject } from './shared/projects';

// Carrega credenciais e flags de um arquivo .env na raiz, quando existir.
// Variáveis já definidas no ambiente têm precedência (não são sobrescritas).
dotenv.config();

// E2E_EVIDENCE=1 grava vídeo e trace de todos os testes, e não só dos que falham.
const evidence = process.env.E2E_EVIDENCE === '1';

// E2E_PROJECT escolhe qual projeto de `projects/` é exercitado nesta execução.
const { id, config } = resolveProject();
const baseURL = process.env.E2E_BASE_URL ?? config.stageUrl;

// Testes marcados com @custo-alto consomem recurso pago a cada execução (upload
// e geração por IA), então só entram quando pedidos explicitamente.
const expensive = process.env.E2E_QB_EXPENSIVE === '1';

export default defineConfig({
	testDir: `./projects/${id}/tests`,
	// Os fluxos são sequenciais e criam registros reais no ambiente, então
	// paralelismo geraria interferência entre execuções e retry esconderia
	// instabilidade que precisamos enxergar.
	workers: 1,
	fullyParallel: false,
	retries: 0,
	...(expensive ? {} : { grepInvert: /@custo-alto/ }),
	timeout: 5 * 60 * 1000,
	expect: { timeout: 30 * 1000 },
	reporter: [
		['list'],
		['html', { open: 'never' }],
		[
			'./shared/reporter.ts',
			{
				title: `Relatório E2E — ${config.label}`,
				environment: baseURL,
				output: `test-results/relatorio-${id}.md`,
				notes: `projects/${id}/relatorio-notas.md`,
				recordsTitle: config.recordsTitle,
			},
		],
		[
			'./shared/evidence-reporter.ts',
			{
				project: id,
				environment: baseURL,
				evidenceRoot: 'evidence',
				approvalsRoot: 'qa/approvals',
				zephyrProjectKey: 'VPOS',
				uploadMode: 'dry-run',
			},
		],
	],
	use: {
		baseURL,
		locale: 'pt-BR',
		// Ambiente remoto responde pior que local: timeout curto produz falso
		// vermelho.
		actionTimeout: 60 * 1000,
		navigationTimeout: 90 * 1000,
		screenshot: 'only-on-failure',
		video: evidence ? 'on' : 'retain-on-failure',
		trace: evidence ? 'on' : 'retain-on-failure',
	},
	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] },
		},
	],
});

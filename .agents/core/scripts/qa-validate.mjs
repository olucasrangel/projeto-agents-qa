#!/usr/bin/env node
import { formatValidation, GATE_STATES, validateGate } from './lib/gate-validation.mjs';

const args = process.argv.slice(2);
const card = args[0]?.toUpperCase();
const gate = args[1]?.toUpperCase();
const runIndex = args.indexOf('--run-id');
const runId = runIndex >= 0 ? args[runIndex + 1] : undefined;
const json = args.includes('--json');

if (!card || !/^[A-Z][A-Z0-9]+-\d+$/.test(card) || !GATE_STATES[gate]) {
	console.error('Uso: npm run qa:validate -- PROJ-123 G1|G2|G3 [--run-id id] [--json]');
	process.exit(1);
}

const result = validateGate({ card, gate, runId });
console.log(json ? JSON.stringify(result, null, 2) : formatValidation(result));
process.exit(result.valid ? 0 : 1);

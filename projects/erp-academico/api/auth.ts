import { APIRequestContext, request } from '@playwright/test';
import { coordinatorCredentials, E2E_API_URL } from '../config/env';

export function apiUrl(path: string): string {
	return `${E2E_API_URL.replace(/\/$/, '')}${path}`;
}

export interface AuthenticatedContext {
	context: APIRequestContext;
	token: string;
}

/** Autentica na API do service-erp-academic com as credenciais do Coordenador. */
export async function authenticateAsCoordinator(): Promise<AuthenticatedContext> {
	const { username, password } = coordinatorCredentials();
	const context = await request.newContext();
	const response = await context.post(apiUrl('/auth/login/credentials'), {
		data: { username, password },
	});
	if (!response.ok()) {
		throw new Error(
			`Falha ao autenticar na API (${response.status()}): ${await response.text()}`,
		);
	}
	const body = (await response.json()) as { token: string };
	return { context, token: body.token };
}

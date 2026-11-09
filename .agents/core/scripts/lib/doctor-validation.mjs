export function allowedHttpsUrl(value, allowedHosts) {
	try {
		const url = new URL(value);
		return url.protocol === 'https:' && allowedHosts.includes(url.hostname);
	} catch {
		return false;
	}
}

import chalk from "chalk";
import { join } from "path";
import { loadUserAgentFromGist } from "./user-agent";

const { randomInt } = require("crypto");

const MAX_RETRIES = 3;

export async function fetchUrlContent(url: RequestInfo | URL) {
	const userAgents = await loadUserAgentFromGist();

	for (let i = 0; i < MAX_RETRIES; i++) {
		const userAgent = userAgents[randomInt(userAgents.length)];
		const headers = {
			"User-Agent": userAgent,
		};

		try {
			const response = await fetch(url, {
				headers: headers,
			});

			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			return await response.text();
		} catch (error) {
			console.warn(`Error fetching URL ${url}. Retrying in 5 seconds...`);
			await new Promise((resolve) => setTimeout(resolve, 5000));
		}
	}

	console.error(`Failed to fetch URL ${url} after ${MAX_RETRIES} retries.`);
	process.exit(1);
}

export const paramspiderText: any = chalk.bold.blue(
	await Bun.file(join(import.meta.dir, "asci.txt")).text()
);

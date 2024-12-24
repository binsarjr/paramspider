#!/usr/bin/env bun

import chalk from "chalk";
import { program } from "commander";
import * as fs from "fs";
import { join } from "path";
import { fetchUrlContent, paramspiderText } from "./client";

declare global {
	var stream_output: boolean;
}

globalThis.stream_output = false;

const HARDCODED_EXTENSIONS = [
	".jpg",
	".jpeg",
	".png",
	".gif",
	".pdf",
	".svg",
	".json",
	".css",
	".js",
	".webp",
	".woff",
	".woff2",
	".eot",
	".ttf",
	".otf",
	".mp4",
	".txt",
];

function hasExtention(url: string, extentions: string[]) {
	const parsedUrl = new URL(url);
	const ext = parsedUrl.pathname.split(".").pop();

	return ext && extentions.includes(ext.toLowerCase());
}

function cleanHostname(url: string) {
	if (!url.includes(".")) return null;

	if (!url.startsWith("http")) {
		url = "http://" + url;
	}

	try {
		return new URL(url).hostname;
	} catch (error) {
		return null;
	}
}

function cleanUrl(url: string): string {
	/**
	 * Clean the URL by removing redundant port information for HTTP and HTTPS URLs.
	 *
	 * Args:
	 *     url (string): The URL to clean.
	 *
	 * Returns:
	 *     string: Cleaned URL.
	 */
	const parsedUrl = new URL(url);

	if (
		(parsedUrl.port === "80" && parsedUrl.protocol === "http:") ||
		(parsedUrl.port === "443" && parsedUrl.protocol === "https:")
	) {
		parsedUrl.port = "";
	}

	return parsedUrl.toString();
}

function cleanUrls(
	urls: string[],
	extensions: string[],
	placeholder: string
): string[] {
	/**
	 * Clean a list of URLs by removing unnecessary parameters and query strings.
	 *
	 * Args:
	 *     urls (string[]): List of URLs to clean.
	 *     extensions (string[]): List of file extensions to check against.
	 *     placeholder (string): Placeholder to replace query parameters.
	 *
	 * Returns:
	 *     string[]: List of cleaned URLs.
	 */
	const cleanedUrls = new Set<string>();
	urls.forEach((url) => {
		if (!url) return;
		let cleanedUrl = cleanUrl(url);
		if (!hasExtention(cleanedUrl, extensions)) {
			const parsedUrl = new URL(cleanedUrl);
			const queryParams = new URLSearchParams(parsedUrl.search);
			const cleanedParams = new URLSearchParams();
			queryParams.forEach((_, key) => {
				cleanedParams.append(key, placeholder);
			});
			parsedUrl.search = cleanedParams.toString();
			cleanedUrl = parsedUrl.toString();
			cleanedUrls.add(cleanedUrl);
		}
	});
	return Array.from(cleanedUrls);
}

async function fetch_and_clean_urls(
	domain: string,
	extensions: string[] = HARDCODED_EXTENSIONS,
	// , stream_output,proxy,
	placeholder: string = "FUZZ"
) {
	const wayback_uri = `https://web.archive.org/cdx/search/cdx?url=${domain}/*&output=txt&collapse=urlkey&fl=original&page=/`;

	console.log(
		"[" +
			chalk.green("INFO") +
			"] Fetching URLs from " +
			chalk.green(domain) +
			"..."
	);

	const response = await fetchUrlContent(wayback_uri);

	const urls = response.split("\n");

	const cleaned_urls = cleanUrls(urls, extensions, placeholder);

	console.log(
		"[" +
			chalk.green("INFO") +
			"] Found " +
			chalk.blue(cleaned_urls.length) +
			" URLS for " +
			chalk.green(domain) +
			"..."
	);

	const results_dir = "./results";
	if (!fs.existsSync(results_dir)) {
		fs.mkdirSync(results_dir);
	}

	const resultFile = join(results_dir, `${cleanHostname(domain)}.txt`);

	const fileStream = fs.createWriteStream(resultFile, { flags: "w" });

	console.log(
		"[" +
			chalk.green("INFO") +
			"] Extracting URLS with parameters from " +
			chalk.green(domain) +
			"..."
	);
	cleaned_urls.forEach((url) => {
		if (url.includes("?")) {
			fileStream.write(url + "\n");
			if (globalThis.stream_output) {
				console.log("[" + chalk.blue("FOUND") + "] " + url);
			}
		}
	});

	fileStream.end();
	console.log(
		"[" +
			chalk.green("INFO") +
			"] Saved cleaned urls to " +
			chalk.blue(resultFile)
	);
}

console.log(paramspiderText);

program.name("paramspider");

const options = program
	.option("-d, --domain <string...>", "Domain to crawl")
	.option("-l, --list <list...>", "List of domains to crawl")
	.option(
		"-p, --placeholder <string>",
		"Placeholder to replace query parameters",
		"FUZZ"
	)
	.option("-s, --stream", "Stream output to console", false)
	.parse(process.argv)
	.opts();

if (!(options.domain || options.list)) {
	program.error("Please provide either the -d option or the -l option.");
}

const domains = new Set<string>();

options.domain.map((domain: string) => {
	const hostname = cleanHostname(domain);
	if (!hostname) {
		console.warn(`Error parsing URL ${domain}. Skipping...`);
		return;
	}
	domains.add(hostname);
});

if (options.list) {
	await options.list.map(async (filepath: string) => {
		const list = fs.readFileSync(filepath, "utf-8");
		const lines = list.split("\n");
		lines.forEach((line) => {
			// skip empty line
			if (!line) return;
			const hostname = cleanHostname(line);

			if (!hostname) {
				console.warn(`Error parsing URL ${line}. Skipping...`);
				return;
			}

			domains.add(hostname);
		});
	});
}

globalThis.stream_output = options.stream;

for (const domain of domains) {
	await fetch_and_clean_urls(domain, HARDCODED_EXTENSIONS, options.placeholder);
}

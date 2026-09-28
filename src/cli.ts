#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { checkStellarToml, type Finding } from "./check.js";

interface LoadedSource {
  body: string;
  transportFindings: Finding[];
}

function usage(): void {
  console.log(`stellar-toml-check [file-or-url] [--json]

Validate a SEP-1 stellar.toml file. The source defaults to ./stellar.toml.

Examples:
  stellar-toml-check
  stellar-toml-check ./public/.well-known/stellar.toml
  stellar-toml-check https://example.com/.well-known/stellar.toml --json`);
}

async function load(source: string): Promise<LoadedSource> {
  if (!/^https?:\/\//i.test(source)) {
    return { body: await readFile(source, "utf8"), transportFindings: [] };
  }

  const response = await fetch(source, { redirect: "follow" });
  if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
  const transportFindings: Finding[] = [];
  if (response.headers.get("access-control-allow-origin") !== "*") {
    transportFindings.push({
      severity: "error",
      path: "HTTP.Access-Control-Allow-Origin",
      message: "Hosted stellar.toml must send Access-Control-Allow-Origin: *.",
    });
  }
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("text/plain")) {
    transportFindings.push({
      severity: "warning",
      path: "HTTP.Content-Type",
      message: "SEP-1 recommends Content-Type: text/plain.",
    });
  }
  return { body: await response.text(), transportFindings };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    usage();
    return;
  }
  const json = args.includes("--json");
  const source = args.find((arg) => !arg.startsWith("-")) ?? "stellar.toml";

  try {
    const loaded = await load(source);
    const result = checkStellarToml(loaded.body);
    const findings = [...loaded.transportFindings, ...result.findings];
    if (json) {
      console.log(JSON.stringify({ source, valid: !findings.some((finding) => finding.severity === "error"), findings }, null, 2));
    } else if (findings.length === 0) {
      console.log(`✓ ${source} passes the implemented SEP-1 checks.`);
    } else {
      for (const finding of findings) {
        const marker = finding.severity === "error" ? "✗" : "!";
        console.log(`${marker} ${finding.severity.toUpperCase()} ${finding.path}: ${finding.message}`);
      }
    }
    process.exitCode = findings.some((finding) => finding.severity === "error") ? 1 : 0;
  } catch (error) {
    console.error(`✗ Could not read ${source}: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 2;
  }
}

await main();

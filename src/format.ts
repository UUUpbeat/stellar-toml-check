import type { Finding } from "./check.js";

function escapeData(value: string): string {
  return value.replaceAll("%", "%25").replaceAll("\r", "%0D").replaceAll("\n", "%0A");
}

function escapeProperty(value: string): string {
  return escapeData(value).replaceAll(":", "%3A").replaceAll(",", "%2C");
}

export function formatGitHubAnnotation(finding: Finding): string {
  const command = finding.severity === "error" ? "error" : "warning";
  const title = escapeProperty(`stellar.toml ${finding.path}`);
  return `::${command} title=${title}::${escapeData(finding.message)}`;
}

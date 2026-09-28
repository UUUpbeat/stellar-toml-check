import type { Finding } from "./check.js";

export function isFailure(findings: Finding[], strict = false): boolean {
  return findings.some(
    (finding) => finding.severity === "error" || (strict && finding.severity === "warning"),
  );
}

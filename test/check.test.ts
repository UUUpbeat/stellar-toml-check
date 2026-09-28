import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { checkStellarToml } from "../src/check.js";
import { isFailure } from "../src/result.js";

const valid = `VERSION = "2.7.0"
WEB_AUTH_ENDPOINT = "https://example.com/auth"
SIGNING_KEY = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF"
ACCOUNTS = ["GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF"]

[DOCUMENTATION]
ORG_URL = "https://example.com"

[[CURRENCIES]]
code = "TEST"
issuer = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF"
status = "test"
display_decimals = 7
is_unlimited = true
`;

const invalid = `VERSION = "2.7.0"
WEB_AUTH_ENDPOINT = "http://example.com/auth"

[[CURRENCIES]]
code = "THIS-CODE-IS-TOO-LONG"
issuer = "not-a-stellar-account"
contract = "not-a-contract"
display_decimals = 9
fixed_number = 100
max_number = 200
`;

describe("checkStellarToml", () => {
  it("accepts a focused valid SEP-1 document", () => {
    assert.deepEqual(checkStellarToml(valid).findings, []);
  });

  it("reports unsafe URLs and malformed currency fields", () => {
    const findings = checkStellarToml(invalid).findings;
    assert.ok(findings.some((finding) => finding.path === "WEB_AUTH_ENDPOINT"));
    assert.ok(findings.some((finding) => finding.path === "CURRENCIES[0].code"));
    assert.ok(findings.some((finding) => finding.path === "CURRENCIES[0]" && finding.severity === "error"));
  });

  it("turns TOML parser failures into findings", () => {
    const result = checkStellarToml('VERSION = "2.7.0"\nBROKEN = [');
    assert.equal(result.findings[0]?.path, "$");
    assert.equal(result.findings[0]?.severity, "error");
  });

  it("only treats warnings as failures in strict mode", () => {
    const warnings = [{ severity: "warning" as const, path: "VERSION", message: "Missing version." }];
    assert.equal(isFailure(warnings), false);
    assert.equal(isFailure(warnings, true), true);
  });
});

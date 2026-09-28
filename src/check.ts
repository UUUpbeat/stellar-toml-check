import { parse } from "smol-toml";

export type Severity = "error" | "warning";

export interface Finding {
  severity: Severity;
  path: string;
  message: string;
}

export interface CheckResult {
  findings: Finding[];
  document?: Record<string, unknown>;
}

const MAX_BYTES = 100 * 1024;
const HTTPS_FIELDS = [
  "FEDERATION_SERVER",
  "TRANSFER_SERVER",
  "TRANSFER_SERVER_SEP0024",
  "KYC_SERVER",
  "WEB_AUTH_ENDPOINT",
  "WEB_AUTH_FOR_CONTRACTS_ENDPOINT",
  "DIRECT_PAYMENT_SERVER",
  "ANCHOR_QUOTE_SERVER",
] as const;
const STELLAR_PUBLIC_KEY = /^G[A-Z2-7]{55}$/;
const STELLAR_CONTRACT_ID = /^C[A-Z2-7]{55}$/;

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function add(
  findings: Finding[],
  severity: Severity,
  path: string,
  message: string,
): void {
  findings.push({ severity, path, message });
}

function checkHttps(
  findings: Finding[],
  object: Record<string, unknown>,
  field: string,
  path = field,
): void {
  const value = object[field];
  if (value !== undefined && (typeof value !== "string" || !value.startsWith("https://"))) {
    add(findings, "error", path, `${field} must use HTTPS.`);
  }
}

function checkCurrencies(findings: Finding[], value: unknown): void {
  if (value === undefined) return;
  if (!Array.isArray(value)) {
    add(findings, "error", "CURRENCIES", "CURRENCIES must be an array of tables.");
    return;
  }

  value.forEach((item, index) => {
    const currency = record(item);
    const base = `CURRENCIES[${index}]`;
    if (!currency) {
      add(findings, "error", base, "Currency entry must be a table.");
      return;
    }

    if (typeof currency.toml === "string") {
      if (Object.keys(currency).length !== 1) {
        add(findings, "error", base, "An external currency TOML entry may only contain the toml field.");
      }
      checkHttps(findings, currency, "toml", `${base}.toml`);
      return;
    }

    if (typeof currency.code !== "string" || currency.code.length === 0 || currency.code.length > 12) {
      add(findings, "error", `${base}.code`, "code is required and must contain 1 to 12 characters.");
    }

    const issuerValid = typeof currency.issuer === "string" && STELLAR_PUBLIC_KEY.test(currency.issuer);
    const contractValid = typeof currency.contract === "string" && STELLAR_CONTRACT_ID.test(currency.contract);
    if (issuerValid === contractValid) {
      add(findings, "error", base, "Provide exactly one valid issuer or contract identifier.");
    }

    if (currency.status !== undefined && !["live", "dead", "test", "private"].includes(String(currency.status))) {
      add(findings, "error", `${base}.status`, "status must be live, dead, test, or private.");
    }

    if (
      currency.display_decimals !== undefined &&
      (!Number.isInteger(currency.display_decimals) || Number(currency.display_decimals) < 0 || Number(currency.display_decimals) > 7)
    ) {
      add(findings, "error", `${base}.display_decimals`, "display_decimals must be an integer from 0 to 7.");
    }

    const policies = ["fixed_number", "max_number", "is_unlimited"].filter(
      (field) => currency[field] !== undefined,
    );
    if (policies.length !== 1) {
      add(findings, "warning", base, "SEP-1 recommends exactly one issuance policy: fixed_number, max_number, or is_unlimited.");
    }
  });
}

function checkValidators(findings: Finding[], value: unknown): void {
  if (value === undefined) return;
  if (!Array.isArray(value)) {
    add(findings, "error", "VALIDATORS", "VALIDATORS must be an array of tables.");
    return;
  }

  value.forEach((item, index) => {
    const validator = record(item);
    const base = `VALIDATORS[${index}]`;
    if (!validator) {
      add(findings, "error", base, "Validator entry must be a table.");
      return;
    }

    if (validator.ALIAS === undefined) {
      add(findings, "warning", `${base}.ALIAS`, "ALIAS helps identify the validator in quorum explorers.");
    } else if (typeof validator.ALIAS !== "string" || !/^[a-z0-9-]{2,16}$/.test(validator.ALIAS)) {
      add(findings, "error", `${base}.ALIAS`, "ALIAS must match ^[a-z0-9-]{2,16}$.");
    }

    if (validator.PUBLIC_KEY === undefined) {
      add(findings, "warning", `${base}.PUBLIC_KEY`, "PUBLIC_KEY identifies the validator node.");
    } else if (typeof validator.PUBLIC_KEY !== "string" || !STELLAR_PUBLIC_KEY.test(validator.PUBLIC_KEY)) {
      add(findings, "error", `${base}.PUBLIC_KEY`, "PUBLIC_KEY must be a valid G-address.");
    }

    if (validator.HOST !== undefined) {
      const match = typeof validator.HOST === "string"
        ? /^(?:\[[^\]]+\]|[^:\s]+):(\d{1,5})$/.exec(validator.HOST)
        : null;
      const port = match ? Number(match[1]) : 0;
      if (!match || port < 1 || port > 65535) {
        add(findings, "error", `${base}.HOST`, "HOST must use host:port with a port from 1 to 65535.");
      }
    }

    if (validator.HISTORY !== undefined) {
      if (typeof validator.HISTORY !== "string") {
        add(findings, "error", `${base}.HISTORY`, "HISTORY must be an absolute URI.");
      } else if (!URL.canParse(validator.HISTORY)) {
        add(findings, "error", `${base}.HISTORY`, "HISTORY must be an absolute URI.");
      }
    }
  });
}

export function checkStellarToml(source: string): CheckResult {
  const findings: Finding[] = [];
  if (Buffer.byteLength(source, "utf8") > MAX_BYTES) {
    add(findings, "error", "$", "stellar.toml exceeds the SEP-1 100 KB size limit.");
    return { findings };
  }

  let document: Record<string, unknown>;
  try {
    document = parse(source) as Record<string, unknown>;
  } catch (error) {
    add(findings, "error", "$", `Invalid TOML: ${error instanceof Error ? error.message : String(error)}`);
    return { findings };
  }

  if (typeof document.VERSION !== "string") {
    add(findings, "warning", "VERSION", "VERSION is recommended so clients know which SEP-1 version to expect.");
  }

  for (const field of HTTPS_FIELDS) checkHttps(findings, document, field);

  if (Array.isArray(document.ACCOUNTS)) {
    document.ACCOUNTS.forEach((account, index) => {
      if (typeof account !== "string" || !STELLAR_PUBLIC_KEY.test(account)) {
        add(findings, "error", `ACCOUNTS[${index}]`, "Account must be a valid G-address.");
      }
    });
  } else if (document.ACCOUNTS !== undefined) {
    add(findings, "error", "ACCOUNTS", "ACCOUNTS must be an array.");
  }

  if (document.SIGNING_KEY !== undefined && (typeof document.SIGNING_KEY !== "string" || !STELLAR_PUBLIC_KEY.test(document.SIGNING_KEY))) {
    add(findings, "error", "SIGNING_KEY", "SIGNING_KEY must be a valid G-address.");
  }

  const documentation = record(document.DOCUMENTATION);
  if (documentation) checkHttps(findings, documentation, "ORG_URL", "DOCUMENTATION.ORG_URL");

  checkCurrencies(findings, document.CURRENCIES);
  checkValidators(findings, document.VALIDATORS);
  return { findings, document };
}

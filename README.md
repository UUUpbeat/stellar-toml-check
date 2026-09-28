# stellar-toml-check

A small TypeScript CLI that checks local or hosted [`stellar.toml`](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0001.md) files against focused SEP-1 rules.

The project is intentionally narrow: it catches common configuration mistakes, produces actionable paths, and can run in local development or CI. It does not claim to replace the official Stellar Anchor Validator.

## Checks

- TOML syntax and the SEP-1 100 KB limit
- HTTPS requirements for service endpoints
- Stellar account and contract identifier shape
- currency code, status, decimal, and issuance-policy rules
- hosted-file CORS and content-type headers
- human-readable and JSON output with meaningful exit codes

## Usage

```bash
pnpm install
pnpm build
node dist/src/cli.js ./stellar.toml
node dist/src/cli.js https://example.com/.well-known/stellar.toml --json
```

Exit code `0` means no errors, `1` means validation errors were found, and `2` means the source could not be read.

## Development

```bash
pnpm install
pnpm verify
```

The CI workflow runs linting, strict TypeScript checks, tests, and a production build on every pull request.

## Scope and references

The implemented rules follow the active [SEP-1 specification](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0001.md), currently version 2.7.0. Rules are deliberately kept explicit in `src/check.ts` so changes can be reviewed against the specification.

See [CONTRIBUTING.md](CONTRIBUTING.md) for the contribution workflow and review expectations.

## License

[MIT](LICENSE)

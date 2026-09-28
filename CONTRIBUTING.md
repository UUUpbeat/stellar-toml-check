# Contributing

Thanks for improving `stellar-toml-check`.

## Before opening a pull request

1. Open or reference an issue that explains the observable problem.
2. Keep validation changes traceable to the active SEP-1 specification.
3. Add a focused test for every new rule or bug fix.
4. Run `pnpm verify` locally.

Pull requests should explain what changed, why it is compatible with SEP-1, and how it was tested. Please avoid unrelated formatting or dependency changes.

## Reporting specification differences

Include the relevant SEP-1 section, a minimal `stellar.toml` example, the expected result, and the actual CLI output. Never include private keys, identity documents, wallet recovery phrases, or production credentials in an issue.

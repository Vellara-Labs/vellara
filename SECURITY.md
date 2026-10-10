# Security Policy

TrustMint includes Soroban contracts that demonstrate asset tokenization and compliance workflows. The code has not received an independent security audit. Treat this repository as experimental starter code; do not use it to custody real assets or funds without a qualified independent review and an approved operational and legal model.

## Report a vulnerability

Please do not disclose suspected vulnerabilities in public issues, discussions, or pull requests. Use [GitHub’s private vulnerability reporting](https://github.com/zeemscript/TrustMint/security/advisories/new). If private reporting is unavailable, contact the repository maintainer through [GitHub](https://github.com/zeemscript) and ask for a private reporting channel.

Include the affected contract or component, the commit or version, reproduction steps, impact, and any suggested mitigation. Do not include private keys, recovery phrases, customer information, or identity documents. Avoid testing against public deployments or accounts you do not control.

The maintainers will acknowledge reports and coordinate investigation and disclosure with the reporter. There is no published response-time guarantee; include a safe way to contact you for follow-up.

## Scope

This policy covers the TrustMint contracts, SDK, deployment tooling, and frontend maintained in this repository. Third-party dependency vulnerabilities should be reported to their respective maintainers. Reports about a live deployment should identify the network and contract IDs; do not include private keys, recovery phrases, or personal identity documents.

## Supported versions

| Version / ref | In scope | Notes |
|---|---|---|
| `main` (current, unreleased per [CHANGELOG](CHANGELOG.md)) | ✅ Supported | All security fixes land here |
| Any tagged release or fork | ❌ Unsupported | Older refs do not update automatically; operators must upgrade or redeploy |

## In-scope surfaces

- `contracts/*` — the six Soroban crates: `carbon-credit-token`, `compliance-engine`, `invoice-token`, `kyc-registry`, `property-token`, `rwa-token`
- `sdk/` — the client SDK
- `frontend/` — the web dashboard
- Deployment tooling maintained in this repository

Out of scope: third-party dependencies (report to their maintainers) and live deployments outside this repository (identify network and contract IDs when reporting).

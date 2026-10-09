# Contributing to TrustMint

Thanks for taking the time to improve TrustMint. The project is an early-stage Soroban starter kit, and contributions that make its contracts safer, examples clearer, or developer experience easier are welcome.

## Before you start

- Search [existing issues](https://github.com/zeemscript/TrustMint/issues) and pull requests to avoid duplicate work.
- For larger changes, contract interface or storage changes, and new features, open an issue first so the scope can be discussed.
- For a security vulnerability, do not open a public issue. Follow [SECURITY.md](SECURITY.md).

## Set up a local checkout

Requirements: Rust, the `wasm32v1-none` target, Stellar CLI, Node.js 20 or newer, and Docker for local integration tests.

```bash
git clone https://github.com/zeemscript/TrustMint.git
cd TrustMint
rustup target add wasm32v1-none
```

For contract changes, run the relevant checks from the repository root:

```bash
cargo fmt --all -- --check
cargo clippy --all --all-targets -- -D warnings
cargo test --features testutils
```

For dashboard changes:

```bash
cd frontend
npm install
npm run lint
npm run build
```

The dashboard needs contract IDs in `frontend/.env` for network-backed workflows. Copy [`frontend/.env.example`](frontend/.env.example) as a starting point. Never commit `.env` files, private keys, credentials, customer data, or personal identity documents.

## Make a focused change

1. Create a branch with a short descriptive name, such as `fix/expiry-check` or `docs/testnet-setup`.
2. Keep the change focused and explain the user or developer problem it addresses.
3. Add or update tests for behavior changes. For contract changes, cover authorization, state transitions, and expected failure cases where applicable.
4. Update documentation when commands, interfaces, setup steps, or user-visible behavior change.
5. Run the relevant checks and include the commands and outcomes in your pull request.

## Open a pull request

Include:

- A short summary of the change and why it is needed
- The contracts, SDK, dashboard, or docs affected
- Tests and checks you ran, including any that could not be run
- Any storage, interface, deployment, migration, or security implications
- Screenshots or a short recording for visible dashboard changes

Keep sample data fictional. Do not describe the code as audited, production-ready, or legally compliant unless that status has been independently established and documented.

## Areas where contributions help

- Soroban contract correctness and authorization coverage
- SEP-41 compatibility and SDK usability
- Integration tests for invoice, property, and carbon-credit lifecycles
- Testnet deployment and operator documentation
- Dashboard usability, accessibility, and responsive behavior

## Versioning

TrustMint uses Semantic Versioning for tagged contract-suite releases. Changes to public contract interfaces or persistent storage may affect deployed integrations and should be discussed before implementation. When preparing a release, update the relevant contract crate versions and document user-visible changes in [CHANGELOG.md](CHANGELOG.md).

## Community standards

Participation is governed by the [Code of Conduct](code-of-conduct.md). For security issues, use the private reporting process in [SECURITY.md](SECURITY.md).

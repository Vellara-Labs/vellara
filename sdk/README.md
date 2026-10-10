# TrustMint TypeScript SDK

The TrustMint SDK contains typed clients for calling the repository's Soroban examples from a TypeScript application. It currently covers the KYC registry, compliance engine, invoice token, property token, carbon-credit token, and RWA reference token.

> **Distribution status:** Repository source only; there is no public npm release. Build the local workspace using the repository instructions below.

The workspace package is named `@trustmint/sdk`. Its `files: ["dist"]` manifest entry describes the build output included in a package; this metadata does not establish an npm release.

## Build from this repository

The SDK is an npm workspace. From the repository root:

```bash
npm install
npm run build:sdk
```

The generated JavaScript and type declarations are written to `sdk/dist/` when built. The SDK expects the application to provide the Stellar SDK as a peer dependency.

## Create a client

Create a Soroban RPC server, then pass the contract ID, server, and matching network passphrase to a contract client:

```ts
import {
  InvoiceTokenClient,
  NETWORK_PASSPHRASES,
  createServer,
} from "@trustmint/sdk";

const network = "testnet";
const server = createServer(network);
const invoice = new InvoiceTokenClient(
  process.env.INVOICE_TOKEN_ID!,
  server,
  NETWORK_PASSPHRASES[network],
);

const invoiceId = "INV-0001"; // multi-invoice interface: every invoice method takes an invoice_id

const supply = await invoice.totalSupply(invoiceId);
console.log(supply);
```

Use contract IDs deployed to the same network as the RPC server. Do not place private keys or identity data in frontend environment variables. Transaction operations built by the SDK still need to be assembled into a transaction, signed by the appropriate account, and submitted using a wallet or signer you control.

## Available clients

| Client | Example operations |
| --- | --- |
| `KycRegistryClient` | Read holder approval and KYC records; build verifier operations. |
| `ComplianceEngineClient` | Read transfer policy and build admin policy operations. |
| `InvoiceTokenClient` | Multi-invoice interface: every invoice operation takes an `invoice_id`. Read token and invoice state; build issue, settle, redeem, transfer, and approval operations. |
| `PropertyTokenClient` | Read property metadata and share state; build property operations. |
| `CarbonTokenClient` | Read project and credit state; build issue, retire, and transfer operations. |
| `RwaTokenClient` | Read reference token metadata and balances; build token operations. |

Contract interfaces can change while the project is in early development. Check each client implementation and the matching contract before relying on a method.

These Soroban examples cover tokenized invoices, property shares, carbon credits, holder eligibility, and transfer policies. The [repository README](https://github.com/Vellara-Labs/vellara/blob/main/README.md) explains project status, setup, and security limitations.

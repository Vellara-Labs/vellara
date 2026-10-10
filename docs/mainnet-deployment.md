# Mainnet Readiness Guide

TrustMint currently provides a testnet deployment workflow and a mainnet readiness checklist. It does not provide an audited or production-certified mainnet release. Treat the contracts as starter code: do not deploy them for real assets or funds until your team has reviewed the implementation, completed an independent security assessment, and approved the legal and operational model.

## Current deployment scope

[scripts/deploy.sh](../scripts/deploy.sh) accepts a network through STELLAR_NETWORK and deploys five contracts: the KYC registry, compliance engine, invoice token, property token, and carbon-credit token. It writes those contract IDs to rontend/.env. It does not deploy the separate 
wa-token reference contract.

The asset metadata values are currently embedded as placeholders in the deployment script. Review and replace them before any deployment. The script overwrites rontend/.env; back up any configuration you need first.

For development, deploy to testnet first:

`ash
bash scripts/setup-identity.sh trustmint-dev
bash scripts/deploy.sh trustmint-dev
`

Do not change the network to mainnet as a shortcut to production. A testnet deployment is a development check, not evidence that a production deployment is safe.

## Deployment verification

Once contracts are deployed, verify the live deployment by running [scripts/verify-deployment.sh](../scripts/verify-deployment.sh):

`ash
bash scripts/verify-deployment.sh [identity-name]
`

The script inspects configuration variables loaded from rontend/.env:
- VITE_STELLAR_NETWORK (defaults to 	estnet if unset)
- VITE_KYC_REGISTRY_ID (required)
- VITE_COMPLIANCE_ENGINE_ID (required)
- VITE_INVOICE_TOKEN_ID (required)
- VITE_PROPERTY_TOKEN_ID (required)
- VITE_CARBON_TOKEN_ID (required)
- VITE_RWA_TOKEN_ID (optional reference contract)

These environment keys match rontend/.env.example.

> **Important Note on RWA Token Verification:**  
> Because scripts/deploy.sh does not deploy the separate 
wa-token reference contract, scripts/verify-deployment.sh requires VITE_RWA_TOKEN_ID to be explicitly set in order to verify it. If VITE_RWA_TOKEN_ID is unset, the verification run automatically degrades to checking only the five core deployed contracts. To fully verify all six contracts including RWA, ensure VITE_RWA_TOKEN_ID is populated with a valid deployed contract ID before executing the verification script.

## Readiness checklist

Before planning a production deployment, the project team should:

- Review the full source and build reproducible WASM artifacts from a known commit.
- Complete the contract tests and integration tests, and add coverage for the exact deployment configuration and asset lifecycle.
- Commission an independent Soroban security review and resolve its findings.
- Have qualified counsel review the asset structure, investor eligibility, jurisdictions, disclosures, and the off-chain KYC process.
- Define verifier onboarding, admin key custody, incident response, pause authority, and recovery procedures.
- Replace sample metadata with reviewed production values and verify every constructor argument.
- Run a deployment rehearsal on testnet from the exact source revision and record contract IDs and outcomes.
- Confirm the selected Stellar network, RPC endpoint, account funding, contract IDs, and frontend configuration with a second operator.
- Document how deployed contracts will be monitored and what action is possible if a key or policy is compromised.

## Admin and verifier responsibilities

The admin and verifier roles can affect minting, eligibility records, policy settings, and emergency controls. Separate duties where possible, use suitable key custody for the operational model, and test authorization and key-rotation procedures before production. TrustMint does not manage real-world identity data or replace legal/compliance operations.

## After an approved deployment

Record the source commit, optimized WASM hashes, network, contract IDs (recording all six IDs alongside the release notes), constructor values, and authorized operators. Verify the deployed state using scripts/verify-deployment.sh through read-only contract calls and independently confirm the results before enabling user workflows. Store production contract IDs in the appropriate deployment environment; never commit secret material or private identity data.

Consult the [Stellar developer documentation](https://developers.stellar.org/docs) for current network and Soroban operational guidance. Network endpoints and CLI behavior can change; use current official guidance when preparing an actual deployment.

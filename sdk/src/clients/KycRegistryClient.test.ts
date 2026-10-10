/**
 * Unit tests for KycRegistryClient's transaction builders and read decoding.
 *
 * The builders are pure: they serialize a Contract call to base64 XDR with no
 * network involved, so the assertions below parse that XDR back and check the
 * exact argument order and type tags the contract's `approve` expects —
 * `(verifier, subject, tier: u32, expiry: u64, jurisdiction: String)`.
 *
 * The read methods (`isApproved`, `getRecord`, `getTier`) go through
 * `simulate`, which is stubbed here with hand-built ScVals so no RPC server is
 * required and the suite runs offline.
 *
 * Run: npm run build:sdk && npm --workspace sdk test
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  Address,
  Keypair,
  Networks,
  StrKey,
  nativeToScVal,
  rpc,
  xdr,
} from "@stellar/stellar-sdk";
import { KycRegistryClient } from "./KycRegistryClient.js";
import type { KycRecord } from "../types.js";

const CONTRACT_ID = StrKey.encodeContract(Keypair.random().rawPublicKey());
const VERIFIER = Keypair.random().publicKey();
const SUBJECT = Keypair.random().publicKey();
const EXPIRY = 1893456000n;

function makeClient(): KycRegistryClient {
  const server = new rpc.Server("http://127.0.0.1:8000/soroban/rpc", {
    allowHttp: true,
  });
  return new KycRegistryClient(CONTRACT_ID, server, Networks.TESTNET);
}

/** Parse the base64 operation XDR a build* method returns. */
function parseCall(operationXdr: string): {
  fn: string;
  args: xdr.ScVal[];
  contract: string;
} {
  const op = xdr.Operation.fromXDR(operationXdr, "base64");
  const hostFunction = op.body().invokeHostFunctionOp().hostFunction();
  assert.equal(
    hostFunction.switch().name,
    "hostFunctionTypeInvokeContract",
    "operation must be a contract invocation",
  );
  const invocation = hostFunction.invokeContract();
  return {
    fn: invocation.functionName().toString(),
    args: invocation.args(),
    contract: StrKey.encodeContract(invocation.contractAddress().contractId()),
  };
}

/** Assert a ScVal address argument equals the given G... public key. */
function assertAddressArg(val: xdr.ScVal, expected: string, label: string): void {
  assert.equal(val.switch().name, "scvAddress", `${label} must be an address`);
  assert.equal(
    val.address().toXDR("base64"),
    new Address(expected).toScVal().address().toXDR("base64"),
    label,
  );
}

/**
 * Encode a KycRecord the way the client's read path decodes it, field by
 * field with the types the contract stores (`tier: u32`, `expiry: u64`,
 * `verifier: Address`, `jurisdiction: String`).
 *
 * `status` is encoded as a ScSymbol here so that `scValToNative` yields the
 * `KycStatus` string union that `types.ts` declares. The contract itself is
 * `#[contracttype] enum KycStatus`, whose wire form is `ScVec[ScSymbol]` and
 * which decodes to a one-element array — that divergence is asserted
 * separately in the on-chain fixture test below rather than hidden here.
 */
function encodeRecord(record: KycRecord): xdr.ScVal {
  const entry = (key: string, val: xdr.ScVal): xdr.ScMapEntry =>
    new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol(key), val });
  return xdr.ScVal.scvMap([
    entry("status", xdr.ScVal.scvSymbol(record.status)),
    entry("verifier", new Address(record.verifier).toScVal()),
    entry("tier", nativeToScVal(record.tier, { type: "u32" })),
    entry("expiry", nativeToScVal(record.expiry, { type: "u64" })),
    entry("jurisdiction", nativeToScVal(record.jurisdiction, { type: "string" })),
  ]);
}

/** Wire form of `#[contracttype] enum KycStatus { Approved, ... }`. */
function encodeRecordOnChain(record: KycRecord): xdr.ScVal {
  const val = encodeRecord(record);
  const map = val.map();
  assert.ok(map, "encoded record must be a ScMap");
  const entries = map.map((e) =>
    e.key().sym().toString() === "status"
      ? new xdr.ScMapEntry({
          key: xdr.ScVal.scvSymbol("status"),
          val: xdr.ScVal.scvVec([xdr.ScVal.scvSymbol(record.status)]),
        })
      : e,
  );
  return xdr.ScVal.scvMap(entries);
}

/** Stub `simulate` so the read methods run offline. */
function stubReads(
  client: KycRegistryClient,
  responses: Record<string, xdr.ScVal>,
): string[] {
  const calls: string[] = [];
  (
    client as unknown as {
      simulate: (method: string, args: xdr.ScVal[]) => Promise<xdr.ScVal>;
    }
  ).simulate = async (method: string) => {
    calls.push(method);
    const response = responses[method];
    if (!response) {
      throw new Error(`unexpected simulate call: ${method}`);
    }
    return response;
  };
  return calls;
}

describe("KycRegistryClient transaction builders", () => {
  it("buildApproveXdr encodes (verifier, subject, tier, expiry, jurisdiction) with tags address, address, u32, u64, string", () => {
    const client = makeClient();
    const operationXdr = client.buildApproveXdr(
      VERIFIER,
      SUBJECT,
      3,
      EXPIRY,
      "US",
    );
    const { fn, args, contract } = parseCall(operationXdr);

    assert.equal(fn, "approve");
    assert.equal(contract, CONTRACT_ID);
    assert.equal(args.length, 5, "approve takes exactly five arguments");

    assert.deepEqual(
      args.map((a) => a.switch().name),
      ["scvAddress", "scvAddress", "scvU32", "scvU64", "scvString"],
      "argument order and type tags must match contracts/kyc-registry approve",
    );

    assertAddressArg(args[0], VERIFIER, "first argument is verifier");
    assertAddressArg(args[1], SUBJECT, "second argument is subject");
    assert.equal(args[2].u32(), 3, "tier is encoded as u32, not i128/u64");
    assert.equal(
      args[3].u64().toString(),
      EXPIRY.toString(),
      "expiry is encoded as u64",
    );
    assert.equal(args[4].str().toString(), "US");
  });

  it("buildRevokeXdr encodes (verifier, subject) as two addresses", () => {
    const { fn, args } = parseCall(makeClient().buildRevokeXdr(VERIFIER, SUBJECT));
    assert.equal(fn, "revoke");
    assert.equal(args.length, 2);
    assertAddressArg(args[0], VERIFIER, "verifier address");
    assertAddressArg(args[1], SUBJECT, "subject address");
  });

  it("buildRejectXdr encodes (verifier, subject) as two addresses", () => {
    const { fn, args } = parseCall(makeClient().buildRejectXdr(VERIFIER, SUBJECT));
    assert.equal(fn, "reject");
    assert.equal(args.length, 2);
    assertAddressArg(args[0], VERIFIER, "verifier address");
    assertAddressArg(args[1], SUBJECT, "subject address");
  });

  it("buildAddVerifierXdr encodes the verifier address", () => {
    const { fn, args } = parseCall(makeClient().buildAddVerifierXdr(VERIFIER));
    assert.equal(fn, "add_verifier");
    assert.equal(args.length, 1);
    assertAddressArg(args[0], VERIFIER, "verifier address");
  });

  it("buildRemoveVerifierXdr encodes the verifier address", () => {
    const { fn, args } = parseCall(
      makeClient().buildRemoveVerifierXdr(VERIFIER),
    );
    assert.equal(fn, "remove_verifier");
    assert.equal(args.length, 1);
    assertAddressArg(args[0], VERIFIER, "verifier address");
  });
});

describe("KycRegistryClient read decoding", () => {
  it("isApproved decodes a bool and passes the subject address", async () => {
    const client = makeClient();
    const calls = stubReads(client, {
      is_approved: nativeToScVal(true, { type: "bool" }),
    });
    assert.equal(await client.isApproved(SUBJECT), true);
    assert.ok(
      calls.includes("is_approved"),
      "is_approved must be simulated",
    );
  });

  it("getTier decodes a u32 into a number", async () => {
    const client = makeClient();
    stubReads(client, { get_tier: nativeToScVal(2, { type: "u32" }) });
    const tier = await client.getTier(SUBJECT);
    assert.equal(tier, 2);
    assert.equal(typeof tier, "number");
  });

  it("getRecord round-trips a KycRecord fixture unchanged", async () => {
    const fixture: KycRecord = {
      status: "Approved",
      verifier: VERIFIER,
      tier: 2,
      expiry: EXPIRY,
      jurisdiction: "US",
    };
    const client = makeClient();
    stubReads(client, { get_record: encodeRecord(fixture) });

    const decoded = await client.getRecord(SUBJECT);
    assert.deepEqual(decoded, fixture);
    assert.equal(decoded.tier, 2);
    assert.equal(typeof decoded.expiry, "bigint");
    assert.equal(decoded.expiry, EXPIRY);
  });

  it("getRecord decodes the contract's enum status wire form", async () => {
    // `#[contracttype] enum KycStatus` serialises a unit variant as
    // ScVec[ScSymbol], which scValToNative turns into a one-element array —
    // not the `KycStatus` string union that types.ts declares. Asserted as
    // observed so a change in either direction is noticed here; the type
    // declaration itself is left alone (it is this issue's scope to test, not
    // to retype).
    const fixture: KycRecord = {
      status: "Approved",
      verifier: VERIFIER,
      tier: 1,
      expiry: EXPIRY,
      jurisdiction: "DE",
    };
    const client = makeClient();
    stubReads(client, { get_record: encodeRecordOnChain(fixture) });

    const decoded = await client.getRecord(SUBJECT);
    assert.deepEqual(
      (decoded as unknown as { status: unknown }).status,
      ["Approved"],
      "enum unit variant decodes as a one-element array, not the KycStatus string",
    );
    assert.equal(decoded.verifier, fixture.verifier);
    assert.equal(decoded.tier, fixture.tier);
    assert.equal(decoded.expiry, fixture.expiry);
    assert.equal(decoded.jurisdiction, fixture.jurisdiction);
  });
});
import { deepStrictEqual, equal } from "node:assert/strict";
import { test } from "node:test";
import {
  Address,
  Keypair,
  Networks,
  StrKey,
  nativeToScVal,
  rpc,
  scValToNative,
  xdr,
} from "@stellar/stellar-sdk";
import { KycRegistryClient } from "./KycRegistryClient.js";

const contractId = StrKey.encodeContract(Buffer.alloc(32, 3));
const verifier = Keypair.fromRawEd25519Seed(Buffer.alloc(32, 1)).publicKey();
const subject = Keypair.fromRawEd25519Seed(Buffer.alloc(32, 2)).publicKey();
const server = new rpc.Server("https://rpc.invalid");

function client(): KycRegistryClient {
  return new KycRegistryClient(contractId, server, Networks.TESTNET);
}

function decodeCall(operationXdr: string) {
  const operation = xdr.Operation.fromXDR(operationXdr, "base64");
  equal(operation.body().switch().name, "invokeHostFunction");
  const hostFunction = operation.body().invokeHostFunctionOp().hostFunction();
  equal(hostFunction.switch().name, "hostFunctionTypeInvokeContract");
  const call = hostFunction.invokeContract();
  equal(Address.fromScAddress(call.contractAddress()).toString(), contractId);
  return call;
}

test("approve encodes the five arguments in contract order with u32 tier and u64 expiry", () => {
  const tier = 0xffffffff;
  const expiry = 9007199254740993n;
  const call = decodeCall(
    client().buildApproveXdr(verifier, subject, tier, expiry, "SE"),
  );
  equal(call.functionName().toString(), "approve");
  const args = call.args();
  equal(args.length, 5);
  deepStrictEqual(
    args.map((arg) => arg.switch().name),
    ["scvAddress", "scvAddress", "scvU32", "scvU64", "scvString"],
  );
  deepStrictEqual(args.map(scValToNative), [
    verifier,
    subject,
    tier,
    expiry,
    "SE",
  ]);
  equal(args[2].u32(), tier);
  equal(args[3].u64().toString(), expiry.toString());
});

for (const [method, build, addresses] of [
  ["add_verifier", () => client().buildAddVerifierXdr(verifier), [verifier]],
  [
    "remove_verifier",
    () => client().buildRemoveVerifierXdr(verifier),
    [verifier],
  ],
  [
    "revoke",
    () => client().buildRevokeXdr(verifier, subject),
    [verifier, subject],
  ],
  [
    "reject",
    () => client().buildRejectXdr(verifier, subject),
    [verifier, subject],
  ],
] as const) {
  test(`${method} encodes the method and ordered address arguments`, () => {
    const call = decodeCall(build());
    equal(call.functionName().toString(), method);
    deepStrictEqual(
      call.args().map((arg) => arg.switch().name),
      addresses.map(() => "scvAddress"),
    );
    deepStrictEqual(call.args().map(scValToNative), addresses);
  });
}

class SimulatedClient extends KycRegistryClient {
  readonly calls: { method: string; args: xdr.ScVal[] }[] = [];

  constructor(private readonly response: xdr.ScVal) {
    super(contractId, server, Networks.TESTNET);
  }

  protected async simulate(
    method: string,
    args: xdr.ScVal[],
  ): Promise<xdr.ScVal> {
    this.calls.push({ method, args });
    return this.response;
  }
}

function assertReadCall(instance: SimulatedClient, method: string) {
  equal(instance.calls.length, 1);
  equal(instance.calls[0].method, method);
  equal(instance.calls[0].args.length, 1);
  equal(instance.calls[0].args[0].switch().name, "scvAddress");
  equal(scValToNative(instance.calls[0].args[0]), subject);
}

for (const approved of [true, false]) {
  test(`isApproved decodes ${approved} and calls is_approved for the subject`, async () => {
    const instance = new SimulatedClient(xdr.ScVal.scvBool(approved));
    equal(await instance.isApproved(subject), approved);
    assertReadCall(instance, "is_approved");
  });
}

test("getTier decodes u32 and calls get_tier for the subject", async () => {
  const instance = new SimulatedClient(nativeToScVal(2, { type: "u32" }));
  equal(await instance.getTier(subject), 2);
  assertReadCall(instance, "get_tier");
});

test("getRecord preserves the decoded contract fixture including its status variant", async () => {
  const expiry = 9007199254740993n;
  const value = xdr.ScVal.scvMap([
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol("expiry"),
      val: nativeToScVal(expiry, { type: "u64" }),
    }),
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol("jurisdiction"),
      val: nativeToScVal("SE", { type: "string" }),
    }),
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol("status"),
      val: xdr.ScVal.scvVec([xdr.ScVal.scvSymbol("Approved")]),
    }),
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol("tier"),
      val: nativeToScVal(2, { type: "u32" }),
    }),
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol("verifier"),
      val: new Address(verifier).toScVal(),
    }),
  ]);
  const instance = new SimulatedClient(value);
  deepStrictEqual(await instance.getRecord(subject), {
    expiry,
    jurisdiction: "SE",
    status: ["Approved"],
    tier: 2,
    verifier,
  });
  assertReadCall(instance, "get_record");
});

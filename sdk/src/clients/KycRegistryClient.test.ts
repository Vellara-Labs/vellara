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

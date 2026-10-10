import { deepStrictEqual, equal } from "node:assert/strict";
import { test } from "node:test";
import {
  Address,
  Networks,
  StrKey,
  nativeToScVal,
  rpc,
  scValToNative,
  xdr,
} from "@stellar/stellar-sdk";
import { RwaTokenClient } from "./RwaTokenClient.js";

// Synthetic public addresses only; no signing keys or network calls are needed.
const contractId = StrKey.encodeContract(Buffer.alloc(32, 3));
const registryId = StrKey.encodeContract(Buffer.alloc(32, 4));
const engineId = StrKey.encodeContract(Buffer.alloc(32, 5));
const from = StrKey.encodeEd25519PublicKey(Buffer.alloc(32, 11));
const to = StrKey.encodeEd25519PublicKey(Buffer.alloc(32, 12));
const spender = StrKey.encodeEd25519PublicKey(Buffer.alloc(32, 13));
const admin = StrKey.encodeEd25519PublicKey(Buffer.alloc(32, 14));
const server = new rpc.Server("https://rpc.invalid");
const amount = 9007199254740993n;

function client(): RwaTokenClient {
  return new RwaTokenClient(contractId, server, Networks.TESTNET);
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

class SimulatedClient extends RwaTokenClient {
  readonly calls: { method: string; args: xdr.ScVal[] }[] = [];

  constructor(private readonly response: xdr.ScVal) {
    super(contractId, server, Networks.TESTNET);
  }

  protected async simulate(method: string, args: xdr.ScVal[]): Promise<xdr.ScVal> {
    this.calls.push({ method, args });
    return this.response;
  }
}

type ReadCase = {
  name: string;
  method: string;
  invoke: (instance: SimulatedClient) => Promise<bigint | string | number>;
  response: xdr.ScVal;
  expected: bigint | string | number;
  args: readonly (string | bigint | number)[];
  tags: readonly string[];
};

const readCases: ReadCase[] = [
  {
    name: "balance", method: "balance", invoke: (c) => c.balance(from),
    response: nativeToScVal(amount, { type: "i128" }), expected: amount,
    args: [from], tags: ["scvAddress"],
  },
  {
    name: "totalSupply", method: "total_supply", invoke: (c) => c.totalSupply(),
    response: nativeToScVal(amount, { type: "i128" }), expected: amount,
    args: [], tags: [],
  },
  {
    name: "allowance", method: "allowance", invoke: (c) => c.allowance(from, spender),
    response: nativeToScVal(0n, { type: "i128" }), expected: 0n,
    args: [from, spender], tags: ["scvAddress", "scvAddress"],
  },
  {
    name: "name", method: "name", invoke: (c) => c.name(),
    response: nativeToScVal("Example asset", { type: "string" }), expected: "Example asset",
    args: [], tags: [],
  },
  {
    name: "symbol", method: "symbol", invoke: (c) => c.symbol(),
    response: nativeToScVal("DUMMY", { type: "string" }), expected: "DUMMY",
    args: [], tags: [],
  },
  {
    name: "decimals", method: "decimals", invoke: (c) => c.decimals(),
    response: nativeToScVal(7, { type: "u32" }), expected: 7,
    args: [], tags: [],
  },
  {
    name: "assetType", method: "asset_type", invoke: (c) => c.assetType(),
    response: nativeToScVal("invoice", { type: "string" }), expected: "invoice",
    args: [], tags: [],
  },
  {
    name: "kycRegistry", method: "kyc_registry", invoke: (c) => c.kycRegistry(),
    response: new Address(registryId).toScVal(), expected: registryId,
    args: [], tags: [],
  },
  {
    name: "complianceEngine", method: "compliance_engine", invoke: (c) => c.complianceEngine(),
    response: new Address(engineId).toScVal(), expected: engineId,
    args: [], tags: [],
  },
  {
    name: "getComplianceMetadata", method: "get_compliance_metadata",
    invoke: (c) => c.getComplianceMetadata("region"),
    response: nativeToScVal("SE", { type: "string" }), expected: "SE",
    args: ["region"], tags: ["scvSymbol"],
  },
];

for (const entry of readCases) {
  test(`${entry.name} decodes the response and encodes the exact contract call`, async () => {
    const instance = new SimulatedClient(entry.response);
    equal(await entry.invoke(instance), entry.expected);
    equal(instance.calls.length, 1);
    equal(instance.calls[0].method, entry.method);
    // Round-trip the actual encoded arguments, including the metadata Symbol tag.
    const args = instance.calls[0].args.map((arg) => xdr.ScVal.fromXDR(arg.toXDR()));
    deepStrictEqual(args.map((arg) => arg.switch().name), entry.tags);
    deepStrictEqual(args.map(scValToNative), entry.args);
  });
}

for (const [method, build, tags, values] of [
  ["mint", () => client().buildMintXdr(to, amount),
    ["scvAddress", "scvI128"], [to, amount]],
  ["transfer", () => client().buildTransferXdr(from, to, amount),
    ["scvAddress", "scvAddress", "scvI128"], [from, to, amount]],
  ["transfer_from", () => client().buildTransferFromXdr(spender, from, to, amount),
    ["scvAddress", "scvAddress", "scvAddress", "scvI128"], [spender, from, to, amount]],
  ["approve", () => client().buildApproveXdr(from, spender, amount, 0xffffffff),
    ["scvAddress", "scvAddress", "scvI128", "scvU32"], [from, spender, amount, 0xffffffff]],
  ["burn", () => client().buildBurnXdr(from, amount),
    ["scvAddress", "scvI128"], [from, amount]],
  ["burn_from", () => client().buildBurnFromXdr(spender, from, amount),
    ["scvAddress", "scvAddress", "scvI128"], [spender, from, amount]],
  ["set_admin", () => client().buildSetAdminXdr(admin),
    ["scvAddress"], [admin]],
  ["set_compliance_metadata", () => client().buildSetComplianceMetadataXdr("region", "SE"),
    ["scvSymbol", "scvString"], ["region", "SE"]],
] as const) {
  test(`${method} builder encodes ordered arguments with the contract's XDR types`, () => {
    const call = decodeCall(build());
    equal(call.functionName().toString(), method);
    deepStrictEqual(call.args().map((arg) => arg.switch().name), tags);
    deepStrictEqual(call.args().map(scValToNative), values);
  });
}

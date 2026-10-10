import { Address, nativeToScVal, rpc } from "@stellar/stellar-sdk";
import { BaseContractClient, scVal } from "./base.js";
import type { InvoiceMeta } from "../types.js";

export class InvoiceTokenClient extends BaseContractClient {
  constructor(contractId: string, server: rpc.Server, networkPassphrase: string) {
    super(contractId, server, networkPassphrase);
  }

  // ── Read API ─────────────────────────────────────────────────────────────

  async getMeta(): Promise<InvoiceMeta> {
    return scVal<InvoiceMeta>(await this.simulate("get_meta", []));
  }

  async balance(addr: string, invoice_id: string): Promise<bigint> {
    return scVal<bigint>(
      await this.simulate("balance", [
        new Address(addr).toScVal(),
        nativeToScVal(invoice_id, { type: "string" }),
      ]),
    );
  }

  async totalSupply(invoice_id: string): Promise<bigint> {
    return scVal<bigint>(
      await this.simulate("total_supply", [
        nativeToScVal(invoice_id, { type: "string" }),
      ]),
    );
  }

  async isSettled(invoice_id: string): Promise<boolean> {
    return scVal<boolean>(
      await this.simulate("is_settled", [
        nativeToScVal(invoice_id, { type: "string" }),
      ]),
    );
  }

  async allowance(
    from: string,
    spender: string,
    invoice_id: string,
  ): Promise<bigint> {
    return scVal<bigint>(
      await this.simulate("allowance", [
        new Address(from).toScVal(),
        new Address(spender).toScVal(),
        nativeToScVal(invoice_id, { type: "string" }),
      ]),
    );
  }

  async name(): Promise<string> {
    return scVal<string>(await this.simulate("name", []));
  }

  async symbol(): Promise<string> {
    return scVal<string>(await this.simulate("symbol", []));
  }

  async decimals(): Promise<number> {
    return scVal<number>(await this.simulate("decimals", []));
  }

  // ── Transaction builders (return operation XDR for signing) ───────────────

  buildIssueXdr(
    invoice_id: string,
    to: string,
    amount: bigint,
  ): string {
    return this.buildCallXdr("issue", [
      nativeToScVal(invoice_id, { type: "string" }),
      new Address(to).toScVal(),
      nativeToScVal(amount, { type: "i128" }),
    ]);
  }

  buildSettleXdr(invoice_id: string): string {
    return this.buildCallXdr("settle", [
      nativeToScVal(invoice_id, { type: "string" }),
    ]);
  }

  buildRedeemXdr(
    invoice_id: string,
    from: string,
    amount: bigint,
  ): string {
    return this.buildCallXdr("redeem", [
      nativeToScVal(invoice_id, { type: "string" }),
      new Address(from).toScVal(),
      nativeToScVal(amount, { type: "i128" }),
    ]);
  }

  buildTransferXdr(
    invoice_id: string,
    from: string,
    to: string,
    amount: bigint,
  ): string {
    return this.buildCallXdr("transfer", [
      nativeToScVal(invoice_id, { type: "string" }),
      new Address(from).toScVal(),
      new Address(to).toScVal(),
      nativeToScVal(amount, { type: "i128" }),
    ]);
  }

  buildTransferFromXdr(
    invoice_id: string,
    spender: string,
    from: string,
    to: string,
    amount: bigint,
  ): string {
    return this.buildCallXdr("transfer_from", [
      nativeToScVal(invoice_id, { type: "string" }),
      new Address(spender).toScVal(),
      new Address(from).toScVal(),
      new Address(to).toScVal(),
      nativeToScVal(amount, { type: "i128" }),
    ]);
  }

  buildApproveXdr(
    from: string,
    spender: string,
    invoice_id: string,
    amount: bigint,
    expirationLedger: number,
  ): string {
    return this.buildCallXdr("approve", [
      new Address(from).toScVal(),
      new Address(spender).toScVal(),
      nativeToScVal(invoice_id, { type: "string" }),
      nativeToScVal(amount, { type: "i128" }),
      nativeToScVal(expirationLedger, { type: "u32" }),
    ]);
  }

  buildUpdateMetaXdr(meta: InvoiceMeta): string {
    return this.buildCallXdr("update_meta", [nativeToScVal(meta)]);
  }
}

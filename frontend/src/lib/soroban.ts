import {
  Account,
  BASE_FEE,
  Contract,
  TransactionBuilder,
  nativeToScVal,
  scValToNative,
  rpc,
  xdr,
} from "@stellar/stellar-sdk";
import {
  ESCROW_CONTRACT,
  NETWORK_PASSPHRASE,
  RPC_URL,
  SIM_ACCOUNT,
} from "./config";

export type EscrowStageView = {
  label: string;
  value: bigint;
  state: "Secured" | "Disbursed" | "Returned";
};

export type ForgeDealView = {
  id: number;
  creator: string;
  provider: string;
  token_address: string;
  stages: EscrowStageView[];
  is_aborted: boolean;
  timestamp: bigint;
};

export function getServer() {
  return new rpc.Server(RPC_URL);
}

function stateOf(raw: unknown): EscrowStageView["state"] {
  if (typeof raw === "string") return raw as EscrowStageView["state"];
  if (Array.isArray(raw)) return String(raw[0]) as EscrowStageView["state"];
  return String(raw) as EscrowStageView["state"];
}

async function simulateRead(method: string, args: xdr.ScVal[]) {
  const server = getServer();
  const contract = new Contract(ESCROW_CONTRACT);
  const source = new Account(SIM_ACCOUNT, "0");
  const tx = new TransactionBuilder(source, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(60)
    .build();
  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) {
    throw new Error(sim.error);
  }
  const result = (sim as rpc.Api.SimulateTransactionSuccessResponse).result;
  if (!result) throw new Error("no result from simulation");
  return scValToNative(result.retval);
}

export async function totalDealsCount(): Promise<number> {
  const n = await simulateRead("total_deals_count", []);
  return Number(n);
}

export async function fetchDeal(id: number): Promise<ForgeDealView> {
  const raw = await simulateRead("fetch_deal", [
    nativeToScVal(BigInt(id), { type: "u64" }),
  ]);
  return {
    id,
    creator: raw.creator,
    provider: raw.provider,
    token_address: raw.token_address,
    is_aborted: raw.is_aborted,
    timestamp: raw.timestamp,
    stages: raw.stages.map(
      (s: { label: string; value: bigint; state: unknown }) => ({
        label: s.label,
        value: s.value,
        state: stateOf(s.state),
      })
    ),
  };
}

export async function fetchPayoutProgress(
  id: number
): Promise<{ disbursed: bigint; secured: bigint }> {
  const [disbursed, secured] = await simulateRead("fetch_payout_progress", [
    nativeToScVal(BigInt(id), { type: "u64" }),
  ]);
  return { disbursed, secured };
}

export async function listDealsFor(address: string): Promise<ForgeDealView[]> {
  const count = await totalDealsCount();
  const ids = Array.from({ length: count }, (_, i) => i);
  const all = await Promise.all(
    ids.map((id) => fetchDeal(id).catch(() => null))
  );
  return all.filter(
    (e): e is ForgeDealView =>
      e !== null && (e.creator === address || e.provider === address)
  );
}

export function buildForgeDealArgs(
  creator: string,
  provider: string,
  token_address: string,
  stages: { label: string; stroops: bigint }[]
): { method: string; args: xdr.ScVal[] } {
  return {
    method: "forge_deal",
    args: [
      nativeToScVal(creator, { type: "address" }),
      nativeToScVal(provider, { type: "address" }),
      nativeToScVal(token_address, { type: "address" }),
      xdr.ScVal.scvVec(
        stages.map((s) =>
          xdr.ScVal.scvVec([
            nativeToScVal(s.label, { type: "string" }),
            nativeToScVal(s.stroops, { type: "i128" }),
          ])
        )
      ),
    ],
  };
}

export function buildDisburseArgs(id: number, index: number) {
  return {
    method: "disburse_stage",
    args: [
      nativeToScVal(BigInt(id), { type: "u64" }),
      nativeToScVal(index, { type: "u32" }),
    ],
  };
}

export function buildAbortArgs(id: number) {
  return {
    method: "abort_deal",
    args: [nativeToScVal(BigInt(id), { type: "u64" })],
  };
}

export type SignFn = (xdrBase64: string) => Promise<string>;

/** Build, prepare, sign (via wallet), send and await a contract invocation. */
export async function invokeContract(
  publicKey: string,
  method: string,
  args: xdr.ScVal[],
  sign: SignFn
): Promise<string> {
  const server = getServer();
  const contract = new Contract(ESCROW_CONTRACT);
  const account = await server.getAccount(publicKey);
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(120)
    .build();

  const prepared = await server.prepareTransaction(tx);
  const signedXdr = await sign(prepared.toXDR());
  const signed = TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE);
  const sent = await server.sendTransaction(signed);
  if (sent.status === "ERROR") {
    throw new Error(`transaction submission failed: ${sent.errorResult}`);
  }

  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const res = await server.getTransaction(sent.hash);
    if (res.status === rpc.Api.GetTransactionStatus.SUCCESS) {
      return sent.hash;
    }
    if (res.status === rpc.Api.GetTransactionStatus.FAILED) {
      throw new Error("transaction failed on-chain");
    }
  }
  throw new Error("timed out waiting for transaction confirmation");
}

export type EscrowForgeEvent = {
  kind: "initiated" | "disbursed" | "aborted";
  escrowId: number;
  txHash: string;
  ledger: number;
  data: unknown[];
};

/**
 * Poll contract events within RPC retention. The RPC scans a bounded ledger
 * range per request, so we page forward with the cursor until caught up.
 */
export async function getForgeEvents(): Promise<EscrowForgeEvent[]> {
  const server = getServer();
  const latest = await server.getLatestLedger();
  const startLedger = Math.max(1, latest.sequence - 100_000);

  const events: EscrowForgeEvent[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < 15; page++) {
    const res = await server.getEvents({
      ...(cursor ? { cursor } : { startLedger }),
      filters: [{ type: "contract", contractIds: [ESCROW_CONTRACT] }],
      limit: 100,
    });
    for (const ev of res.events) {
      const topics = ev.topic.map((t) => scValToNative(t));
      if (topics[0] !== "forge") continue;
      const kind = topics[1] as EscrowForgeEvent["kind"];
      const data = scValToNative(ev.value) as unknown[];
      events.push({
        kind,
        escrowId: Number(Array.isArray(data) ? data[0] : data),
        txHash: ev.txHash,
        ledger: ev.ledger,
        data: Array.isArray(data) ? data : [data],
      });
    }
    if (!res.cursor) break;
    cursor = res.cursor;
  }
  return events.reverse(); // newest first
}

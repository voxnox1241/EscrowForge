"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@/lib/wallet";
import {
  buildForgeDealArgs,
  invokeContract,
  totalDealsCount,
} from "@/lib/soroban";
import { TOKEN_CONTRACT, xlmToStroops } from "@/lib/config";
import TxBanner, { TxState, isUserRejection, friendlyError } from "@/components/TxBanner";
import WalletNotFound from "@/components/errors/WalletNotFound";

type Row = { label: string; amount: string };

const FEE_HEADROOM_XLM = 2; // keep a little XLM for fees + reserves

export default function CreateEscrow() {
  const router = useRouter();
  const { address, balance, error, connect, signTx, refreshBalance } =
    useWallet();

  const [provider, setProvider] = useState("");
  const [rows, setRows] = useState<Row[]>([
    { label: "", amount: "" },
    { label: "", amount: "" },
  ]);
  const [tx, setTx] = useState<TxState>({ phase: "idle" });
  const [shortfall, setShortfall] = useState<string | null>(null);

  const total = useMemo(
    () =>
      rows.reduce((sum, r) => {
        const n = parseFloat(r.amount);
        return sum + (isNaN(n) ? 0 : n);
      }, 0),
    [rows]
  );

  if (error === "wallet-not-found") return <WalletNotFound />;

  if (!address) {
    return (
      <div className="mt-16 text-center max-w-md mx-auto glass-panel p-8">
        <p className="text-navy/80 font-medium">Connect a wallet to draft an agreement.</p>
        <button
          onClick={connect}
          className="btn-primary mt-6 px-6 py-2.5 text-sm font-semibold"
        >
          Connect Wallet
        </button>
      </div>
    );
  }

  const setRow = (i: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const valid =
    provider.startsWith("G") &&
    provider.length === 56 &&
    rows.length >= 2 &&
    rows.length <= 3 &&
    rows.every((r) => r.label.trim() && parseFloat(r.amount) > 0);

  const submit = async () => {
    setShortfall(null);
    const available = parseFloat(balance ?? "0");
    if (total + FEE_HEADROOM_XLM > available) {
      setShortfall(
        `This contract needs ${total} XLM plus ~${FEE_HEADROOM_XLM} XLM fee headroom, ` +
          `but the connected wallet holds ${available} XLM. ` +
          `Short by ${(total + FEE_HEADROOM_XLM - available).toFixed(2)} XLM.`
      );
      return;
    }

    setTx({ phase: "pending", label: "Initiating escrow agreement" });
    try {
      const { method, args } = buildForgeDealArgs(
        address,
        provider,
        TOKEN_CONTRACT,
        rows.map((r) => ({
          label: r.label.trim(),
          stroops: xlmToStroops(r.amount),
        }))
      );
      const hash = await invokeContract(address, method, args, signTx);
      setTx({ phase: "success", hash, label: "Escrow deal forged" });
      await refreshBalance();
      const count = await totalDealsCount();
      setTimeout(() => router.push(`/escrow/?id=${count - 1}`), 2500);
    } catch (e) {
      if (isUserRejection(e)) {
        setTx({ phase: "rejected" });
      } else {
        setTx({
          phase: "failed",
          message: friendlyError(e),
        });
      }
    }
  };

  return (
    <section className="mx-auto max-w-2xl px-4">
      {/* Background drift blob */}
      <div className="glow-blob w-[250px] h-[250px] bg-purple/15 right-10 top-20" />

      <div className="glass-panel p-6 sm:p-8 md:p-10">
        <p className="annotation mb-2 text-indigo">setup escrow / draft mode</p>
        <h1 className="font-display text-3xl font-extrabold text-navy">Forge Escrow Agreement</h1>
        <p className="mt-2 text-sm text-navy/80 leading-relaxed">
          Funds for all stages are deposited and locked into the contract now. 
          They are disbursed one stage at a time upon approval.
        </p>

        <div className="mt-8 space-y-6">
          <label className="block">
            <span className="annotation block mb-1">provider wallet address</span>
            <input
              value={provider}
              onChange={(e) => setProvider(e.target.value.trim())}
              placeholder="G…"
              className="w-full rounded-xl border border-white/40 bg-white/20 px-4 py-3 font-mono text-sm text-navy placeholder:text-indigo/50 focus:bg-white/40 focus:border-indigo/50 focus:outline-none transition-all duration-200"
            />
          </label>

          <div>
            <span className="annotation block mb-2">stages ({rows.length}/3)</span>
            <div className="space-y-3">
              {rows.map((r, i) => (
                <div key={i} className="flex flex-col gap-2 sm:flex-row">
                  <input
                    value={r.label}
                    onChange={(e) => setRow(i, { label: e.target.value })}
                    placeholder={`Stage ${i + 1} label (e.g. Design mockups)`}
                    className="flex-1 rounded-xl border border-white/40 bg-white/20 px-4 py-3 text-sm text-navy placeholder:text-indigo/50 focus:bg-white/40 focus:border-indigo/50 focus:outline-none transition-all duration-200"
                  />
                  <div className="flex gap-2">
                    <input
                      value={r.amount}
                      onChange={(e) => setRow(i, { amount: e.target.value })}
                      placeholder="Amount"
                      inputMode="decimal"
                      className="w-28 rounded-xl border border-white/40 bg-white/20 px-4 py-3 text-right font-mono text-sm text-navy placeholder:text-indigo/50 focus:bg-white/40 focus:border-indigo/50 focus:outline-none transition-all duration-200"
                    />
                    <span className="self-center annotation text-indigo/70 font-bold">XLM</span>
                    {rows.length > 2 && (
                      <button
                        onClick={() =>
                          setRows((rs) => rs.filter((_, j) => j !== i))
                        }
                        className="rounded-xl bg-red-100 hover:bg-red-200 text-red-600 border border-red-200 px-3 transition-colors duration-200"
                        aria-label="Remove stage"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {rows.length < 3 && (
              <button
                onClick={() => setRows((rs) => [...rs, { label: "", amount: "" }])}
                className="mt-4 btn-secondary px-4 py-2 text-xs font-semibold"
              >
                + Add Stage
              </button>
            )}
          </div>

          <div className="flex items-baseline justify-between border-t border-white/20 pt-5">
            <span className="annotation text-indigo">total to lock</span>
            <span className="font-display text-3xl font-extrabold text-navy">
              {total.toLocaleString()} <span className="text-lg">XLM</span>
            </span>
          </div>

          {shortfall && (
            <div className="rounded-xl border border-red-200 bg-red-100/40 p-4 text-sm text-red-800 backdrop-blur-sm">
              <p className="annotation text-red-600 mb-1">insufficient balance</p>
              <p className="font-medium">{shortfall}</p>
            </div>
          )}

          <TxBanner
            state={tx}
            onRetry={submit}
            onDismiss={() => setTx({ phase: "idle" })}
          />

          <button
            onClick={submit}
            disabled={!valid || tx.phase === "pending"}
            className="w-full btn-primary py-3.5 text-base font-semibold disabled:cursor-not-allowed disabled:opacity-50 transition-all"
          >
            {tx.phase === "pending" ? "Locking funds…" : "Lock Funds & Forge Agreement"}
          </button>
        </div>
      </div>
    </section>
  );
}

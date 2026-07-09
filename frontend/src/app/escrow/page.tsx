"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import { useWallet } from "@/lib/wallet";
import {
  fetchDeal,
  fetchPayoutProgress,
  buildDisburseArgs,
  buildAbortArgs,
  invokeContract,
} from "@/lib/soroban";
import { shortAddr, stroopsToXlm } from "@/lib/config";
import LuminousProgressTracker from "@/components/LuminousProgressTracker";
import ActivityFeed from "@/components/ActivityFeed";
import TxBanner, { TxState, isUserRejection, friendlyError } from "@/components/TxBanner";
import WalletNotFound from "@/components/errors/WalletNotFound";

function statusChip(state: string) {
  if (state === "Disbursed")
    return "bg-green-100 text-green-800 border-green-200";
  if (state === "Returned")
    return "border-dashed border-red-200 bg-red-50 text-red-700";
  return "bg-blue-100 text-blue-800 border-blue-200";
}

function EscrowDetail() {
  const params = useSearchParams();
  const id = Number(params.get("id") ?? "0");
  const { address, error, signTx, refreshBalance } = useWallet();
  const [tx, setTx] = useState<TxState>({ phase: "idle" });

  const { data: deal, mutate: refetchDeal } = useSWR(
    ["deal", id],
    () => fetchDeal(id),
    { refreshInterval: 5000 }
  );
  const { data: progress, mutate: refetchProgress } = useSWR(
    ["progress", id],
    () => fetchPayoutProgress(id),
    { refreshInterval: 5000 }
  );

  if (error === "wallet-not-found") return <WalletNotFound />;
  if (!deal) {
    return (
      <div className="text-center py-20">
        <p className="text-indigo animate-pulse font-semibold text-lg">Loading deal №{id}…</p>
      </div>
    );
  }

  const isCreator = address === deal.creator;
  const total = deal.stages.reduce((s, st) => s + st.value, 0n);
  const disbursed = progress?.disbursed ?? 0n;
  const secured = progress?.secured ?? total - disbursed;
  const anySecured = deal.stages.some((st) => st.state === "Secured");

  const run = async (
    label: string,
    build: () => { method: string; args: Parameters<typeof invokeContract>[2] }
  ) => {
    if (!address) return;
    setTx({ phase: "pending", label });
    try {
      const { method, args } = build();
      const hash = await invokeContract(address, method, args, signTx);
      setTx({ phase: "success", hash, label: `${label} confirmed` });
      await Promise.all([refetchDeal(), refetchProgress(), refreshBalance()]);
    } catch (e) {
      if (isUserRejection(e)) setTx({ phase: "rejected" });
      else
        setTx({
          phase: "failed",
          message: friendlyError(e),
        });
    }
  };

  return (
    <section className="px-4 max-w-3xl mx-auto relative">
      {/* Background drifts */}
      <div className="glow-blob w-[280px] h-[280px] bg-purple/15 left-10 top-10 animate-pulse" />
      <div className="glow-blob w-[220px] h-[220px] bg-blue/15 right-10 bottom-20" />

      <p className="annotation mb-2 text-center text-indigo/70 font-bold">
        agreement workspace · deal №{id}
        {deal.is_aborted ? " (aborted)" : ""}
      </p>

      {/* Hero Visualizer */}
      <div className="glass-panel p-6 sm:p-10 mb-8 flex flex-col items-center">
        <LuminousProgressTracker stages={deal.stages} />
        
        <div className="mt-4 text-center">
          <div className="text-navy">
            <span className="font-display text-5xl sm:text-6xl font-extrabold">
              {stroopsToXlm(disbursed)}
            </span>
            <span className="text-lg font-semibold uppercase tracking-wider text-indigo ml-2">XLM disbursed</span>
          </div>
          <div className="mt-2 text-indigo/80 text-sm font-semibold">
            <span className="font-mono text-base font-bold bg-white/20 px-2 py-0.5 rounded border border-white/25">{stroopsToXlm(secured)} XLM</span> secured
          </div>
        </div>

        <div className="w-full border-t border-white/10 mt-6 pt-5 flex flex-col gap-2 sm:flex-row sm:justify-between items-center text-xs text-navy/70">
          <div className="font-semibold">creator: <span className="font-mono text-navy font-bold">{shortAddr(deal.creator)}</span></div>
          <div className="font-semibold">provider: <span className="font-mono text-navy font-bold">{shortAddr(deal.provider)}</span></div>
        </div>
      </div>

      <div className="mb-6">
        <TxBanner state={tx} onDismiss={() => setTx({ phase: "idle" })} />
      </div>

      {/* Stages list */}
      <h2 className="annotation text-indigo mb-4 block font-bold">contract phases</h2>
      <div className="grid gap-4">
        {deal.stages.map((stage, i) => (
          <div
            key={i}
            className="flex flex-col gap-3 glass-panel p-5 sm:flex-row sm:items-center justify-between hover:bg-white/25 transition-all duration-200"
          >
            <div className="flex-1">
              <div className="annotation text-xs text-indigo/70 font-semibold mb-1">phase {i + 1}</div>
              <div className="font-bold text-navy text-lg">{stage.label}</div>
            </div>
            <div className="flex items-center gap-4 justify-between sm:justify-end">
              <div className="font-mono text-lg font-bold text-navy">
                {stroopsToXlm(stage.value)} <span className="text-xs font-bold text-indigo">XLM</span>
              </div>
              <span
                className={`rounded-lg border px-2.5 py-1 text-center text-xs font-bold ${statusChip(stage.state)}`}
              >
                {stage.state}
              </span>
              {isCreator && stage.state === "Secured" && !deal.is_aborted && (
                <button
                  onClick={() =>
                    run(`Phase ${i + 1} disbursement`, () =>
                      buildDisburseArgs(id, i)
                    )
                  }
                  disabled={tx.phase === "pending"}
                  className="btn-primary px-5 py-2 text-xs font-bold disabled:opacity-50"
                >
                  Disburse
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {isCreator && !deal.is_aborted && anySecured && (
        <div className="mt-8 text-right">
          <button
            onClick={() => run("Agreement termination", () => buildAbortArgs(id))}
            disabled={tx.phase === "pending"}
            className="text-xs font-bold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 px-5 py-3 rounded-xl transition-all duration-200"
          >
            Abort Agreement & Refund Locked Funds
          </button>
        </div>
      )}

      {/* Live activity log */}
      <div className="mt-12">
        <h2 className="annotation text-indigo mb-4 block font-bold">activity log</h2>
        <div className="glass-panel p-6">
          <ActivityFeed escrowId={id} />
        </div>
      </div>
    </section>
  );
}

export default function EscrowPage() {
  return (
    <Suspense
      fallback={
        <div className="text-center py-20">
          <p className="text-indigo animate-pulse font-semibold text-lg">Loading workspace…</p>
        </div>
      }
    >
      <EscrowDetail />
    </Suspense>
  );
}

"use client";

import Link from "next/link";
import useSWR from "swr";
import { useWallet } from "@/lib/wallet";
import { listDealsFor } from "@/lib/soroban";
import { shortAddr, stroopsToXlm } from "@/lib/config";
import WalletNotFound from "@/components/errors/WalletNotFound";

export default function Home() {
  const { address, error, connect } = useWallet();

  const { data: deals, isLoading } = useSWR(
    address ? ["deals", address] : null,
    () => listDealsFor(address as string),
    { refreshInterval: 10_000 }
  );

  if (error === "wallet-not-found") return <WalletNotFound />;

  if (!address) {
    return (
      <section className="relative mt-12 sm:mt-16 max-w-3xl mx-auto text-center px-4">
        {/* Glow blobs behind landing content */}
        <div className="glow-blob w-[300px] h-[300px] bg-purple/30 left-1/4 top-10" />
        <div className="glow-blob w-[250px] h-[250px] bg-blue/30 right-1/4 bottom-10" />

        <div className="glass-panel p-8 sm:p-12 md:p-16">
          <p className="annotation mb-4 text-indigo">secure agreement engine</p>
          <h1 className="font-display text-4xl sm:text-5xl font-extrabold tracking-tight text-navy leading-tight">
            Your money, <br />
            beautifully managed.
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-base text-navy/80 leading-relaxed">
            EscrowForge locks a project&apos;s budget into an on-chain smart contract, split
            across stages. The client disburses each stage as work lands, paying the
            provider instantly the moment it is approved.
          </p>
          <button
            onClick={connect}
            className="btn-primary mt-8 px-8 py-3.5 text-base font-semibold"
          >
            Connect Wallet to Begin
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="relative mt-4 px-4">
      {/* Background drifts */}
      <div className="glow-blob w-[200px] h-[200px] bg-purple/20 left-10 top-20" />
      
      <div className="mb-8 flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="font-display text-3xl font-extrabold text-navy">Your Agreements</h1>
        <span className="annotation text-indigo bg-white/20 px-3 py-1 rounded-lg border border-white/35">
          as {shortAddr(address)}
        </span>
      </div>

      {isLoading && (
        <div className="text-center py-12">
          <p className="text-indigo animate-pulse font-semibold">Surveying the chain…</p>
        </div>
      )}

      {deals && deals.length === 0 && (
        <div className="glass-panel p-10 text-center max-w-xl mx-auto">
          <p className="text-navy/80 font-medium">No escrow agreements involve this address yet.</p>
          <Link
            href="/create"
            className="btn-primary mt-6 inline-block px-6 py-3 text-sm font-semibold"
          >
            Forge Your First Deal
          </Link>
        </div>
      )}

      {deals && deals.length > 0 && (
        <ul className="grid gap-6 sm:grid-cols-2">
          {deals.map((deal) => {
            const total = deal.stages.reduce((s, st) => s + st.value, 0n);
            const disbursed = deal.stages
              .filter((st) => st.state === "Disbursed")
              .reduce((s, st) => s + st.value, 0n);
            const role = deal.creator === address ? "creator" : "provider";
            return (
              <li key={deal.id} className="transition-all">
                <Link
                  href={`/escrow/?id=${deal.id}`}
                  className="block glass-panel p-6 hover:bg-white/35 hover:border-white/70 hover:-translate-y-1 transition-all duration-200"
                >
                  <div className="flex items-baseline justify-between mb-4">
                    <span className="font-display text-xl font-bold text-navy">
                      Deal №{deal.id}
                    </span>
                    <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${
                      role === "creator" 
                        ? "bg-purple-100 text-purple-700 border-purple-200" 
                        : "bg-blue-100 text-blue-700 border-blue-200"
                    }`}>
                      {role}
                    </span>
                  </div>
                  <div className="text-sm text-navy/85 space-y-1">
                    <div className="font-semibold">
                      {stroopsToXlm(disbursed)} / {stroopsToXlm(total)} XLM disbursed
                    </div>
                    <div className="text-xs text-indigo/70 font-semibold uppercase tracking-wider">
                      {deal.stages.length} stages {deal.is_aborted ? " · cancelled" : ""}
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

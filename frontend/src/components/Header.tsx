"use client";

import Link from "next/link";
import { useWallet } from "@/lib/wallet";
import { shortAddr } from "@/lib/config";

export default function Header() {
  const { address, balance, connecting, connect, disconnect } = useWallet();

  return (
    <header className="sticky top-0 z-50 w-full bg-white/10 backdrop-blur-md border-b border-white/20">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3 px-4 py-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 group">
          <span className="font-display text-2xl font-bold tracking-tight text-navy group-hover:text-indigo transition-colors duration-200">
            EscrowForge
          </span>
          <span className="annotation hidden sm:inline text-indigo/70 mt-1">
            · secure contracts
          </span>
        </Link>
        
        <nav className="ml-auto flex items-center gap-4">
          <Link
            href="/create"
            className="btn-secondary px-4 py-2 text-sm flex items-center gap-1.5"
          >
            <span className="text-base font-bold leading-none">+</span> New contract
          </Link>
          
          {address ? (
            <div className="flex items-center gap-3 bg-white/10 px-3 py-1.5 rounded-xl border border-white/25">
              <div className="text-right">
                <div className="font-mono text-xs font-semibold text-navy">
                  {shortAddr(address)}
                </div>
                <div className="text-[10px] uppercase tracking-wider font-bold text-indigo">
                  {balance !== null ? `${parseFloat(balance).toFixed(2)} XLM` : "loading…"}
                </div>
              </div>
              <button
                onClick={disconnect}
                className="text-xs font-semibold text-red-600 hover:text-red-700 bg-white/30 hover:bg-white/50 px-2.5 py-1.5 rounded-lg transition-all duration-200"
              >
                Disconnect
              </button>
            </div>
          ) : (
            <button
              onClick={connect}
              disabled={connecting}
              className="btn-primary px-5 py-2 text-sm font-semibold disabled:opacity-60"
            >
              {connecting ? "Connecting…" : "Connect wallet"}
            </button>
          )}
        </nav>
      </div>
    </header>
  );
}

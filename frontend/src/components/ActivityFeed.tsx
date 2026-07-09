"use client";

import useSWR from "swr";
import { getForgeEvents, EscrowForgeEvent } from "@/lib/soroban";
import { EXPLORER_TX, stroopsToXlm } from "@/lib/config";

function describe(ev: EscrowForgeEvent): string {
  if (ev.kind === "initiated") {
    const total = ev.data[3] as bigint;
    return `Deal №${ev.escrowId} initiated — ${stroopsToXlm(total)} XLM secured`;
  }
  if (ev.kind === "disbursed") {
    const index = Number(ev.data[1]);
    const amount = ev.data[2] as bigint;
    return `Phase ${index + 1} disbursed — ${stroopsToXlm(amount)} XLM paid`;
  }
  const refunded = ev.data[1] as bigint;
  return `Deal №${ev.escrowId} aborted — ${stroopsToXlm(refunded)} XLM returned`;
}

export default function ActivityFeed({ escrowId }: { escrowId?: number }) {
  const { data: events, error } = useSWR("forge-events", getForgeEvents, {
    refreshInterval: 5000,
  });

  const rows =
    escrowId === undefined
      ? events
      : events?.filter((e: EscrowForgeEvent) => e.escrowId === escrowId);

  return (
    <div>
      <div className="flex items-baseline justify-between border-b border-white/20 pb-3 mb-2">
        <h2 className="font-display text-xl font-bold text-navy">Agreement Log</h2>
        <span className="annotation text-indigo/70">live · 5s poll</span>
      </div>
      
      {error && (
        <p className="mt-4 text-sm text-navy/70">
          Could not load events right now — retrying automatically.
        </p>
      )}
      
      {rows && rows.length === 0 && (
        <p className="mt-4 text-sm text-navy/60">
          No on-chain events in the recent ledger window.
        </p>
      )}
      
      <ul className="divide-y divide-white/10">
        {rows?.map((ev: EscrowForgeEvent) => (
          <li
            key={ev.txHash + ev.kind}
            className="flex flex-col gap-2 py-3.5 text-sm sm:flex-row sm:items-center sm:justify-between"
          >
            <span>
              <span
                className={`font-semibold ${
                  ev.kind === "disbursed"
                    ? "text-green-700"
                    : ev.kind === "aborted"
                    ? "text-red-600"
                    : "text-navy"
                }`}
              >
                {describe(ev)}
              </span>
            </span>
            <a
              href={`${EXPLORER_TX}${ev.txHash}`}
              target="_blank"
              rel="noreferrer"
              className="annotation text-xs bg-white/25 hover:bg-white/40 px-2.5 py-1 rounded border border-white/30 text-indigo flex items-center gap-1 transition-colors self-start sm:self-auto"
            >
              {ev.txHash.slice(0, 8)}… <span className="opacity-60">L{ev.ledger}</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

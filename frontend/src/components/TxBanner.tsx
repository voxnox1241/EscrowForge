"use client";

import { EXPLORER_TX } from "@/lib/config";

export type TxState =
  | { phase: "idle" }
  | { phase: "pending"; label: string }
  | { phase: "success"; hash: string; label: string }
  | { phase: "rejected" }
  | { phase: "failed"; message: string };

export default function TxBanner({
  state,
  onRetry,
  onDismiss,
}: {
  state: TxState;
  onRetry?: () => void;
  onDismiss?: () => void;
}) {
  if (state.phase === "idle") return null;

  if (state.phase === "pending") {
    return (
      <div className="glass-panel bg-white/30 px-4 py-3 text-sm text-navy font-medium flex items-center gap-2.5">
        <span className="inline-block h-4.5 w-4.5 animate-spin rounded-full border-2 border-indigo border-t-transparent align-middle" />
        <span>{state.label} — waiting for on-chain confirmation…</span>
      </div>
    );
  }

  if (state.phase === "success") {
    return (
      <div className="glass-panel border-green-300 bg-green-100/10 px-4 py-3 text-sm text-green-800 flex flex-wrap items-center gap-2">
        <span className="font-bold">✓ {state.label}.</span>{" "}
        <a
          href={`${EXPLORER_TX}${state.hash}`}
          target="_blank"
          rel="noreferrer"
          className="font-mono text-xs underline decoration-dotted text-green-700 hover:text-green-800"
        >
          {state.hash.slice(0, 10)}…{state.hash.slice(-10)}
        </a>{" "}
        <span className="annotation text-[10px] text-green-600 font-bold">Stellar Explorer</span>
        {onDismiss && (
          <button onClick={onDismiss} className="ml-auto annotation text-[10px] text-indigo underline">
            dismiss
          </button>
        )}
      </div>
    );
  }

  if (state.phase === "rejected") {
    return (
      <div className="glass-panel border-dashed border-red-300 bg-red-100/10 p-5 text-sm">
        <p className="annotation text-red-600 mb-1">error / no. 02 — signature declined</p>
        <p className="text-navy font-medium">
          The transaction signature was declined in your wallet browser extension. 
          No operations were submitted to the ledger — your assets remain untouched.
        </p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="mt-3 btn-secondary px-4 py-1.5 text-xs font-bold border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
          >
            Try Again
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="glass-panel border-dashed border-red-300 bg-red-100/10 p-5 text-sm">
      <p className="annotation text-red-600 mb-1">transaction failed</p>
      <p className="text-navy font-medium">{state.message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-3 btn-secondary px-4 py-1.5 text-xs font-bold border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
        >
          Try Again
        </button>
      )}
    </div>
  );
}

export { isUserRejection, friendlyError } from "@/lib/errors";

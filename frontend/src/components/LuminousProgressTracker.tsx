"use client";

import { motion } from "framer-motion";
import type { EscrowStageView } from "@/lib/soroban";

export default function LuminousProgressTracker({
  stages,
}: {
  stages: EscrowStageView[];
}) {
  const n = stages.length;
  const cx = 200;
  const cy = 180;
  const rOuter = 150;
  const rInner = 115;
  const gapDeg = 4;
  const span = 180 / n;

  const getSegmentPath = (i: number) => {
    const a0 = 180 - i * span - gapDeg / 2;
    const a1 = 180 - (i + 1) * span + gapDeg / 2;
    const rad = (d: number) => (d * Math.PI) / 180;
    const p = (r: number, d: number) => [
      cx + r * Math.cos(rad(d)),
      cy - r * Math.sin(rad(d)),
    ];
    const [x0, y0] = p(rOuter, a0);
    const [x1, y1] = p(rOuter, a1);
    const [x2, y2] = p(rInner, a1);
    const [x3, y3] = p(rInner, a0);
    return `M ${x0} ${y0} A ${rOuter} ${rOuter} 0 0 1 ${x1} ${y1} L ${x2} ${y2} A ${rInner} ${rInner} 0 0 0 ${x3} ${y3} Z`;
  };

  return (
    <div className="relative mx-auto w-full max-w-md pb-4 pt-6">
      {/* Luminous background glow behind the arch */}
      <div className="absolute left-1/2 top-1/2 -z-10 h-44 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-400/20 blur-[50px] pointer-events-none" />

      <svg
        viewBox="0 0 400 210"
        role="img"
        aria-label="Escrow deal progress tracker"
        className="mx-auto w-full filter drop-shadow-sm"
      >
        <defs>
          {/* Luminous purple/blue gradient for disbursed stages */}
          <linearGradient id="disbursedGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#8b5cf6" />
            <stop offset="100%" stopColor="#3b82f6" />
          </linearGradient>

          {/* Glow filter for active disbursed states */}
          <filter id="neonGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {stages.map((stage, i) => {
          const disbursed = stage.state === "Disbursed";
          const returned = stage.state === "Returned";
          return (
            <g key={i}>
              {/* Backing glass layer */}
              <path
                d={getSegmentPath(i)}
                fill="rgba(255, 255, 255, 0.15)"
                stroke="rgba(255, 255, 255, 0.3)"
                strokeWidth="1"
              />

              {/* Luminous front fill layer */}
              <motion.path
                d={getSegmentPath(i)}
                initial={false}
                animate={{
                  fill: disbursed
                    ? "url(#disbursedGrad)"
                    : returned
                    ? "transparent"
                    : "rgba(255, 255, 255, 0.05)",
                  opacity: disbursed ? 1 : returned ? 0.25 : 0.8,
                }}
                transition={{ duration: 0.8, ease: "easeInOut" }}
                stroke={
                  disbursed
                    ? "rgba(167, 139, 250, 0.8)"
                    : returned
                    ? "rgba(239, 68, 68, 0.4)"
                    : "rgba(255, 255, 255, 0.45)"
                }
                strokeWidth="1.2"
                strokeDasharray={returned ? "4 3" : undefined}
                filter={disbursed ? "url(#neonGlow)" : undefined}
              />
            </g>
          );
        })}

        {/* Ambient base line */}
        <line
          x1="30"
          y1="184"
          x2="370"
          y2="184"
          stroke="rgba(255, 255, 255, 0.4)"
          strokeWidth="1.5"
        />
        <line
          x1="30"
          y1="187"
          x2="370"
          y2="187"
          stroke="rgba(255, 255, 255, 0.15)"
          strokeWidth="1"
        />
      </svg>
    </div>
  );
}

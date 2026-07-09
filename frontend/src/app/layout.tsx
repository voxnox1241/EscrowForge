import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { WalletProvider } from "@/lib/wallet";
import Header from "@/components/Header";

const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "EscrowForge — Secure Milestone Escrows on Stellar",
  description:
    "Secure, milestone-based escrow contracts on Stellar Soroban testnet.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${geistMono.variable} antialiased min-h-screen relative`}>
        {/* Global ambient background light blobs */}
        <div className="fixed inset-0 -z-50 overflow-hidden pointer-events-none">
          <div className="glow-blob w-[500px] h-[500px] bg-indigo-300/30 -left-24 -top-24" />
          <div className="glow-blob w-[550px] h-[550px] bg-purple-300/35 -right-36 top-1/4" />
          <div className="glow-blob w-[400px] h-[400px] bg-pink-300/25 left-1/4 -bottom-12" />
        </div>

        <WalletProvider>
          <Header />
          <main className="mx-auto max-w-5xl px-4 pb-24 pt-8 sm:px-6">
            {children}
          </main>
          <footer className="border-t border-white/10 py-8 text-center annotation text-[10px] text-indigo/60 backdrop-blur-sm bg-white/5">
            EscrowForge — Stellar Soroban testnet · forged in code
          </footer>
        </WalletProvider>
      </body>
    </html>
  );
}

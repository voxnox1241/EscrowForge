export default function WalletNotFound() {
  return (
    <div className="mx-auto mt-16 max-w-md glass-panel border-dashed border-red-300 bg-red-100/10 p-8 text-center backdrop-blur-sm">
      <p className="annotation text-red-600 mb-2">error / no. 01 — wallet not found</p>
      <h2 className="font-display text-2xl font-extrabold text-navy">
        No Stellar Wallet Detected
      </h2>
      <p className="mt-3 text-sm text-navy/80 leading-relaxed">
        EscrowForge needs a browser wallet to sign transactions. Please install Freighter,
        then reload this page to connect.
      </p>
      <a
        href="https://www.freighter.app/"
        target="_blank"
        rel="noreferrer"
        className="btn-primary mt-6 inline-block px-6 py-2.5 text-sm font-semibold"
      >
        Install Freighter
      </a>
    </div>
  );
}

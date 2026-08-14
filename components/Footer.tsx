import Link from "next/link";
import { Leaf, ExternalLink } from "lucide-react";

const GROWER_LINKS = [
  { label: "Explore Parcels", href: "/explore" },
  { label: "My Listings", href: "/mylistings" },
  { label: "Profile", href: "/profile" },
  { label: "Disaster Aid", href: "/aid" },
];

const MARKET_LINKS = [
  { label: "Marketplace", href: "/marketplace" },
  { label: "Dashboard", href: "/dashboard" },
  { label: "Orders", href: "/order" },
];

export default function Footer() {
  return (
    <footer className="relative border-t border-emerald-950/10 bg-stone-950 text-stone-200">
      {/* Top accent line */}
      <div className="h-px w-full bg-gradient-to-r from-transparent via-farm-500/50 to-transparent" />

      <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.4fr_1fr_1fr] lg:px-8">
        {/* Brand */}
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-farm-500 to-farm-700 text-white shadow-sm">
              <Leaf size={18} />
            </div>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-lime-200">
              CropTrust
            </p>
          </div>
          <p className="mt-4 max-w-md text-sm leading-6 text-stone-400">
            A Soroban-based agricultural reservation model where crop NFTs, XLM escrow,
            and satellite verification create a market farmers and buyers can audit end to end.
          </p>
          <a
            href="https://github.com/rylsherdamz-rgb/agri-con"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 inline-flex items-center gap-2 rounded-lg border border-stone-800 bg-stone-900 px-3 py-1.5 text-xs font-medium text-stone-300 transition hover:border-farm-600/60 hover:text-lime-200"
          >
            <ExternalLink size={14} /> View source
          </a>
        </div>

        {/* Grower links */}
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-stone-500">Grower</p>
          <ul className="mt-4 space-y-2.5 text-sm">
            {GROWER_LINKS.map(({ label, href }) => (
              <li key={href}>
                <Link className="text-stone-400 transition hover:text-lime-200" href={href}>
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Market links */}
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-stone-500">Market</p>
          <ul className="mt-4 space-y-2.5 text-sm">
            {MARKET_LINKS.map(({ label, href }) => (
              <li key={href}>
                <Link className="text-stone-400 transition hover:text-lime-200" href={href}>
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-stone-800/80">
        <div className="mx-auto flex w-full max-w-7xl flex-col items-center justify-between gap-3 px-4 py-5 text-xs text-stone-500 sm:flex-row sm:px-6 lg:px-8">
          <p>&copy; {new Date().getFullYear()} CropTrust. Built on Stellar.</p>
          <span className="inline-flex items-center gap-2">
            <span className="h-2 w-2 animate-pulse rounded-full bg-farm-400" />
            <span className="font-medium text-stone-400">Stellar Testnet</span>
          </span>
        </div>
      </div>
    </footer>
  );
}

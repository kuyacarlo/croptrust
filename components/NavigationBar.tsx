"use client";

import ConnectWallet from "@/components/ConnectWallet";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Leaf,
  Home,
  Store,
  Map,
  User,
  List,
  ShieldAlert,
  BarChart3,
  Menu,
  X,
  ChevronRight,
} from "lucide-react";

const FARMER_LINKS = [
  { label: "Explore", href: "/explore", icon: Map },
  { label: "My Listings", href: "/mylistings", icon: List },
  { label: "Verify", href: "/verify", icon: ShieldAlert },
  { label: "Aid", href: "/aid", icon: ShieldAlert },
  { label: "Profile", href: "/profile", icon: User },
];

const BUYER_LINKS = [
  { label: "Marketplace", href: "/marketplace", icon: Store },
  { label: "Dashboard", href: "/dashboard", icon: BarChart3 },
];

export default function NavigationBar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (href: string) => pathname === href || (href !== "/" && pathname.startsWith(href));

  return (
    <header className="sticky top-0 z-30 border-b border-farm-200/40 bg-white/80 shadow-[0_1px_0_rgba(20,83,45,0.04)] backdrop-blur-xl supports-[backdrop-filter]:bg-white/65">
      <div className="mx-auto flex w-full max-w-7xl items-center gap-4 px-4 py-2.5 sm:px-6">
        {/* Brand */}
        <Link href="/" className="group flex shrink-0 items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-farm-700 to-farm-900 text-white shadow-sm shadow-farm-900/25 ring-1 ring-farm-900/10 transition duration-200 group-hover:shadow-md group-hover:shadow-farm-900/30 group-hover:-translate-y-0.5">
            <Leaf size={18} />
          </div>
          <span className="hidden items-center gap-2 sm:flex">
            <span className="text-base font-bold tracking-tight text-stone-900">CropTrust</span>
            <span className="rounded-full bg-farm-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-farm-700 ring-1 ring-farm-200">
              Testnet
            </span>
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden flex-1 items-center justify-center gap-0.5 lg:flex">
          <NavLink href="/" active={isActive("/")} icon={Home}>
            Home
          </NavLink>

          <Divider />

          <span className="mx-1 select-none text-[10px] font-bold uppercase tracking-widest text-stone-300">
            Grower
          </span>
          {FARMER_LINKS.map(({ label, href, icon }) => (
            <NavLink key={href} href={href} active={isActive(href)} icon={icon}>
              {label}
            </NavLink>
          ))}

          <Divider />

          <span className="mx-1 select-none text-[10px] font-bold uppercase tracking-widest text-stone-300">
            Market
          </span>
          {BUYER_LINKS.map(({ label, href, icon }) => (
            <NavLink key={href} href={href} active={isActive(href)} icon={icon}>
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Right side */}
        <div className="ml-auto flex items-center gap-2">
          {/* Mobile toggle */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="rounded-lg p-2 text-stone-600 transition hover:bg-stone-100 active:scale-95 lg:hidden"
            aria-label="Toggle menu"
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <ConnectWallet />
        </div>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 z-20 bg-black/20 backdrop-blur-sm lg:hidden"
            onClick={() => setMobileOpen(false)}
          />
          <div className="fixed left-0 right-0 top-[53px] z-20 mx-2 rounded-2xl border border-stone-200 bg-white shadow-xl lg:hidden animate-in slide-in-from-top-2 duration-200">
            <div className="px-4 py-3">
              {/* Home */}
              <MobileLink href="/" active={isActive("/")} icon={Home} onClick={() => setMobileOpen(false)}>
                Home
              </MobileLink>

              <div className="my-2 border-t border-stone-100" />

              <p className="mb-1 px-3 text-[10px] font-bold uppercase tracking-widest text-stone-400">
                Grower
              </p>
              {FARMER_LINKS.map(({ label, href, icon }) => (
                <MobileLink
                  key={href}
                  href={href}
                  active={isActive(href)}
                  icon={icon}
                  onClick={() => setMobileOpen(false)}
                >
                  {label}
                </MobileLink>
              ))}

              <div className="my-2 border-t border-stone-100" />

              <p className="mb-1 px-3 text-[10px] font-bold uppercase tracking-widest text-stone-400">
                Market
              </p>
              {BUYER_LINKS.map(({ label, href, icon }) => (
                <MobileLink
                  key={href}
                  href={href}
                  active={isActive(href)}
                  icon={icon}
                  onClick={() => setMobileOpen(false)}
                >
                  {label}
                </MobileLink>
              ))}
            </div>
          </div>
        </>
      )}
    </header>
  );
}

function Divider() {
  return <div className="mx-1.5 h-5 w-px bg-stone-200" />;
}

type IconComponent = React.ComponentType<{ size?: number; className?: string }>;

function NavLink({
  href,
  active,
  icon: Icon,
  children,
}: {
  href: string;
  active: boolean;
  icon?: IconComponent;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`group relative flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-150 ${
        active
          ? "bg-farm-50 text-farm-800 ring-1 ring-farm-200/70"
          : "text-stone-500 hover:bg-stone-50 hover:text-stone-800"
      }`}
    >
      {Icon ? (
        <Icon
          size={15}
          className={active ? "text-farm-600" : "text-stone-400 transition-colors group-hover:text-farm-600"}
        />
      ) : null}
      {children}
      <span
        className={`pointer-events-none absolute -bottom-[7px] left-1/2 h-0.5 -translate-x-1/2 rounded-full bg-farm-600 transition-all duration-200 ${
          active ? "w-5 opacity-100" : "w-0 opacity-0 group-hover:w-3 group-hover:opacity-60"
        }`}
      />
    </Link>
  );
}

function MobileLink({
  href,
  active,
  icon: Icon,
  children,
  onClick,
}: {
  href: string;
  active: boolean;
  icon: IconComponent;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
        active
          ? "bg-farm-50 text-farm-800"
          : "text-stone-700 hover:bg-stone-50"
      }`}
    >
      <div
        className={`flex h-8 w-8 items-center justify-center rounded-lg ${
          active ? "bg-farm-200 text-farm-800" : "bg-stone-100 text-stone-500"
        }`}
      >
        <Icon size={16} />
      </div>
      {children}
      <ChevronRight size={14} className="ml-auto text-stone-300" />
    </Link>
  );
}

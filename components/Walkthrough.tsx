"use client";

import { useState, useRef, useEffect } from "react";
import { gsap } from "@/lib/gsap-config";
import { useGSAP } from "@gsap/react";
import { X, ChevronRight, ChevronLeft, Wallet, User, ShieldCheck, Map, ShoppingCart, TrendingUp, CheckCircle, Sprout } from "lucide-react";
import Link from "next/link";

gsap.registerPlugin(useGSAP);

const STEPS = [
  {
    role: "farmer",
    title: "Connect Your Wallet",
    description: "First, connect your Freighter or XBull wallet to get started. Your wallet address becomes your on-chain identity.",
    icon: Wallet,
    action: "Click the 'Connect Wallet' button in the navigation bar above.",
  },
  {
    role: "farmer",
    title: "Create Your Farm Profile",
    description: "Tell us about your farm — your name, farm name, region, and annual yield. This creates your on-chain farmer identity.",
    icon: User,
    action: "Go to Profile to fill in your details and upload your government ID for verification.",
  },
  {
    role: "farmer",
    title: "Get Verified",
    description: "An admin reviews your ID and verifies your profile on-chain. Once verified, you get a ✓ badge and can list crops.",
    icon: ShieldCheck,
    action: "Wait for admin approval. Verified farmers see a green badge on their profile and can list crops.",
  },
  {
    role: "farmer",
    title: "Select Your Parcel & Run NDVI",
    description: "Open the map, select your farmland by drawing a rectangle. Run satellite verification to measure your crop's vegetation health.",
    icon: Map,
    action: "Go to Explore, select your parcel on the map, and click 'Run Satellite Verification'.",
  },
  {
    role: "farmer",
    title: "Mint Your Crop NFT",
    description: "If the NDVI passes the threshold, mint your crop as an NFT. It appears instantly in the marketplace for buyers to discover.",
    icon: Sprout,
    action: "Click 'Mint Crop NFT' after satellite verification. Set your price in XLM and confirm with your wallet.",
  },
  {
    role: "buyer",
    title: "Browse Verified Crops",
    description: "Every crop in the marketplace is backed by real satellite NDVI data. Green bars mean healthy vegetation — good for buying.",
    icon: ShoppingCart,
    action: "Go to Marketplace and browse. Use filters to find crops by type, region, or NDVI health score.",
  },
  {
    role: "buyer",
    title: "Purchase with XLM",
    description: "Your payment is split automatically: 70% held in escrow until delivery, 20% goes to the farmer upfront, 10% to the disaster treasury pool.",
    icon: TrendingUp,
    action: "Click any crop card, review the AI NDVI analysis, then click 'Purchase'. Sign with your wallet.",
  },
  {
    role: "system",
    title: "Delivery & Settlement",
    description: "Once the crop is delivered and verified by a validator, the remaining 70% escrow is released to the farmer. The order is marked complete.",
    icon: CheckCircle,
    action: "Farmers track their orders under 'My Orders'. Buyers see their purchase lifecycle: Purchased → Growing → Verified → Settled.",
  },
];

export default function Walkthrough() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [animating, setAnimating] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const current = STEPS[step];
  const isFarmer = current.role === "farmer";
  const isBuyer = current.role === "buyer";
  const isSystem = current.role === "system";

  // Bounce the tour button on first render
  useGSAP(
    () => {
      if (!buttonRef.current) return;
      const mm = gsap.matchMedia();
      mm.add(
        { reduceMotion: "(prefers-reduced-motion: reduce)" },
        (ctx) => {
          if (ctx.conditions?.reduceMotion) return;
          gsap.fromTo(
            buttonRef.current,
            { y: -4 },
            {
              y: 4,
              duration: 1.2,
              repeat: -1,
              yoyo: true,
              ease: "sine.inOut",
              delay: 2,
            },
          );
        },
      );
    },
    { scope: buttonRef },
  );

  // Crossfade content when step changes
  useEffect(() => {
    if (!contentRef.current || !open) return;
    setAnimating(true);
    gsap.fromTo(
      contentRef.current,
      { opacity: 0, y: 8 },
      {
        opacity: 1,
        y: 0,
        duration: 0.25,
        ease: "power2.out",
        onComplete: () => setAnimating(false),
      },
    );
  }, [step, open]);

  // Animate modal entrance
  useEffect(() => {
    if (!modalRef.current || !open) return;
    gsap.fromTo(
      modalRef.current,
      { opacity: 0, scale: 0.95, y: 16 },
      { opacity: 1, scale: 1, y: 0, duration: 0.3, ease: "power3.out" },
    );
  }, [open]);

  const changeStep = (newStep: number) => {
    if (animating) return;
    setStep(newStep);
  };

  if (!open) {
    return (
      <button
        ref={buttonRef}
        onClick={() => setOpen(true)}
        className="fixed bottom-24 right-6 z-40 inline-flex items-center gap-2 rounded-full border border-farm-300 bg-white px-4 py-2.5 text-sm font-medium text-farm-800 shadow-lg transition hover:bg-farm-50 hover:shadow-xl"
      >
        <Sprout size={16} />
        Take a Tour
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div
        ref={modalRef}
        className="relative w-full max-w-lg rounded-2xl border border-stone-200 bg-white shadow-2xl"
      >
        <button
          onClick={() => setOpen(false)}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-600"
        >
          <X size={18} />
        </button>

        <div className="p-6 pt-10">
          <div ref={contentRef}>
            {/* Role badge */}
            <span
              className={`inline-flex items-center gap-1 rounded-full px-3 py-0.5 text-xs font-semibold uppercase tracking-wide ${
                isFarmer
                  ? "bg-farm-100 text-farm-700"
                  : isBuyer
                    ? "bg-harvest-100 text-harvest-700"
                    : "bg-soil-100 text-soil-700"
              }`}
            >
              {isFarmer ? "Farmer" : isBuyer ? "Buyer" : "System"} Step {isFarmer ? step + 1 : isBuyer ? step - 4 + 1 : "Final"}
            </span>

            {/* Icon */}
            <div className="mt-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-farm-100 text-farm-700">
              <current.icon size={28} />
            </div>

            {/* Title */}
            <h2 className="mt-4 font-display text-xl font-bold text-stone-900">
              {current.title}
            </h2>

            {/* Description */}
            <p className="mt-2 text-sm leading-relaxed text-stone-600">
              {current.description}
            </p>

            {/* Action */}
            <div className="mt-4 rounded-xl border border-farm-100 bg-farm-50/50 px-4 py-3">
              <p className="text-xs font-medium text-farm-800">What to do:</p>
              <p className="mt-1 text-xs text-stone-600">{current.action}</p>
            </div>

            {/* Quick links */}
            {step === 0 && (
              <p className="mt-2 text-[11px] text-stone-400">
                Need a test wallet? Try{" "}
                <a href="https://freighter.app" target="_blank" rel="noopener" className="underline">
                  Freighter
                </a>
              </p>
            )}
            {(step === 3 || step === 4) && (
              <Link href="/explore" onClick={() => setOpen(false)} className="btn-primary mt-3 text-xs w-full justify-center">
                Go to Explore Map
              </Link>
            )}
            {step === 5 && (
              <Link href="/marketplace" onClick={() => setOpen(false)} className="btn-primary mt-3 text-xs w-full justify-center">
                Go to Marketplace
              </Link>
            )}
          </div>
        </div>

        {/* Step controls */}
        <div className="flex items-center justify-between border-t border-stone-100 px-6 py-4">
          <button
            onClick={() => changeStep(Math.max(0, step - 1))}
            disabled={step === 0 || animating}
            className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-stone-500 transition hover:text-stone-700 disabled:opacity-30"
          >
            <ChevronLeft size={14} /> Previous
          </button>

          <div className="flex gap-1.5">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === step ? "w-8 bg-farm-500" : i < step ? "w-4 bg-farm-200" : "w-4 bg-stone-200"
                }`}
              />
            ))}
          </div>

          {step < STEPS.length - 1 ? (
            <button
              onClick={() => changeStep(step + 1)}
              disabled={animating}
              className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-farm-700 transition hover:text-farm-900"
            >
              Next <ChevronRight size={14} />
            </button>
          ) : (
            <button
              onClick={() => setOpen(false)}
              className="inline-flex items-center gap-1 rounded-lg bg-farm-900 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-farm-800"
            >
              Got it! Start Exploring
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
"use client";

import { useRef, useEffect, useState } from "react";
import { gsap } from "@/lib/gsap-config";
import Link from "next/link";
import {
  ArrowRight,
  Leaf,
  CheckCircle,
  DollarSign,
  Users,
  Map,
  Plus,
  Store,
  AlertTriangle,
  type LucideIcon,
} from "lucide-react";

const ICON_MAP: Record<string, LucideIcon> = {
  leaf: Leaf,
  "check-circle": CheckCircle,
  "dollar-sign": DollarSign,
  users: Users,
  map: Map,
  plus: Plus,
  store: Store,
  "alert-triangle": AlertTriangle,
};

function useCountUp(end: number, started: boolean, duration = 1.5) {
  const [value, setValue] = useState(0);
  const rafRef = useRef(0);

  useEffect(() => {
    if (!started) return;
    const startTime = performance.now();

    function tick(now: number) {
      const progress = Math.min((now - startTime) / (duration * 1000), 1);
      // easeOutExpo
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      setValue(Math.round(end * eased));
      if (progress < 1) rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [end, duration, started]);

  return value;
}

export function AnimatedStat({
  end,
  label,
  prefix = "",
  color,
  icon,
}: {
  end: number;
  label: string;
  prefix?: string;
  color: string;
  icon: string;
}) {
  const [started, setStarted] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const Icon = ICON_MAP[icon] ?? Leaf;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setStarted(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const value = useCountUp(end, started);
  const formatted = prefix ? `${prefix}${value.toLocaleString()}` : value.toLocaleString();

  return (
    <div ref={ref} className="card-farm p-5 transition hover:shadow-md hover:-translate-y-0.5 duration-200">
      <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${color}`}>
        <Icon size={18} />
      </div>
      <p className="text-2xl font-bold tabular-nums text-stone-900">{formatted}</p>
      <p className="mt-0.5 text-xs text-stone-500">{label}</p>
    </div>
  );
}

export function QuickActionCard({
  label,
  href,
  color,
  icon,
}: {
  label: string;
  href: string;
  color: string;
  icon: string;
}) {
  const Icon = ICON_MAP[icon] ?? Map;

  return (
    <Link
      href={href}
      className={`flex flex-col items-center gap-2 rounded-2xl border p-4 transition hover:shadow-md hover:-translate-y-0.5 active:scale-[0.97] ${color}`}
    >
      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${color}`}>
        <Icon size={18} />
      </div>
      <span className="text-xs font-semibold">{label}</span>
      <ArrowRight size={12} className="opacity-50" />
    </Link>
  );
}
"use client";

import { useRef } from "react";
import { gsap } from "@/lib/gsap-config";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

export default function PageTransition({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(
        { reduceMotion: "(prefers-reduced-motion: reduce)" },
        (ctx) => {
          const reduce = ctx.conditions?.reduceMotion ?? false;
          gsap.fromTo(
            ref.current,
            { opacity: reduce ? 1 : 0, y: reduce ? 0 : 6 },
            { opacity: 1, y: 0, duration: reduce ? 0 : 0.25, ease: "power2.out" },
          );
        },
        ref,
      );
    },
    { scope: ref },
  );

  return <div ref={ref}>{children}</div>;
}
"use client";

import { useRef } from "react";
import { gsap } from "@/lib/gsap-config";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

export function ScrollReveal({
  children,
  className,
  direction = "up",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  direction?: "up" | "left" | "right";
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(
        { reduceMotion: "(prefers-reduced-motion: reduce)" },
        (ctx) => {
          const reduce = ctx.conditions?.reduceMotion ?? false;
          const y = direction === "up" ? 40 : 0;
          const x = direction === "left" ? -40 : direction === "right" ? 40 : 0;

          gsap.fromTo(
            ref.current,
            { opacity: reduce ? 1 : 0, y: reduce ? 0 : y, x: reduce ? 0 : x },
            {
              opacity: 1,
              y: 0,
              x: 0,
              duration: reduce ? 0.1 : 0.7,
              delay,
              ease: "power2.out",
              scrollTrigger: {
                trigger: ref.current,
                start: "top 88%",
                toggleActions: "play none none none",
              },
            },
          );
        },
        ref,
      );
    },
    { scope: ref },
  );

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}

export function StaggerReveal({
  children,
  className,
  staggerMs = 100,
}: {
  children: React.ReactNode;
  className?: string;
  staggerMs?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(
        { reduceMotion: "(prefers-reduced-motion: reduce)" },
        (ctx) => {
          const reduce = ctx.conditions?.reduceMotion ?? false;

          gsap.fromTo(
            ref.current!.children,
            { opacity: reduce ? 1 : 0, y: reduce ? 0 : 24, scale: reduce ? 1 : 0.97 },
            {
              opacity: 1,
              y: 0,
              scale: 1,
              duration: reduce ? 0.05 : 0.5,
              stagger: reduce ? 0 : staggerMs / 1000,
              ease: "power2.out",
              scrollTrigger: {
                trigger: ref.current,
                start: "top 85%",
                toggleActions: "play none none none",
              },
            },
          );
        },
        ref,
      );
    },
    { scope: ref },
  );

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
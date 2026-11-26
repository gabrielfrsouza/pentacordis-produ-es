"use client";

import { motion } from "framer-motion";
import type { CSSProperties } from "react";
import { BrandMark } from "@/components/brand/BrandMark";
import { EASE_EDITORIAL } from "@/lib/motion";

type BrandLogoProps = {
  variant?: "black" | "white" | "muted" | "gold";
  size?: "xs" | "sm" | "md" | "lg";
  animated?: boolean;
  className?: string;
};

const markSizes = {
  xs: "xs",
  sm: "sm",
  md: "md",
  lg: "lg",
} as const;

const wordmarkSizes = {
  xs: "w-[72px]",
  sm: "w-[104px]",
  md: "w-[144px]",
  lg: "w-[208px]",
} as const;

const gaps = {
  xs: "gap-1",
  sm: "gap-2",
  md: "gap-2.5",
  lg: "gap-3",
} as const;

const colors = {
  black: "#0A0A0A",
  white: "#FFFFFF",
  muted: "#A3A3A3",
  gold: "#B89B5E",
} as const;

export function BrandLogo({
  variant = "black",
  size = "md",
  animated = false,
  className = "",
}: BrandLogoProps) {
  const wordmarkStyle: CSSProperties = {
    backgroundColor: colors[variant],
    WebkitMaskImage: 'url("/brand/pentacordis-nome.svg")',
    maskImage: 'url("/brand/pentacordis-nome.svg")',
    WebkitMaskRepeat: "no-repeat",
    maskRepeat: "no-repeat",
    WebkitMaskPosition: "center",
    maskPosition: "center",
    WebkitMaskSize: "contain",
    maskSize: "contain",
  };

  return (
    <motion.div
      className={`inline-flex shrink-0 items-center ${gaps[size]} ${className}`}
      initial={animated ? { opacity: 0.25 } : false}
      animate={animated ? { opacity: [0.25, 0.85, 0.25] } : undefined}
      transition={animated ? { duration: 2.2, repeat: Infinity, ease: EASE_EDITORIAL } : undefined}
    >
      <BrandMark variant={variant} size={markSizes[size]} />
      <span
        aria-hidden="true"
        className={`inline-block aspect-[1275/178] shrink-0 ${wordmarkSizes[size]}`}
        style={wordmarkStyle}
      />
    </motion.div>
  );
}

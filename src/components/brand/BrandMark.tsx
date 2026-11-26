"use client";

import { motion } from "framer-motion";
import type { CSSProperties } from "react";

type BrandVariant = "black" | "white" | "muted" | "gold" | "watermark";
type BrandSize = "xs" | "sm" | "md" | "lg" | "xl" | "hero";

type BrandMarkProps = {
  variant?: BrandVariant;
  size?: BrandSize;
  animated?: boolean;
  className?: string;
  src?: string;
};

const sizes: Record<BrandSize, string> = {
  xs: "h-4 w-4",
  sm: "h-7 w-7",
  md: "h-10 w-10",
  lg: "h-16 w-16",
  xl: "h-24 w-24",
  hero: "h-72 w-72",
};

const colors: Record<BrandVariant, string> = {
  black: "#0A0A0A",
  white: "#FFFFFF",
  muted: "#A3A3A3",
  gold: "#B89B5E",
  watermark: "#0A0A0A",
};

export function BrandMark({
  variant = "black",
  size = "md",
  animated = false,
  className = "",
  src = "/brand/fleur-de-lis.svg",
}: BrandMarkProps) {
  const maskStyle: CSSProperties = {
    backgroundColor: colors[variant],
    WebkitMaskImage: `url("${src}")`,
    maskImage: `url("${src}")`,
    WebkitMaskRepeat: "no-repeat",
    maskRepeat: "no-repeat",
    WebkitMaskPosition: "center",
    maskPosition: "center",
    WebkitMaskSize: "contain",
    maskSize: "contain",
  };
  const classes = [
    "inline-block shrink-0",
    sizes[size],
    variant === "watermark" ? "pointer-events-none select-none opacity-[0.03]" : "",
    className,
  ].filter(Boolean).join(" ");

  if (animated) {
    return (
      <motion.div
        role="img"
        aria-label="Pentacordis"
        style={maskStyle}
        initial={{ opacity: 0.25 }}
        animate={{ opacity: [0.25, 0.85, 0.25] }}
        transition={{ duration: 2.2, repeat: Infinity, ease: [0.22, 1, 0.36, 1] }}
        className={classes}
      />
    );
  }

  return (
    <span
      role="img"
      aria-label="Pentacordis"
      style={maskStyle}
      className={classes}
    />
  );
}

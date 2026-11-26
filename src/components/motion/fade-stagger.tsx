"use client";

import { motion } from "framer-motion";
import type { PropsWithChildren } from "react";
import { staggerContainer, staggerItem } from "@/lib/motion";

export function FadeStagger({ children, className }: PropsWithChildren<{ className?: string }>) {
  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function FadeItem({ children, className }: PropsWithChildren<{ className?: string }>) {
  return (
    <motion.div variants={staggerItem} className={className}>
      {children}
    </motion.div>
  );
}

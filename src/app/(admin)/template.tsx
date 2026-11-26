"use client";

import { motion } from "framer-motion";
import type { PropsWithChildren } from "react";
import { DURATION_SLOW, EASE_EDITORIAL } from "@/lib/motion";

export default function AdminTemplate({ children }: PropsWithChildren) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DURATION_SLOW, ease: EASE_EDITORIAL }}
    >
      {children}
    </motion.div>
  );
}

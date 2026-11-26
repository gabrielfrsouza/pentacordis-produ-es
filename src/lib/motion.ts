export const EASE_EDITORIAL = [0.22, 1, 0.36, 1] as const;
export const DURATION_SLOW = 0.75;
export const DURATION_BASE = 0.55;
export const DURATION_FAST = 0.35;

export const pageTransition = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: DURATION_SLOW, ease: EASE_EDITORIAL },
};

export const staggerContainer = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.08,
    },
  },
};

export const staggerItem = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: DURATION_BASE, ease: EASE_EDITORIAL },
  },
};

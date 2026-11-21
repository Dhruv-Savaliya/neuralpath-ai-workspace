"use client";

import Link from "next/link";
import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight, Menu, X } from "lucide-react";

const nav = [
  ["Features", "/features"],
  ["How it works", "/how-it-works"],
  ["About", "/about"],
  ["FAQ", "/faq"],
] as const;

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const reduce = useReducedMotion();

  return (
    <>
      <button
        className="mobile-nav-toggle"
        type="button"
        aria-label={open ? "Close navigation" : "Open navigation"}
        aria-expanded={open}
        aria-controls="neuralpath-mobile-navigation"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? <X size={20} /> : <Menu size={20} />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.nav
            id="neuralpath-mobile-navigation"
            className="mobile-nav-panel"
            aria-label="Mobile navigation"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: reduce ? 0 : 0.18 }}
          >
            {nav.map(([label, href]) => (
              <Link key={href} href={href} onClick={() => setOpen(false)}>
                {label}
                <ArrowUpRight size={15} />
              </Link>
            ))}
            <Link href="/auth/sign-in" onClick={() => setOpen(false)}>
              Sign in
            </Link>
            <Link
              className="mobile-nav-cta"
              href="/auth/sign-up"
              onClick={() => setOpen(false)}
            >
              Create your free account <ArrowUpRight size={15} />
            </Link>
          </motion.nav>
        )}
      </AnimatePresence>
    </>
  );
}

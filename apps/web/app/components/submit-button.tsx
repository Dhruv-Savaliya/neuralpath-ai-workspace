"use client";

import { useFormStatus } from "react-dom";

export default function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button className="site-button" type="submit" disabled={pending} aria-busy={pending}>
      {pending ? "Please wait…" : children}
    </button>
  );
}

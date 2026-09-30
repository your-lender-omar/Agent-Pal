"use client";

import { useFormStatus } from "react-dom";
import { buttonClass } from "./ui";

export function SubmitButton({ children, variant = "primary", className = "" }: { children: React.ReactNode; variant?: "primary" | "secondary" | "danger"; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={`${buttonClass(variant)} ${className}`}>
      {pending ? "Working…" : children}
    </button>
  );
}

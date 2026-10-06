"use client";

import Link from "next/link";
import { buttonClass } from "@/components/ui";

/** Shown instead of a blank crash page when anything on a page throws. */
export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        <h1 className="text-lg font-semibold text-slate-900">Something went wrong</h1>
        <p className="mt-2 text-sm text-slate-500">Try again. If it keeps happening, send this message to your admin:</p>
        <pre className="mt-4 overflow-x-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-left text-xs text-slate-700">
          {error.message || "Unknown error"}
          {error.digest ? `\nRef: ${error.digest}` : ""}
        </pre>
        <div className="mt-5 flex justify-center gap-2">
          <button onClick={() => retry()} className={buttonClass()}>Try again</button>
          <Link href="/" className={buttonClass("secondary")}>Home</Link>
        </div>
      </div>
    </div>
  );
}

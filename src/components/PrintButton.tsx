"use client";

export function PrintButton() {
  return (
    <button onClick={() => window.print()} className="text-sm text-slate-500 hover:text-slate-800 hover:underline">
      Print or save as PDF
    </button>
  );
}

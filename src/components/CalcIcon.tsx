const PATHS: Record<string, React.ReactNode> = {
  buyer: <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  "seller-net": (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M15 9.5c-.5-1-1.6-1.5-3-1.5-1.7 0-3 .9-3 2s1 1.7 3 2 3 .9 3 2-1.3 2-3 2c-1.4 0-2.6-.6-3-1.5M12 6.5V8M12 16v1.5" />
    </>
  ),
  affordability: (
    <>
      <rect x="3" y="6" width="18" height="13" rx="2" />
      <path d="M3 10h18M16 14.5h2" />
    </>
  ),
  "rent-vs-buy": <path d="M7 4 3 8l4 4M3 8h13M17 20l4-4-4-4M21 16H8" />,
  "sell-to-net": (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1" />
    </>
  ),
  buydown: (
    <>
      <path d="M19 5 5 19" />
      <circle cx="7" cy="7" r="2" />
      <circle cx="17" cy="17" r="2" />
    </>
  ),
  refi: <path d="M21 12a9 9 0 0 1-15.5 6.3L3 16M3 12a9 9 0 0 1 15.5-6.3L21 8M21 3v5h-5M3 21v-5h5" />,
  "extra-payment": <path d="M3 7l6 6 4-4 8 8M21 11v6h-6" />,
};

export function CalcIcon({ slug, className = "h-5 w-5" }: { slug: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      {PATHS[slug] ?? <rect x="4" y="3" width="16" height="18" rx="2" />}
    </svg>
  );
}

// Forward arrow that resolves into a checkmark: unfinished -> done.
export function Logo({ size = 28, withText = true }: { size?: number; withText?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
        <defs>
          <linearGradient id="rl-g" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="32" y2="32">
            <stop offset="0" stopColor="#2f6bff" />
            <stop offset="0.55" stopColor="#a855f7" />
            <stop offset="1" stopColor="#22d3ee" />
          </linearGradient>
        </defs>
        <rect width="32" height="32" rx="8" fill="#0d1220" />
        <path d="M6 17h9" stroke="url(#rl-g)" strokeWidth="3" strokeLinecap="round" />
        <path d="M12 21.5l4.5 4.5L27 9.5" fill="none" stroke="url(#rl-g)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {withText && (
        <span className="font-semibold tracking-tight">
          Relynt <span className="brand-text">AI</span>
        </span>
      )}
    </span>
  );
}

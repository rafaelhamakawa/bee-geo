export function GeoApisMark({ className = "h-10 w-10" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 88" className={className} role="img" aria-label="Logo GeoApis">
      <path
        d="M32 2C16.5 2 4 14.4 4 29.8 4 50 32 86 32 86s28-36 28-56.2C60 14.4 47.5 2 32 2z"
        fill="var(--primary)"
      />
      <circle cx="32" cy="29" r="20" fill="#ffffff" />
      <path d="M32 13l10 5.8v11.6L32 36.2 22 30.4V18.8z" fill="var(--honey)" />
      <ellipse cx="32" cy="40" rx="7" ry="9" fill="#17213a" />
      <rect x="25" y="35" width="14" height="3" fill="var(--honey-light)" />
      <rect x="25.5" y="41" width="13" height="3" fill="var(--honey-light)" />
      <ellipse cx="21" cy="36" rx="7" ry="4" fill="#ffffff" stroke="#17213a" strokeWidth="1.5" />
      <ellipse cx="43" cy="36" rx="7" ry="4" fill="#ffffff" stroke="#17213a" strokeWidth="1.5" />
    </svg>
  );
}

export function GeoApisWordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`text-2xl font-extrabold tracking-tight ${className}`}>
      <span className="text-primary">Geo</span>
      <span className="text-honey">Apis</span>
    </span>
  );
}

export function GeoApisLogo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <GeoApisMark className={compact ? "h-8 w-8" : "h-12 w-12"} />
      <GeoApisWordmark className={compact ? "text-xl" : "text-3xl"} />
    </div>
  );
}

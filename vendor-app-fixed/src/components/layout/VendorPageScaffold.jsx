const META_TONES = {
  amber: {
    background: "rgba(244,166,35,0.12)",
    border: "rgba(244,166,35,0.22)",
    color: "#f4a623",
  },
  blue: {
    background: "rgba(59,130,246,0.12)",
    border: "rgba(59,130,246,0.22)",
    color: "#3b82f6",
  },
  green: {
    background: "rgba(34,197,94,0.12)",
    border: "rgba(34,197,94,0.22)",
    color: "#22c55e",
  },
  red: {
    background: "rgba(239,68,68,0.12)",
    border: "rgba(239,68,68,0.22)",
    color: "#ef4444",
  },
};

export function VendorPageShell({ children }) {
  return (
    <div className="flex h-full flex-col bg-bg text-text animate-fadeUp">
      <div className="flex-1 overflow-y-auto px-4 pb-5 pt-4">
        <div className="space-y-4">{children}</div>
      </div>
    </div>
  );
}

export function VendorHeroCard({
  eyebrow,
  title,
  description,
  meta = [],
  children,
}) {
  return (
    <section
      className="rounded-[24px] px-4 py-4 sm:px-5"
      style={{
        background: "var(--dashboard-hero-gradient)",
        border: "1px solid var(--profile-hero-border)",
        boxShadow: "var(--profile-hero-shadow)",
      }}
    >
      <div className="flex flex-col gap-4">
        <div>
          {eyebrow && (
            <div
              className="inline-flex items-center rounded-full px-3 py-[7px] text-[11px] font-semibold text-text"
              style={{
                background: "var(--profile-hero-meta-bg)",
                border: "1px solid var(--profile-hero-meta-border)",
              }}
            >
              {eyebrow}
            </div>
          )}
          <h1 className="mt-3 font-syne text-[24px] font-extrabold leading-tight text-text">
            {title}
          </h1>
          {description && (
            <p className="mt-2 text-[12px] leading-relaxed text-text-muted">
              {description}
            </p>
          )}
        </div>

        {meta.length > 0 && (
          <div className="grid gap-2.5 sm:grid-cols-2">
            {meta.map((item) => (
              <VendorMetaPill
                key={item.label}
                label={item.label}
                value={item.value}
                tone={item.tone}
              />
            ))}
          </div>
        )}

        {children}
      </div>
    </section>
  );
}

export function VendorMetaPill({ label, value, tone = "amber" }) {
  const palette = META_TONES[tone] || META_TONES.amber;

  return (
    <div
      className="rounded-[18px] px-3.5 py-3"
      style={{
        background: "var(--profile-hero-meta-bg)",
        border: "1px solid var(--profile-hero-meta-border)",
      }}
    >
      <div className="text-[10px] uppercase tracking-[0.5px] text-text-muted">
        {label}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <span
          className="inline-flex h-2.5 w-2.5 rounded-full"
          style={{ background: palette.color }}
        />
        <div className="text-[13px] font-semibold text-text">{value}</div>
      </div>
    </div>
  );
}

export function VendorSurfaceCard({ children, className = "" }) {
  return (
    <section
      className={`rounded-[20px] p-4 ${className}`.trim()}
      style={{
        background: "rgb(var(--color-surface))",
        border: "1px solid rgb(var(--color-border))",
      }}
    >
      {children}
    </section>
  );
}

export function VendorFilterChips({ items, activeItem, onChange }) {
  return (
    <div className="flex gap-[6px] overflow-x-auto">
      {items.map((item) => (
        <button
          key={item}
          type="button"
          onClick={() => onChange(item)}
          className={`whitespace-nowrap rounded-full border px-[12px] py-[5px] text-[11px] font-semibold transition-all ${
            activeItem === item
              ? "border-accent bg-accent text-on-accent"
              : "border-border bg-surface2 text-text-muted"
          }`}
        >
          {item}
        </button>
      ))}
    </div>
  );
}

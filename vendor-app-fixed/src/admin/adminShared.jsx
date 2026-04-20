import { createElement } from "react";
import { FILTERS } from "./adminUtils";

const TILE_TONES = {
  amber: { bar: "#f4a623", icon: "#f4a623", bg: "rgba(244,166,35,0.1)" },
  blue: { bar: "#3b82f6", icon: "#60a5fa", bg: "rgba(59,130,246,0.12)" },
  green: { bar: "#22c55e", icon: "#4ade80", bg: "rgba(34,197,94,0.12)" },
  red: { bar: "#ef4444", icon: "#f87171", bg: "rgba(239,68,68,0.1)" },
};

export function AdminPageShell({ children }) {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="w-full space-y-4 px-4 pb-6 pt-4 sm:space-y-5 sm:px-5 sm:pb-8 sm:pt-5 lg:mx-auto lg:max-w-6xl">
        {children}
      </div>
    </div>
  );
}

export function FilterChips({ activeFilter, onChange }) {
  return (
    <div className="mt-4 flex flex-wrap gap-[6px]">
      {FILTERS.map((filter) => (
        <button
          key={filter}
          type="button"
          onClick={() => onChange(filter)}
          className={`whitespace-nowrap rounded-full border px-[14px] py-[6px] text-[12px] font-semibold transition-all ${
            activeFilter === filter
              ? "border-accent bg-accent text-on-accent"
              : "border-border bg-surface2 text-text-muted"
          }`}
        >
          {filter}
        </button>
      ))}
    </div>
  );
}

export function AdminHeroCard({
  icon,
  eyebrow,
  title,
  description,
  activeFilter,
  onFilterChange,
  metaLabel,
  metaValue,
  children,
}) {
  return (
    <section
      className="rounded-[24px] p-4 sm:rounded-[26px] sm:p-5"
      style={{
        background: "var(--profile-hero-gradient)",
        border: "1px solid var(--profile-hero-border)",
        boxShadow: "var(--profile-hero-shadow)",
      }}
    >
      <div className="flex flex-col gap-5">
        <div className="max-w-2xl min-w-0">
          <div
            className="inline-flex items-center gap-2 rounded-full px-3 py-[7px] text-[11px] font-semibold"
            style={{
              background: "var(--profile-hero-meta-bg)",
              border: "1px solid var(--profile-hero-meta-border)",
            }}
          >
            {icon &&
              createElement(icon, { size: 14, className: "text-accent" })}
            {eyebrow}
          </div>
          <h1 className="mt-4 font-syne text-[21px] font-extrabold leading-tight text-text sm:text-[25px] md:text-[30px]">
            {title}
          </h1>
          <p className="mt-2 max-w-xl text-[12px] leading-relaxed text-text-muted sm:text-[13px]">
            {description}
          </p>
          {metaValue && (
            <div className="mt-4 text-[12px] text-text-muted sm:text-[13px]">
              {metaLabel}{" "}
              <span className="font-semibold text-text">{metaValue}</span>
            </div>
          )}
          {onFilterChange && (
            <FilterChips
              activeFilter={activeFilter}
              onChange={onFilterChange}
            />
          )}
        </div>

        {children}
      </div>
    </section>
  );
}

export function StatusPill({ status }) {
  const palette =
    status === "approved"
      ? {
          background: "var(--profile-status-active-bg)",
          color: "var(--profile-status-active-text)",
          border: "1px solid rgba(34,197,94,0.18)",
          label: "Approved",
        }
      : status === "rejected"
        ? {
            background: "var(--profile-status-rejected-bg)",
            color: "var(--profile-status-rejected-text)",
            border: "1px solid var(--profile-status-rejected-border)",
            label: "Rejected",
          }
        : {
            background: "var(--profile-status-pending-bg)",
            color: "var(--profile-status-pending-text)",
            border: "1px solid rgba(244,166,35,0.18)",
            label: "Pending",
          };

  return (
    <span
      className="inline-flex items-center rounded-full px-3 py-[6px] text-[11px] font-semibold"
      style={{
        background: palette.background,
        color: palette.color,
        border: palette.border,
      }}
    >
      {palette.label}
    </span>
  );
}

export function HeroMeta({ icon, label, value }) {
  return (
    <div
      className="min-w-0 rounded-[18px] px-3.5 py-3 sm:px-4"
      style={{
        background: "var(--profile-hero-meta-bg)",
        border: "1px solid var(--profile-hero-meta-border)",
      }}
    >
      <div className="flex items-start gap-2 text-[10px] uppercase leading-[1.25] tracking-[0.6px] text-text-muted">
        {icon &&
          createElement(icon, { size: 13, className: "mt-[1px] shrink-0" })}
        <span className="break-words">{label}</span>
      </div>
      <div className="mt-2 break-all text-[13px] font-semibold leading-tight text-text sm:text-[14px]">
        {value}
      </div>
    </div>
  );
}

export function StatTile({ icon, label, value, meta, tone = "amber" }) {
  const palette = TILE_TONES[tone] || TILE_TONES["amber"];

  return (
    <div
      className="relative min-w-0 overflow-hidden rounded-[20px] bg-surface p-[13px] sm:rounded-[22px] sm:p-[14px]"
      style={{ border: "1px solid rgb(var(--color-border))" }}
    >
      <div
        className="absolute left-0 right-0 top-0 h-[3px]"
        style={{ background: palette.bar }}
      />
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.5px] text-text-muted">
            {label}
          </div>
          <div className="mt-3 font-syne text-[22px] font-extrabold leading-none text-text">
            {value}
          </div>
          <div className="mt-[7px] text-[10px] text-text-muted">{meta}</div>
        </div>

        <div
          className="flex h-10 w-10 items-center justify-center rounded-2xl"
          style={{ background: palette.bg, color: palette.icon }}
        >
          {icon ? createElement(icon, { size: 18 }) : null}
        </div>
      </div>
    </div>
  );
}

export function MetricPill({ label, value }) {
  return (
    <div
      className="min-w-0 rounded-[15px] px-3 py-[11px] sm:rounded-[16px] sm:py-3"
      style={{
        background: "rgb(var(--color-bg))",
        border: "1px solid rgb(var(--color-border))",
      }}
    >
      <div className="break-normal text-[10px] uppercase leading-[1.35] tracking-[0.5px] text-text-muted">
        {label}
      </div>
      <div className="mt-1 break-words text-[14px] font-semibold leading-tight text-text">
        {value}
      </div>
    </div>
  );
}

export function FeedbackBanner({ tone, message }) {
  if (!message) {
    return null;
  }

  const palette =
    tone === "error"
      ? {
          background: "var(--feedback-error-bg)",
          border: "1px solid var(--feedback-error-border)",
          color: "var(--feedback-error-text)",
        }
      : {
          background: "var(--feedback-accent-bg)",
          border: "1px solid var(--feedback-accent-border)",
          color: "var(--feedback-accent-text)",
        };

  return (
    <div
      className="rounded-[16px] px-4 py-3 text-[13px] sm:rounded-[18px]"
      style={{
        background: palette.background,
        border: palette.border,
        color: palette.color,
      }}
    >
      {message}
    </div>
  );
}

export function FeedbackStack({ error, notice }) {
  if (!error && !notice) {
    return null;
  }

  return (
    <div className="space-y-3">
      <FeedbackBanner tone="error" message={error} />
      <FeedbackBanner tone="notice" message={notice} />
    </div>
  );
}

export function SectionCard({ children, className = "" }) {
  return (
    <section
      className={`rounded-[22px] p-[14px] sm:rounded-[24px] sm:p-4 ${className}`.trim()}
      style={{
        background: "rgb(var(--color-surface))",
        border: "1px solid rgb(var(--color-border))",
      }}
    >
      {children}
    </section>
  );
}

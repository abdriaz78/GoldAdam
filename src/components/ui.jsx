import { cn } from "@/lib/utils";

export function PageHeader({ title, subtitle, children }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-5 py-5 md:px-8 md:py-6">
      <div>
        <h1 className="font-serif text-xl font-semibold text-text md:text-2xl">{title}</h1>
        {subtitle && <p className="mt-1 text-[13px] text-muted">{subtitle}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

export function Content({ children, className }) {
  return <div className={cn("space-y-8 px-5 py-6 md:px-8 md:py-7", className)}>{children}</div>;
}

export function SectionHead({ title, subtitle, action }) {
  return (
    <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
      <div className="text-[13px] font-semibold text-text">{title}</div>
      {action ? action : subtitle ? <div className="text-xs text-muted-dim">{subtitle}</div> : null}
    </div>
  );
}

export function Card({ children, className }) {
  return (
    <div className={cn("rounded-xl border border-border bg-panel p-5", className)}>
      {children}
    </div>
  );
}

export function StatTile({ label, value, delta, tone, gold }) {
  return (
    <div className="rounded-lg border border-border bg-panel p-3.5">
      <div className="text-[11px] text-muted">{label}</div>
      <div className={cn("mt-1.5 font-serif text-xl font-semibold tabular-nums", gold ? "text-gold" : "text-text")}>
        {value}
      </div>
      {delta && (
        <div
          className={cn(
            "mt-1.5 text-[11px]",
            tone === "up" ? "text-green" : tone === "down" ? "text-red" : "text-muted-dim"
          )}
        >
          {delta}
        </div>
      )}
    </div>
  );
}

export function TileGrid({ children, className }) {
  return <div className={cn("grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6", className)}>{children}</div>;
}

export function PillGroup({ options, value, onChange }) {
  return (
    <div className="flex gap-0.5 rounded-lg border border-border bg-panel p-0.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
            value === opt.value ? "bg-panel-raised text-text" : "text-muted hover:text-text"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

const FLAG_TONES = {
  ok: "bg-green-dim text-[#9CD9B4]",
  watch: "bg-amber-dim text-[#F0C088]",
  risk: "bg-red-dim text-[#F0AAA1]",
  top: "bg-gold-dim text-[#F0DBA8]",
  blue: "bg-blue-dim text-[#B9D0EE]",
  neutral: "bg-panel-raised text-muted",
};

export function FlagBadge({ tone = "neutral", children }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold", FLAG_TONES[tone])}>
      {children}
    </span>
  );
}

const STATUS_CHIP = {
  pending: "bg-[#3A3320] text-amber",
  confirmed: "bg-green-dim text-[#9CD9B4]",
  cancelled: "bg-red-dim text-[#F0AAA1]",
  completed: "bg-blue-dim text-[#B9D0EE]",
  no_show: "bg-[#3A2A20] text-[#E0A87E]",
  no_sale: "bg-panel-raised text-muted",
};

export function StatusChip({ status }) {
  return (
    <span className={cn("inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold", STATUS_CHIP[status] || "bg-panel-raised text-muted")}>
      {(status || "").replace("_", " ") || "—"}
    </span>
  );
}

const CONCERN = {
  low: { dot: "bg-green", text: "text-[#9CD9B4]" },
  medium: { dot: "bg-amber", text: "text-[#F0C088]" },
  high: { dot: "bg-red", text: "text-[#F0AAA1]" },
};

export function ConcernBadge({ level }) {
  const c = CONCERN[level] || CONCERN.low;
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-semibold", c.text)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", c.dot)} />
      {level ? level[0].toUpperCase() + level.slice(1) : "—"}
    </span>
  );
}

export function Btn({ children, variant = "outline", className, ...props }) {
  const base = "rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors disabled:opacity-60";
  const styles = {
    gold: "bg-gold text-[#1A1305] hover:bg-[#d4ad5a]",
    outline: "border border-border bg-transparent text-text hover:bg-panel-raised",
    panel: "border border-border bg-panel text-text hover:bg-panel-raised",
  };
  return (
    <button className={cn(base, styles[variant], className)} {...props}>
      {children}
    </button>
  );
}

export const TABLE_WRAP = "overflow-x-auto rounded-xl border border-border bg-panel";
export const TH = "whitespace-nowrap px-3.5 py-2.5 text-left text-[11px] font-medium text-muted";
export const TD = "whitespace-nowrap px-3.5 py-3 text-[13px] text-text";
export const THEAD = "border-b border-border bg-[#161C25]";
export const TR_HOVER = "border-b border-border last:border-0 hover:bg-panel-raised";

export function Input(props) {
  return (
    <input
      {...props}
      className={cn(
        "rounded-lg border border-border bg-panel px-3 py-2 text-[13px] text-text placeholder:text-muted-dim focus:outline-none focus:ring-1 focus:ring-gold-dim",
        props.className
      )}
    />
  );
}

export function Select({ children, ...props }) {
  return (
    <select
      {...props}
      className={cn(
        "rounded-lg border border-border bg-panel px-3 py-2 text-[13px] text-text focus:outline-none focus:ring-1 focus:ring-gold-dim",
        props.className
      )}
    >
      {children}
    </select>
  );
}

export function EmptyState({ children }) {
  return <div className="px-4 py-12 text-center text-sm text-muted-dim">{children}</div>;
}

export function NoteBox({ children, className }) {
  return (
    <div className={cn("rounded-lg border border-dashed border-border bg-[#161C25] px-3.5 py-3 text-[12.5px] text-muted", className)}>
      {children}
    </div>
  );
}

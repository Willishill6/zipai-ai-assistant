import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

type Tone = "cyan" | "emerald" | "amber" | "rose" | "slate";

const toneStyles: Record<
  Tone,
  {
    accent: string;
    soft: string;
    border: string;
    text: string;
  }
> = {
  cyan: {
    accent: "oklch(0.66 0.16 205)",
    soft: "oklch(0.95 0.03 205)",
    border: "oklch(0.82 0.07 205 / 75%)",
    text: "oklch(0.34 0.09 215)",
  },
  emerald: {
    accent: "oklch(0.6 0.18 160)",
    soft: "oklch(0.95 0.04 160)",
    border: "oklch(0.8 0.08 160 / 75%)",
    text: "oklch(0.35 0.11 160)",
  },
  amber: {
    accent: "oklch(0.64 0.16 75)",
    soft: "oklch(0.96 0.04 75)",
    border: "oklch(0.84 0.08 75 / 80%)",
    text: "oklch(0.4 0.11 75)",
  },
  rose: {
    accent: "oklch(0.66 0.16 360)",
    soft: "oklch(0.96 0.03 360)",
    border: "oklch(0.83 0.07 360 / 80%)",
    text: "oklch(0.38 0.12 360)",
  },
  slate: {
    accent: "oklch(0.55 0.03 235)",
    soft: "oklch(0.96 0.006 235)",
    border: "oklch(0.88 0.02 235 / 80%)",
    text: "oklch(0.35 0.03 235)",
  },
};

export function PageHeader({
  icon: Icon,
  eyebrow,
  title,
  description,
  actions,
  chips = [],
}: {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  description: string;
  actions?: React.ReactNode;
  chips?: { label: string; tone?: Tone }[];
}) {
  return (
    <section className="wireframe-card rounded-[30px] p-5 md:p-7">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <div className="mono-label mb-3">{eyebrow}</div>
          <div className="flex items-start gap-4">
            <div
              className="flex h-13 w-13 shrink-0 items-center justify-center rounded-2xl border"
              style={{
                background:
                  "linear-gradient(145deg, oklch(0.98 0.02 205), oklch(0.94 0.03 220))",
                borderColor: "oklch(0.82 0.08 210 / 85%)",
              }}
            >
              <Icon
                className="h-6 w-6"
                style={{ color: "oklch(0.4 0.12 215)" }}
              />
            </div>
            <div className="space-y-2">
              <h1 className="text-3xl font-black tracking-tight text-foreground md:text-4xl">
                {title}
              </h1>
              <p className="max-w-2xl text-sm leading-6 text-muted-foreground md:text-[15px]">
                {description}
              </p>
            </div>
          </div>
        </div>

        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>

      {chips.length > 0 ? (
        <div className="mt-5 flex flex-wrap gap-2">
          {chips.map((chip) => {
            const tone = toneStyles[chip.tone ?? "slate"];
            return (
              <span
                key={chip.label}
                className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold"
                style={{
                  background: tone.soft,
                  borderColor: tone.border,
                  color: tone.text,
                }}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: tone.accent }}
                />
                {chip.label}
              </span>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}

export function MetricCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = "cyan",
  className,
}: {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: Tone;
  className?: string;
}) {
  const colors = toneStyles[tone];

  return (
    <div
      className={cn(
        "wireframe-card rounded-[24px] p-4 md:p-5 h-full",
        className
      )}
    >
      <div className="mb-3 flex items-center gap-2">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-xl border"
          style={{
            background: colors.soft,
            borderColor: colors.border,
            color: colors.accent,
          }}
        >
          <Icon className="h-4 w-4" />
        </div>
        <span className="mono-label">{label}</span>
      </div>
      <div className="text-2xl font-black tracking-tight md:text-[1.9rem]">
        {value}
      </div>
      {hint ? (
        <div className="mt-2 text-xs leading-5 text-muted-foreground">{hint}</div>
      ) : null}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="wireframe-card rounded-[30px] p-10 text-center">
      <div
        className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-3xl border"
        style={{
          background:
            "linear-gradient(145deg, oklch(0.98 0.015 205), oklch(0.95 0.02 235))",
          borderColor: "oklch(0.85 0.05 210 / 80%)",
        }}
      >
        <Icon className="h-8 w-8" style={{ color: "oklch(0.46 0.09 215)" }} />
      </div>
      <h2 className="text-xl font-bold tracking-tight">{title}</h2>
      <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted-foreground">
        {description}
      </p>
      {action ? <div className="mt-6 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function PanelTitle({
  icon: Icon,
  kicker,
  title,
  extra,
  tone = "cyan",
}: {
  icon: LucideIcon;
  kicker: string;
  title: string;
  extra?: React.ReactNode;
  tone?: Tone;
}) {
  const colors = toneStyles[tone];

  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-xl border"
          style={{
            background: colors.soft,
            borderColor: colors.border,
            color: colors.accent,
          }}
        >
          <Icon className="h-4.5 w-4.5" />
        </div>
        <div>
          <div className="mono-label">{kicker}</div>
          <div className="text-base font-bold tracking-tight">{title}</div>
        </div>
      </div>
      {extra}
    </div>
  );
}

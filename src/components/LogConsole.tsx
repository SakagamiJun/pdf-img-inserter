import { Copy, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/hooks/useLocale";
import type { LogEntry } from "@/lib/types";
import { cn } from "@/lib/utils";

interface LogConsoleProps {
  logs: LogEntry[];
  onClear?: () => void;
}

export function LogConsole({ logs, onClear }: LogConsoleProps) {
  const { t } = useTranslation();
  const { locale } = useLocale();
  const [copied, setCopied] = useState(false);

  const summary = useMemo(() => {
    return logs.reduce(
      (acc, log) => {
        acc[log.level] += 1;
        return acc;
      },
      { trace: 0, debug: 0, info: 0, warn: 0, error: 0 }
    );
  }, [logs]);

  const handleCopy = async () => {
    if (logs.length === 0) {
      return;
    }

    const payload = logs
      .map((log) => {
        const base = `[${formatTime(log.timestamp, locale)}] ${log.level.toUpperCase()}${
          log.target ? ` ${log.target}` : ""
        } ${log.message}`;

        if (!log.fields || Object.keys(log.fields).length === 0) {
          return base;
        }

        return `${base}\n${Object.entries(log.fields)
          .map(([key, value]) => `${key}=${value}`)
          .join("\n")}`;
      })
      .join("\n\n");

    await navigator.clipboard.writeText(payload);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-3 border-b hairline pb-4">
        <div className="min-w-0">
          <div className="text-xs font-medium text-foreground">{t("logs.title")}</div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={handleCopy}
            disabled={logs.length === 0}
            className="h-9 min-w-[88px] rounded-xl px-3 text-xs whitespace-nowrap"
          >
            <Copy className="h-3.5 w-3.5" />
            {copied ? t("common.actions.copied") : t("common.actions.copy")}
          </Button>
          {onClear ? (
            <Button
              onClick={onClear}
              className="h-9 min-w-[88px] rounded-xl px-3 text-xs whitespace-nowrap"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {t("common.actions.clear")}
            </Button>
          ) : null}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <LogStat label={t("logs.summary.info")} value={summary.info} tone="default" />
        <LogStat label={t("logs.summary.warn")} value={summary.warn} tone="warn" />
        <LogStat label={t("logs.summary.error")} value={summary.error} tone="error" />
        <LogStat label={t("logs.summary.debug")} value={summary.debug + summary.trace} tone="muted" />
      </div>

      <div className="panel-surface-muted mt-4 min-h-0 flex-1 overflow-hidden rounded-2xl">
        <ScrollArea className="h-full">
          {logs.length === 0 ? (
            <div className="flex min-h-[260px] items-center justify-center px-6 text-center text-sm text-muted-foreground">
              {t("logs.empty")}
            </div>
          ) : (
            <div className="space-y-2 p-3 font-mono text-xs">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="rounded-2xl border border-border bg-background/72 px-3 py-2.5"
                >
                  <div className="flex items-center gap-2 text-[11px]">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 font-semibold uppercase tracking-[0.16em]",
                        logToneClassName(log.level)
                      )}
                      style={badgeStyle(log.level)}
                    >
                      {getLogLevelLabel(t, log.level)}
                    </span>
                    <span className="text-muted-foreground">
                      {formatTime(log.timestamp, locale)}
                    </span>
                    {log.target ? (
                      <span className="truncate text-muted-foreground">{log.target}</span>
                    ) : null}
                  </div>
                  <div className="mt-2 whitespace-pre-wrap break-words text-[12px] leading-5 text-foreground">
                    {log.message}
                  </div>
                  {log.fields && Object.keys(log.fields).length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] text-muted-foreground">
                      {Object.entries(log.fields).map(([key, value]) => (
                        <span
                          key={`${log.id}-${key}`}
                          className="rounded-full border border-border bg-muted px-2 py-1"
                        >
                          {key}={value}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );
}

function LogStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "default" | "warn" | "error" | "muted";
}) {
  const toneStyles = {
    default: undefined,
    warn: { backgroundColor: "color-mix(in srgb, var(--app-warning) 14%, transparent)" },
    error: { backgroundColor: "color-mix(in srgb, var(--app-destructive) 14%, transparent)" },
    muted: undefined,
  };

  return (
    <div
      className={cn(
        "rounded-full border border-border px-3 py-1.5 text-sm",
        tone === "muted" ? "bg-muted text-muted-foreground" : "bg-background text-foreground"
      )}
      style={toneStyles[tone]}
    >
      <span className="text-muted-foreground">{label}</span>
      <span className="ml-2 font-medium text-foreground">{value}</span>
    </div>
  );
}

function formatTime(date: Date, locale: string) {
  return date.toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function getLogLevelLabel(
  t: ReturnType<typeof useTranslation>["t"],
  level: LogEntry["level"]
) {
  const keys = {
    debug: "logs.levels.debug",
    error: "logs.levels.error",
    info: "logs.levels.info",
    trace: "logs.levels.trace",
    warn: "logs.levels.warn",
  } as const;

  return t(keys[level]);
}

function logToneClassName(level: LogEntry["level"]) {
  switch (level) {
    case "error":
      return "text-foreground";
    case "warn":
      return "text-foreground";
    case "debug":
      return "text-foreground";
    case "trace":
      return "bg-muted text-muted-foreground";
    default:
      return "text-foreground";
  }
}

function badgeStyle(level: LogEntry["level"]) {
  switch (level) {
    case "error":
      return { backgroundColor: "color-mix(in srgb, var(--app-destructive) 18%, transparent)" };
    case "warn":
      return { backgroundColor: "color-mix(in srgb, var(--app-warning) 18%, transparent)" };
    case "debug":
      return { backgroundColor: "color-mix(in srgb, var(--app-info) 18%, transparent)" };
    case "info":
      return { backgroundColor: "color-mix(in srgb, var(--app-success) 18%, transparent)" };
    default:
      return undefined;
  }
}

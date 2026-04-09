import { Copy, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { LogEntry } from "@/lib/types";
import { cn } from "@/lib/utils";

interface LogConsoleProps {
  logs: LogEntry[];
  onClear?: () => void;
}

export function LogConsole({ logs, onClear }: LogConsoleProps) {
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
        const base = `[${formatTime(log.timestamp)}] ${log.level.toUpperCase()}${
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
      <div className="flex items-start justify-between gap-3 border-b hairline pb-4">
        <div>
          <div className="text-xs font-medium text-foreground">运行日志</div>
          <p className="mt-1 text-sm text-muted-foreground">
            默认只是一条安静的信息流。错误会保留下来，但不会把整个工作台染成告警色。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopy}
            disabled={logs.length === 0}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-border bg-background/80 px-3 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Copy className="h-3.5 w-3.5" />
            {copied ? "已复制" : "复制"}
          </button>
          {onClear ? (
            <button
              type="button"
              onClick={onClear}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-border bg-background/80 px-3 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <Trash2 className="h-3.5 w-3.5" />
              清空
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <LogStat label="信息" value={summary.info} tone="default" />
        <LogStat label="警告" value={summary.warn} tone="warn" />
        <LogStat label="错误" value={summary.error} tone="error" />
        <LogStat label="调试" value={summary.debug + summary.trace} tone="muted" />
      </div>

      <div className="panel-surface-muted mt-4 min-h-0 flex-1 overflow-hidden rounded-2xl">
        <ScrollArea className="h-full">
          {logs.length === 0 ? (
            <div className="flex min-h-[260px] items-center justify-center px-6 text-center text-sm text-muted-foreground">
              暂无日志。开始预览或批处理后，后端事件会在这里按时间顺序展开。
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
                      {log.level}
                    </span>
                    <span className="text-muted-foreground">{formatTime(log.timestamp)}</span>
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

function formatTime(date: Date) {
  return date.toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
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

import { ChevronDown, ChevronUp } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { LogEntry } from "@/lib/types";
import { cn } from "@/lib/utils";

interface LogConsoleProps {
  logs: LogEntry[];
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  onClear?: () => void;
}

export function LogConsole({
  logs,
  collapsed,
  onCollapsedChange,
  onClear,
}: LogConsoleProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (collapsed) return;
    const scroller = scrollRef.current?.firstElementChild as HTMLDivElement | null;
    if (scroller) {
      scroller.scrollTop = scroller.scrollHeight;
    }
  }, [collapsed, logs]);

  const handleCopy = async () => {
    if (logs.length === 0) {
      return;
    }

    const payload = logs
      .map((log) => {
        const base = `[${formatTime(log.timestamp)}] ${log.level.toUpperCase()}${
          log.target ? ` ${log.target}` : ""
        } ${log.message}`;
        const fields =
          log.fields && Object.keys(log.fields).length > 0
            ? `\n${Object.entries(log.fields)
                .map(([key, value]) => `${key}=${value}`)
                .join("\n")}`
            : "";

        return `${base}${fields}`;
      })
      .join("\n\n");

    await navigator.clipboard.writeText(payload);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-[24px] border border-slate-900/90 bg-slate-950 shadow-[0_24px_80px_rgba(15,23,42,0.38)]">
      <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.28em] text-slate-500">
            Tracing Console
          </div>
          <div className="mt-1 text-sm font-medium text-slate-100">
            后端事件流
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!collapsed ? (
            <button
              type="button"
              onClick={handleCopy}
              disabled={logs.length === 0}
              className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-400 transition-colors hover:border-slate-500 hover:text-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {copied ? "已复制" : "复制"}
            </button>
          ) : null}
          {onClear && !collapsed ? (
            <button
              type="button"
              onClick={onClear}
              className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-400 transition-colors hover:border-slate-500 hover:text-slate-100"
            >
              清空
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => onCollapsedChange(!collapsed)}
            className="inline-flex items-center gap-1 rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300 transition-colors hover:border-slate-500 hover:text-white"
          >
            {collapsed ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            {collapsed ? "展开" : "折叠"}
          </button>
        </div>
      </div>

      {!collapsed ? (
      <ScrollArea className="flex-1" ref={scrollRef}>
        <div className="space-y-2 p-3 font-mono text-xs">
          {logs.length === 0 ? (
            <div className="py-8 text-center text-slate-500">
              暂无日志，处理任务或渲染预览后会在这里实时输出 tracing 信息。
            </div>
          ) : (
            logs.map((log) => (
              <div
                key={log.id}
                className="rounded-2xl border border-slate-900 bg-slate-900/70 px-3 py-2"
              >
                <div className="flex items-center gap-3">
                  <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em]", levelClassName(log.level))}>
                    {log.level}
                  </span>
                  <span className="text-slate-500">{formatTime(log.timestamp)}</span>
                  {log.target ? (
                    <span className="truncate text-slate-400">{log.target}</span>
                  ) : null}
                </div>
                <div className="mt-2 whitespace-pre-wrap break-words text-[12px] leading-5 text-slate-100">
                  {log.message}
                </div>
                {log.fields && Object.keys(log.fields).length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-slate-400">
                    {Object.entries(log.fields).map(([key, value]) => (
                      <span
                        key={`${log.id}-${key}`}
                        className="rounded-full bg-slate-800 px-2 py-1"
                      >
                        {key}={value}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            ))
          )}
        </div>
      </ScrollArea>
      ) : (
        <div className="flex flex-1 items-center justify-between px-4 text-xs text-slate-400">
          <span>控制台默认折叠。展开后可查看实时 tracing、批处理结果和错误信息。</span>
          <span>{logs.length} 条日志</span>
        </div>
      )}
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

function levelClassName(level: LogEntry["level"]) {
  switch (level) {
    case "error":
      return "bg-rose-500/15 text-rose-300";
    case "warn":
      return "bg-amber-500/15 text-amber-300";
    case "debug":
      return "bg-sky-500/15 text-sky-300";
    case "trace":
      return "bg-slate-700 text-slate-200";
    default:
      return "bg-emerald-500/15 text-emerald-300";
  }
}

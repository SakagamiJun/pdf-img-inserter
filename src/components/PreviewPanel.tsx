import { useEffect, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Layers3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { renderPreview } from "@/lib/tauri-commands";
import type { PreviewOverlay, PreviewResponse, TaskConfig } from "@/lib/types";
import { cn } from "@/lib/utils";

type PreviewMode = "all" | "focused" | "effect";

interface PreviewPanelProps {
  pdfPath: string | null;
  page: number;
  pageCount: number;
  tasks: TaskConfig[];
  selectedTaskId: string | null;
  onPageChange: (page: number) => void;
}

export function PreviewPanel({
  pdfPath,
  page,
  pageCount,
  tasks,
  selectedTaskId,
  onPageChange,
}: PreviewPanelProps) {
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [mode, setMode] = useState<PreviewMode>("all");

  const enabledTasks = tasks.filter((task) => task.enabled);
  const previewFileName = pdfPath?.split(/[\\/]/).pop() ?? "未选择预览文件";

  useEffect(() => {
    if (!preview) {
      setImageSrc(null);
      return;
    }

    setImageSrc(preview.imageUrl);
  }, [preview]);

  useEffect(() => {
    if (!pdfPath || enabledTasks.length === 0) {
      setPreview(null);
      return;
    }

    let disposed = false;

    const loadPreview = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await renderPreview(pdfPath, page, enabledTasks, selectedTaskId);

        if (!disposed) {
          setPreview(response);
        }
      } catch (err) {
        if (!disposed) {
          setError(err instanceof Error ? err.message : String(err));
          setPreview(null);
        }
      } finally {
        if (!disposed) {
          setLoading(false);
        }
      }
    };

    loadPreview();

    return () => {
      disposed = true;
    };
  }, [page, pdfPath, selectedTaskId, tasks]);

  const overlays = preview
    ? preview.overlays.filter((overlay) => {
        if (mode === "all" || mode === "effect") {
          return true;
        }

        if (selectedTaskId) {
          return overlay.taskName === selectedTaskId;
        }

        return true;
      })
    : [];
  const showGuides = mode !== "effect";
  const previewUsesRandomOffset = overlays.some((overlay) => overlay.randomized);

  if (!pdfPath) {
    return (
      <EmptyState
        title="还没有预览 PDF"
        description="选择一个 PDF 后，右侧会以接近最终输出的方式叠加所有启用任务。"
      />
    );
  }

  if (enabledTasks.length === 0) {
    return (
      <EmptyState
        title="没有可预览的任务"
        description="启用至少一个任务后，这里会直接显示图片叠加效果与落点辅助线。"
      />
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/70 bg-white/70 px-4 py-3 backdrop-blur">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-[0.24em] text-slate-400">
            Rendered Preview
          </div>
          <div className="mt-1 flex items-center gap-2 text-sm font-medium text-slate-800">
            <Layers3 className="h-4 w-4 text-slate-500" />
            <span className="truncate">{previewFileName}</span>
            <span className="text-slate-400">·</span>
            <span className="shrink-0">
              第 {page + 1} / {Math.max(pageCount, 1)} 页
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <SegmentedControl
            value={mode}
            onChange={setMode}
            options={[
              { value: "all", label: "全部叠加" },
              { value: "focused", label: "仅当前任务" },
              { value: "effect", label: "纯效果" },
            ]}
          />

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onPageChange(Math.max(0, page - 1))}
              disabled={page <= 0 || loading}
              className="rounded-full"
            >
              <ChevronLeft className="mr-1 h-3.5 w-3.5" />
              上一页
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onPageChange(Math.min(pageCount - 1, page + 1))}
              disabled={pageCount <= 1 || page >= pageCount - 1 || loading}
              className="rounded-full"
            >
              下一页
              <ChevronRight className="ml-1 h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      <div className="relative flex-1 overflow-auto bg-[radial-gradient(circle_at_top,_rgba(248,250,252,0.86),_rgba(226,232,240,0.55))] p-4">
        {loading && (
          <div className="flex h-full min-h-[320px] items-center justify-center">
            <div className="flex items-center gap-3 rounded-full border border-slate-200 bg-white/90 px-4 py-2 text-sm text-slate-600 shadow-sm">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
              后端正在渲染切片...
            </div>
          </div>
        )}

        {!loading && error && (
          <div className="flex h-full min-h-[320px] items-center justify-center">
            <div className="max-w-md rounded-3xl border border-rose-200 bg-rose-50 px-5 py-4 text-center text-sm text-rose-700 shadow-sm">
              <div className="font-medium">预览失败</div>
              <div className="mt-1 text-xs text-rose-600">{error}</div>
            </div>
          </div>
        )}

        {!loading && !error && preview && (
          <div className="flex min-h-full items-start justify-center">
            <div className="relative inline-block overflow-hidden rounded-[30px] bg-white p-2 shadow-[0_30px_90px_rgba(15,23,42,0.16)]">
              <img
                src={imageSrc ?? preview.imageUrl}
                alt="PDF preview"
                className="block max-h-[84vh] max-w-full rounded-[24px]"
                onError={() => {
                  setImageSrc(null);
                }}
              />

              <div className="pointer-events-none absolute inset-2">
                {showGuides ? (
                  <svg className="absolute inset-0 h-full w-full overflow-visible">
                    {overlays.map((overlay, index) => (
                      <ConnectorOverlay key={`${overlay.taskName}-connector-${index}`} overlay={overlay} />
                    ))}
                  </svg>
                ) : null}

                {overlays.map((overlay, index) => {
                  return (
                    <ImageOverlay
                      key={`${overlay.taskName}-${index}`}
                      overlay={overlay}
                      src={overlay.imageUrl}
                      showGuides={showGuides}
                    />
                  );
                })}
              </div>

              <div className="pointer-events-none absolute right-5 top-5 flex max-w-[280px] flex-wrap items-center justify-end gap-2">
                <FloatChip>{enabledTasks.length} 个启用任务</FloatChip>
                {selectedTaskId ? <FloatChip strong>当前任务: {selectedTaskId}</FloatChip> : null}
                {previewUsesRandomOffset ? <FloatChip>随机偏移使用稳定采样</FloatChip> : null}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ConnectorOverlay({ overlay }: { overlay: PreviewOverlay }) {
  const start = rectCenter(overlay.matchRect);
  const end = rectCenter(overlay.imageRect);
  const stroke = overlay.selected ? "rgba(239, 68, 68, 0.9)" : "rgba(16, 185, 129, 0.82)";
  const fill = overlay.selected ? "rgba(239, 68, 68, 0.96)" : "rgba(16, 185, 129, 0.9)";

  return (
    <g>
      <line
        x1={`${start.x * 100}%`}
        y1={`${start.y * 100}%`}
        x2={`${end.x * 100}%`}
        y2={`${end.y * 100}%`}
        stroke={stroke}
        strokeWidth={overlay.selected ? 1.8 : 1.1}
        strokeLinecap="round"
      />
      <circle cx={`${start.x * 100}%`} cy={`${start.y * 100}%`} r="4" fill={fill} />
    </g>
  );
}

function ImageOverlay({
  overlay,
  src,
  showGuides,
}: {
  overlay: PreviewOverlay;
  src: string | null;
  showGuides: boolean;
}) {
  return (
    <div
      className={cn(
        "absolute overflow-hidden rounded-[14px] shadow-[0_8px_28px_rgba(15,23,42,0.10)]",
        showGuides
          ? overlay.selected
            ? "border-2 border-rose-500/95"
            : "border border-emerald-500/90"
          : "border border-transparent"
      )}
      style={{
        left: `${overlay.imageRect.x * 100}%`,
        top: `${overlay.imageRect.y * 100}%`,
        width: `${overlay.imageRect.width * 100}%`,
        height: `${overlay.imageRect.height * 100}%`,
      }}
    >
      {src ? (
        <img src={src} alt={overlay.taskName} className="h-full w-full object-fill" />
      ) : (
        <div className="h-full w-full bg-[linear-gradient(135deg,_rgba(148,163,184,0.18),_rgba(226,232,240,0.55))]" />
      )}
    </div>
  );
}

function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (next: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="inline-flex items-center rounded-full border border-slate-200 bg-white/85 p-1 shadow-sm">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={cn(
            "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
            option.value === value
              ? "bg-slate-900 text-white"
              : "text-slate-500 hover:text-slate-900"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function FloatChip({
  children,
  strong = false,
}: {
  children: ReactNode;
  strong?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-full border px-3 py-1.5 text-[11px] shadow-sm backdrop-blur",
        strong
          ? "border-rose-200 bg-white/92 font-medium text-rose-800"
          : "border-white/70 bg-white/78 text-slate-600"
      )}
    >
      {children}
    </div>
  );
}

function rectCenter(rect: PreviewOverlay["imageRect"]) {
  return {
    x: rect.x + rect.width / 2,
    y: rect.y + rect.height / 2,
  };
}

function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex h-full items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(248,250,252,0.82),_rgba(226,232,240,0.48))]">
      <div className="max-w-md rounded-[28px] border border-white/80 bg-white/80 px-6 py-6 text-center shadow-[0_24px_80px_rgba(148,163,184,0.16)] backdrop-blur">
        <div className="text-base font-semibold text-slate-900">{title}</div>
        <div className="mt-2 text-sm leading-6 text-slate-500">{description}</div>
      </div>
    </div>
  );
}

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
  processing?: boolean;
  progress?: { current: number; total: number };
  toolbarActions?: ReactNode;
  onPageChange: (page: number) => void;
}

export function PreviewPanel({
  pdfPath,
  page,
  pageCount,
  tasks,
  selectedTaskId,
  processing = false,
  progress = { current: 0, total: 0 },
  toolbarActions,
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
      } catch (loadError) {
        if (!disposed) {
          setError(loadError instanceof Error ? loadError.message : String(loadError));
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

  let content: ReactNode;

  if (!pdfPath) {
    content = (
      <EmptyState
        title="还没有预览 PDF"
        description="从主工具栏选择一个 PDF 后，右侧会以接近最终输出的方式展示图片叠加效果。"
      />
    );
  } else if (enabledTasks.length === 0) {
    content = (
      <EmptyState
        title="没有启用的任务"
        description="启用至少一个任务后，这里会直接显示图片叠加效果与落点辅助线。"
      />
    );
  } else if (loading) {
    content = (
      <div className="flex h-full min-h-[340px] items-center justify-center">
        <div className="panel-surface-muted flex items-center gap-3 rounded-full px-4 py-2 text-sm text-muted-foreground">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-border border-t-foreground" />
          后端正在渲染预览...
        </div>
      </div>
    );
  } else if (error) {
    content = (
      <div className="flex h-full min-h-[340px] items-center justify-center">
        <div className="panel-surface-muted max-w-md rounded-3xl px-5 py-4 text-center">
          <div className="text-base font-medium text-foreground">预览失败</div>
          <div className="mt-2 text-sm text-muted-foreground">{error}</div>
        </div>
      </div>
    );
  } else if (preview) {
    content = (
      <div className="flex min-h-full items-start justify-center">
        <div className="panel-surface-strong relative inline-block overflow-hidden rounded-[24px] p-3">
          <img
            src={imageSrc ?? preview.imageUrl}
            alt="PDF preview"
            className="block max-h-[82vh] max-w-full rounded-[18px]"
            onError={() => setImageSrc(null)}
          />

          <div className="pointer-events-none absolute inset-3">
            {showGuides ? (
              <svg className="absolute inset-0 h-full w-full overflow-visible">
                {overlays.map((overlay, index) => (
                  <ConnectorOverlay key={`${overlay.taskName}-connector-${index}`} overlay={overlay} />
                ))}
              </svg>
            ) : null}

            {overlays.map((overlay, index) => (
              <ImageOverlay
                key={`${overlay.taskName}-${index}`}
                overlay={overlay}
                src={overlay.imageUrl}
                showGuides={showGuides}
              />
            ))}
          </div>
        </div>
      </div>
    );
  } else {
    content = (
      <EmptyState
        title="预览准备中"
        description="当前状态还没有可显示的切片，请稍后再试。"
      />
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b hairline px-5 py-4">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
            Preview Workspace
          </div>
          <div className="mt-2 flex min-w-0 flex-wrap items-center gap-2 text-sm text-foreground">
            <Layers3 className="h-4 w-4 text-muted-foreground" />
            <span className="max-w-[340px] truncate font-medium">{previewFileName}</span>
            <StatusPill>{enabledTasks.length} 个启用任务</StatusPill>
            <StatusPill>第 {page + 1} / {Math.max(pageCount, 1)} 页</StatusPill>
            {progress.total > 0 ? (
              <StatusPill>
                {processing ? "处理中" : "最近批处理"} {progress.current}/{progress.total}
              </StatusPill>
            ) : null}
            {selectedTaskId ? <StatusPill>当前任务 {selectedTaskId}</StatusPill> : null}
            {previewUsesRandomOffset ? <StatusPill>含随机偏移</StatusPill> : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <SegmentedControl
            value={mode}
            onChange={setMode}
            options={[
              { value: "all", label: "全部叠加" },
              { value: "focused", label: "当前任务" },
              { value: "effect", label: "纯效果" },
            ]}
          />
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onPageChange(Math.max(0, page - 1))}
              disabled={page <= 0 || loading}
              className="h-9 rounded-xl px-3"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onPageChange(Math.min(pageCount - 1, page + 1))}
              disabled={pageCount <= 1 || page >= pageCount - 1 || loading}
              className="h-9 rounded-xl px-3"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          {toolbarActions}
        </div>
      </div>

      <div className="relative min-h-0 flex-1 overflow-auto px-5 py-5">{content}</div>
    </div>
  );
}

function ConnectorOverlay({ overlay }: { overlay: PreviewOverlay }) {
  const start = rectCenter(overlay.matchRect);
  const end = rectCenter(overlay.imageRect);
  const stroke = overlay.selected
    ? "color-mix(in srgb, var(--app-destructive) 72%, white)"
    : "color-mix(in srgb, var(--app-success) 72%, white)";
  const fill = overlay.selected ? "var(--app-destructive)" : "var(--app-success)";

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
        "absolute overflow-hidden rounded-[12px]",
        showGuides
          ? overlay.selected
            ? "border-2 border-[color:var(--app-destructive)]"
            : "border border-[color:var(--app-success)]"
          : "border border-transparent"
      )}
      style={{
        left: `${overlay.imageRect.x * 100}%`,
        top: `${overlay.imageRect.y * 100}%`,
        width: `${overlay.imageRect.width * 100}%`,
        height: `${overlay.imageRect.height * 100}%`,
        boxShadow: "var(--app-shadow-soft)",
      }}
    >
      {src ? (
        <img src={src} alt={overlay.taskName} className="h-full w-full object-fill" />
      ) : (
        <div className="h-full w-full bg-muted" />
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
    <div className="inline-flex items-center rounded-xl border border-border bg-muted p-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={cn(
            "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
            option.value === value
              ? "bg-background text-foreground shadow-[var(--app-shadow-soft)]"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function StatusPill({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-full border border-border bg-background/80 px-2.5 py-1 text-[11px] text-muted-foreground">
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
    <div className="flex h-full items-center justify-center px-6">
      <div className="panel-surface-muted max-w-md rounded-[28px] px-6 py-6 text-center">
        <div className="text-base font-semibold text-foreground">{title}</div>
        <div className="mt-2 text-sm leading-6 text-muted-foreground">{description}</div>
      </div>
    </div>
  );
}

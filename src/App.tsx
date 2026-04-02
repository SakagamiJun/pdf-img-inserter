import { useCallback, useEffect, useState } from "react";
import {
  FileText,
  FolderCog,
  LayoutList,
  Play,
  Plus,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfigPanel } from "@/components/ConfigPanel";
import { LogConsole } from "@/components/LogConsole";
import { PreviewPanel } from "@/components/PreviewPanel";
import { TaskDialog } from "@/components/TaskDialog";
import { TaskList } from "@/components/TaskList";
import { useAppState } from "@/hooks/useAppState";
import { useConfig } from "@/hooks/useConfig";
import { getPageCount, openFile, processFiles } from "@/lib/tauri-commands";
import type { LogEntry, TaskConfig } from "@/lib/types";
import { cn } from "@/lib/utils";

type SidebarTab = "tasks" | "config";

function App() {
  const {
    config,
    configPath,
    loadConfig,
    saveConfig,
    initDefaultConfig,
    updateTask,
    addTask,
    removeTask,
    toggleTask,
    reorderTasks,
    setAllTasksEnabled,
    updateGlobalConfig,
  } = useConfig();

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [previewPdf, setPreviewPdf] = useState<string | null>(null);
  const [previewPage, setPreviewPage] = useState(0);
  const [previewPageCount, setPreviewPageCount] = useState(0);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskConfig | undefined>();
  const [leftPanelWidth, setLeftPanelWidth] = useState(360);
  const [isResizing, setIsResizing] = useState(false);
  const [consoleCollapsed, setConsoleCollapsed] = useState(true);
  const [activeSidebarTab, setActiveSidebarTab] = useState<SidebarTab>("tasks");

  useAppState(setLogs, setProcessing, setProgress, setConsoleCollapsed);

  const addLog = useCallback(
    (
      level: LogEntry["level"],
      message: string,
      options?: Pick<LogEntry, "target" | "fields">
    ) => {
      if (level === "error") {
        setConsoleCollapsed(false);
      }

      setLogs((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          timestamp: new Date(),
          level,
          message,
          target: options?.target,
          fields: options?.fields,
        },
      ]);
    },
    []
  );

  const handleLoadConfig = useCallback(
    async (path: string) => {
      const loaded = await loadConfig(path);
      if (loaded) {
        addLog("info", `已加载配置文件: ${path}`);
        const nextSelectedTask =
          loaded.tasks.find((task) => task.name === selectedTaskId)?.name ??
          loaded.tasks[0]?.name ??
          null;
        setSelectedTaskId(nextSelectedTask);
      }
    },
    [addLog, loadConfig, selectedTaskId]
  );

  const handleSaveConfig = useCallback(async () => {
    if (!config || !configPath) return;

    try {
      await saveConfig(configPath, config);
      addLog("info", `已保存配置文件: ${configPath}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      addLog("error", `保存配置失败: ${message}`, { target: "config" });
      throw err;
    }
  }, [addLog, config, configPath, saveConfig]);

  const handleProcess = useCallback(async () => {
    if (!config || processing) return;

    const enabledTasks = config.tasks.filter((task) => task.enabled);
    if (enabledTasks.length === 0) {
      addLog("warn", "没有启用的任务，已取消处理。");
      return;
    }

    setProcessing(true);
    setLogs([]);
    addLog("info", `开始处理，共 ${enabledTasks.length} 个任务。`, {
      target: "ui",
    });

    try {
      await processFiles(
        config.global.inputFolder,
        config.global.outputFolder,
        enabledTasks,
        previewPdf
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      addLog("error", `处理失败: ${message}`, { target: "ui" });
      setProcessing(false);
    }
  }, [addLog, config, previewPdf, processing]);

  const handleSelectPreviewPdf = useCallback(async () => {
    const path = await openFile("选择 PDF 文件", [
      { name: "PDF", extensions: ["pdf"] },
    ]);

    if (!path) return;

    const fileName = path.split(/[\\/]/).pop() ?? path;
    setPreviewPdf(path);
    setPreviewPage(0);
    setPreviewPageCount(0);

    try {
      const pageCount = await getPageCount(path);
      setPreviewPageCount(pageCount);
      addLog("info", `已载入预览文件: ${fileName} (${pageCount} 页)`, {
        target: "preview",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      addLog("error", `已选择预览文件 ${fileName}，但读取页数失败: ${message}`, {
        target: "preview",
      });
    }
  }, [addLog]);

  const handleEditTask = useCallback((task: TaskConfig) => {
    setEditingTask(task);
    setTaskDialogOpen(true);
  }, []);

  const handleDeleteTask = useCallback(
    (taskId: string) => {
      if (!confirm(`确定要删除任务 "${taskId}" 吗？`)) return;

      removeTask(taskId);
      addLog("info", `已删除任务: ${taskId}`);
      if (selectedTaskId === taskId) {
        setSelectedTaskId(config?.tasks.find((task) => task.name !== taskId)?.name ?? null);
      }
    },
    [addLog, config?.tasks, removeTask, selectedTaskId]
  );

  const handleSaveTask = useCallback(
    (task: TaskConfig) => {
      if (editingTask) {
        updateTask(editingTask.name, task);
        addLog("info", `已更新任务: ${task.name}`);
      } else {
        addTask(task);
        addLog("info", `已添加任务: ${task.name}`);
      }

      setSelectedTaskId(task.name);
      setTaskDialogOpen(false);
      setEditingTask(undefined);
    },
    [addLog, addTask, editingTask, updateTask]
  );

  const handleAddTask = useCallback(() => {
    setEditingTask(undefined);
    setTaskDialogOpen(true);
  }, []);

  const handleMouseDown = useCallback(() => {
    setIsResizing(true);
  }, []);

  const handleMouseMove = useCallback(
    (event: React.MouseEvent) => {
      if (!isResizing) return;
      const nextWidth = Math.max(320, Math.min(520, event.clientX - 12));
      setLeftPanelWidth(nextWidth);
    },
    [isResizing]
  );

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
  }, []);

  useEffect(() => {
    initDefaultConfig().then((loaded) => {
      if (loaded?.tasks?.length) {
        setSelectedTaskId(loaded.tasks[0].name);
      }
    });
  }, [initDefaultConfig]);

  const enabledTaskCount = config?.tasks.filter((task) => task.enabled).length ?? 0;
  const previewFileName = previewPdf?.split(/[\\/]/).pop() ?? null;
  const logIssueCount = logs.filter(
    (log) => log.level === "error" || log.level === "warn"
  ).length;

  useEffect(() => {
    const lastLog = logs[logs.length - 1];
    if (lastLog?.level === "error") {
      setActiveSidebarTab("config");
    }
  }, [logs]);

  return (
    <div
      className="flex h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(253,224,71,0.16),_transparent_26%),radial-gradient(circle_at_bottom_right,_rgba(148,163,184,0.22),_transparent_28%),linear-gradient(180deg,_#fffef8_0%,_#f8fafc_44%,_#eef2f7_100%)] p-3"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <aside
        className="flex shrink-0 flex-col overflow-hidden rounded-[30px] border border-white/70 bg-white/78 shadow-[0_24px_80px_rgba(148,163,184,0.22)] backdrop-blur"
        style={{ width: leftPanelWidth }}
      >
        <div className="border-b border-slate-200/70 px-4 pb-4 pt-4">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.3em] text-slate-400">
            <Sparkles className="h-3.5 w-3.5" />
            PDFImgInserter Reforged
          </div>
          <div className="mt-2 flex items-end justify-between gap-3">
            <div>
              <h1 className="text-lg font-semibold tracking-tight text-slate-900">控制中心</h1>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                左侧集中配置与任务管理，右侧专注预览最终落版效果。
              </p>
            </div>
            {previewFileName ? (
              <div className="max-w-[150px] rounded-2xl border border-slate-200 bg-white/90 px-3 py-2 text-right shadow-sm">
                <div className="text-[10px] uppercase tracking-[0.22em] text-slate-400">Preview</div>
                <div className="mt-1 truncate text-xs font-medium text-slate-700">
                  {previewFileName}
                </div>
              </div>
            ) : null}
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <MetricCard label="任务" value={`${config?.tasks.length ?? 0}`} />
            <MetricCard label="启用" value={`${enabledTaskCount}`} accent="amber" />
            <MetricCard
              label="进度"
              value={`${progress.current}/${Math.max(progress.total, 0)}`}
              accent={processing ? "emerald" : "slate"}
            />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleSelectPreviewPdf}
              disabled={processing}
              className="h-10 justify-start rounded-2xl border-slate-200 bg-white/90 px-4 text-slate-700 shadow-sm hover:bg-slate-50"
            >
              <FileText className="mr-2 h-4 w-4" />
              选择预览 PDF
            </Button>
            <Button
              size="sm"
              onClick={handleProcess}
              disabled={processing || !config || config.tasks.length === 0}
              className="h-10 justify-start rounded-2xl bg-slate-900 px-4 text-white shadow-sm hover:bg-slate-800"
            >
              <Play className="mr-2 h-4 w-4" />
              {processing ? "处理中..." : "开始批处理"}
            </Button>
          </div>
        </div>

        <div className="border-b border-slate-200/70 px-3 py-3">
          <div className="grid grid-cols-2 gap-2">
            <SidebarTabButton
              icon={LayoutList}
              label="任务矩阵"
              active={activeSidebarTab === "tasks"}
              onClick={() => setActiveSidebarTab("tasks")}
              badge={config?.tasks.length ?? 0}
            />
            <SidebarTabButton
              icon={FolderCog}
              label="配置"
              active={activeSidebarTab === "config"}
              onClick={() => setActiveSidebarTab("config")}
              badge={logIssueCount > 0 ? logIssueCount : undefined}
              danger={logIssueCount > 0}
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 px-3 pb-3 pt-3">
          {activeSidebarTab === "tasks" ? (
            <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[26px] border border-slate-200/70 bg-slate-50/70">
              <div className="flex items-center justify-between gap-3 border-b border-slate-200/70 px-4 py-3">
                <div>
                  <div className="text-sm font-semibold text-slate-900">任务矩阵</div>
                  <div className="text-xs text-slate-500">拖拽排序、批量开关、单项编辑</div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setAllTasksEnabled(true)}
                    disabled={!config || config.tasks.length === 0}
                    className="rounded-full"
                  >
                    全开
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setAllTasksEnabled(false)}
                    disabled={!config || config.tasks.length === 0}
                    className="rounded-full"
                  >
                    全关
                  </Button>
                  <Button size="sm" onClick={handleAddTask} className="rounded-full">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="min-h-0 flex-1 overflow-auto px-3 py-3">
                <TaskList
                  tasks={config?.tasks ?? []}
                  selectedTaskId={selectedTaskId}
                  onSelect={setSelectedTaskId}
                  onEdit={handleEditTask}
                  onDelete={handleDeleteTask}
                  onToggle={toggleTask}
                  onReorder={reorderTasks}
                />
              </div>
            </div>
          ) : null}

          {activeSidebarTab === "config" ? (
            <div className="flex h-full min-h-0 flex-col gap-3 rounded-[26px] border border-slate-200/70 bg-slate-50/70 p-3">
              <div className="min-h-0 flex-1 overflow-auto rounded-[22px] bg-transparent px-1 py-1">
                <ConfigPanel
                  configPath={configPath}
                  inputFolder={config?.global.inputFolder ?? ""}
                  outputFolder={config?.global.outputFolder ?? ""}
                  onConfigPathChange={handleLoadConfig}
                  onInputFolderChange={(path) => updateGlobalConfig({ inputFolder: path })}
                  onOutputFolderChange={(path) => updateGlobalConfig({ outputFolder: path })}
                  onSave={handleSaveConfig}
                />
              </div>

              <div className={consoleCollapsed ? "h-[58px] shrink-0" : "h-[250px] shrink-0"}>
                <LogConsole
                  logs={logs}
                  collapsed={consoleCollapsed}
                  onCollapsedChange={setConsoleCollapsed}
                  onClear={() => setLogs([])}
                />
              </div>
            </div>
          ) : null}
        </div>
      </aside>

      <div
        className="mx-3 w-1 shrink-0 cursor-col-resize rounded-full bg-slate-300/60 transition-colors hover:bg-amber-400/70"
        onMouseDown={handleMouseDown}
      />

      <main className="min-w-0 flex-1 overflow-hidden rounded-[34px] border border-white/70 bg-white/62 shadow-[0_24px_80px_rgba(148,163,184,0.18)] backdrop-blur">
        <PreviewPanel
          pdfPath={previewPdf}
          page={previewPage}
          pageCount={previewPageCount}
          tasks={config?.tasks ?? []}
          selectedTaskId={selectedTaskId}
          onPageChange={setPreviewPage}
        />
      </main>

      <TaskDialog
        open={taskDialogOpen}
        task={editingTask}
        existingNames={config?.tasks.map((task) => task.name) ?? []}
        onSave={handleSaveTask}
        onClose={() => {
          setTaskDialogOpen(false);
          setEditingTask(undefined);
        }}
      />
    </div>
  );
}

function MetricCard({
  label,
  value,
  accent = "slate",
}: {
  label: string;
  value: string;
  accent?: "slate" | "amber" | "emerald";
}) {
  const accentStyles = {
    slate: "border-slate-200 bg-white/85 text-slate-800",
    amber: "border-amber-200 bg-amber-50 text-amber-900",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-900",
  };

  return (
    <div className={cn("rounded-[22px] border px-3 py-3 shadow-sm", accentStyles[accent])}>
      <div className="text-[10px] uppercase tracking-[0.22em] text-slate-400">{label}</div>
      <div className="mt-1 text-base font-semibold">{value}</div>
    </div>
  );
}

function SidebarTabButton({
  icon: Icon,
  label,
  active,
  onClick,
  badge,
  danger = false,
}: {
  icon: typeof LayoutList;
  label: string;
  active: boolean;
  onClick: () => void;
  badge?: number;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center justify-between rounded-[20px] border px-3 py-2 text-left transition-colors",
        active
          ? "border-slate-900 bg-slate-900 text-white shadow-sm"
          : "border-slate-200 bg-white/85 text-slate-600 hover:border-slate-300 hover:text-slate-900"
      )}
    >
      <span className="flex items-center gap-2 min-w-0">
        <Icon className="h-4 w-4 shrink-0" />
        <span className="truncate text-xs font-medium">{label}</span>
      </span>
      {badge !== undefined ? (
        <span
          className={cn(
            "ml-2 inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
            active
              ? "bg-white/15 text-white"
              : danger
                ? "bg-rose-100 text-rose-700"
                : "bg-slate-100 text-slate-500"
          )}
        >
          {badge}
        </span>
      ) : null}
    </button>
  );
}

export default App;

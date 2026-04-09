import { useCallback, useEffect, useState } from "react";
import {
  ChevronsLeft,
  ChevronsRight,
  FileText,
  FolderCog,
  LayoutList,
  Monitor,
  Moon,
  Play,
  Plus,
  Sun,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfigPanel } from "@/components/ConfigPanel";
import { LogConsole } from "@/components/LogConsole";
import { PreviewPanel } from "@/components/PreviewPanel";
import { TaskDialog } from "@/components/TaskDialog";
import { TaskList } from "@/components/TaskList";
import { useAppState } from "@/hooks/useAppState";
import { useConfig } from "@/hooks/useConfig";
import { useTheme, type ThemeMode } from "@/hooks/useTheme";
import { getPageCount, openFile, processFiles } from "@/lib/tauri-commands";
import type { AppConfig, LogEntry, TaskConfig } from "@/lib/types";
import { cn } from "@/lib/utils";

type WorkspaceSection = "tasks" | "config" | "logs";

const PANEL_MIN_WIDTH = 320;
const PANEL_MAX_WIDTH = 400;
const RAIL_WIDTH = 72;
const COMPACT_BREAKPOINT = 1220;

function App() {
  const {
    config,
    configPath,
    mutationVersion,
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
  const { themeMode, resolvedTheme, setThemeMode } = useTheme();

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [previewPdf, setPreviewPdf] = useState<string | null>(null);
  const [previewPage, setPreviewPage] = useState(0);
  const [previewPageCount, setPreviewPageCount] = useState(0);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskConfig | undefined>();
  const [activeSection, setActiveSection] = useState<WorkspaceSection>("tasks");
  const [contextVisible, setContextVisible] = useState(true);
  const [contextWidth, setContextWidth] = useState(360);
  const [isResizing, setIsResizing] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
  const [hasUnreadErrors, setHasUnreadErrors] = useState(false);

  useAppState(setLogs, setProcessing, setProgress);

  const addLog = useCallback(
    (
      level: LogEntry["level"],
      message: string,
      options?: Pick<LogEntry, "target" | "fields">
    ) => {
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
        setSelectedTaskId(loaded.tasks[0]?.name ?? null);
      }
    },
    [addLog, loadConfig]
  );

  const handleSaveConfig = useCallback(async () => {
    if (!config || !configPath) {
      return;
    }

    try {
      await saveConfig(configPath, config, { mutationVersion });
      addLog("info", `已保存配置文件: ${configPath}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      addLog("error", `保存配置失败: ${message}`, { target: "config" });
      throw error;
    }
  }, [addLog, config, configPath, mutationVersion, saveConfig]);

  const handleProcess = useCallback(async () => {
    if (!config || processing) {
      return;
    }

    const enabledTasks = config.tasks.filter((task) => task.enabled);
    if (enabledTasks.length === 0) {
      addLog("warn", "没有启用的任务，已取消处理。");
      return;
    }

    setProcessing(true);
    setLogs([]);
    setHasUnreadErrors(false);
    addLog("info", `开始处理，共 ${enabledTasks.length} 个任务。`, { target: "ui" });

    try {
      await processFiles(
        config.global.inputFolder,
        config.global.outputFolder,
        enabledTasks,
        previewPdf
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      addLog("error", `处理失败: ${message}`, { target: "ui" });
      setProcessing(false);
    }
  }, [addLog, config, previewPdf, processing]);

  const handleSelectPreviewPdf = useCallback(async () => {
    const path = await openFile("选择 PDF 文件", [{ name: "PDF", extensions: ["pdf"] }]);
    if (!path) {
      return;
    }

    const fileName = path.split(/[\\/]/).pop() ?? path;
    setPreviewPdf(path);
    setPreviewPage(0);
    setPreviewPageCount(0);

    try {
      const pageCount = await getPageCount(path);
      setPreviewPageCount(pageCount);
      addLog("info", `已载入预览文件: ${fileName} (${pageCount} 页)`, { target: "preview" });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
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
      if (!confirm(`确定要删除任务 "${taskId}" 吗？`)) {
        return;
      }

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
      setActiveSection("tasks");
      setContextVisible(true);
    },
    [addLog, addTask, editingTask, updateTask]
  );

  const handleAddTask = useCallback(() => {
    setEditingTask(undefined);
    setTaskDialogOpen(true);
  }, []);

  const handleSectionChange = useCallback(
    (section: WorkspaceSection) => {
      if (activeSection === section && contextVisible) {
        setContextVisible(false);
        return;
      }

      setActiveSection(section);
      setContextVisible(true);
    },
    [activeSection, contextVisible]
  );

  const handleMouseMove = useCallback(
    (event: React.MouseEvent) => {
      if (!isResizing) {
        return;
      }

      const nextWidth = Math.max(
        PANEL_MIN_WIDTH,
        Math.min(PANEL_MAX_WIDTH, event.clientX - 12 - RAIL_WIDTH)
      );
      setContextWidth(nextWidth);
    },
    [isResizing]
  );

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
  }, []);

  useEffect(() => {
    initDefaultConfig().then((loaded) => {
      if (loaded?.tasks.length) {
        setSelectedTaskId(loaded.tasks[0].name);
      }
    });
  }, [initDefaultConfig]);

  useEffect(() => {
    const handleResize = () => {
      setViewportWidth(window.innerWidth);
      setContextWidth((current) =>
        Math.max(PANEL_MIN_WIDTH, Math.min(PANEL_MAX_WIDTH, current))
      );
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (activeSection === "logs") {
      setHasUnreadErrors(false);
    }
  }, [activeSection]);

  useEffect(() => {
    const lastLog = logs[logs.length - 1];
    if (lastLog?.level === "error" && activeSection !== "logs") {
      setHasUnreadErrors(true);
    }
  }, [activeSection, logs]);

  const isCompact = viewportWidth < COMPACT_BREAKPOINT;
  const previewFileName = previewPdf?.split(/[\\/]/).pop() ?? null;
  const enabledTaskCount = config?.tasks.filter((task) => task.enabled).length ?? 0;
  const hasInlinePanel = contextVisible && !isCompact;
  const hasOverlayPanel = contextVisible && isCompact;

  return (
    <div
      className="app-shell h-screen overflow-hidden p-3"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <div className="panel-surface-strong relative flex h-full w-full overflow-hidden rounded-[28px]">
        <aside className="flex h-full w-[72px] shrink-0 flex-col items-center justify-between border-r hairline bg-[var(--app-sidebar)] px-3 py-4">
          <div className="flex flex-col items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-foreground text-background text-sm font-semibold">
              PI
            </div>
            <div className="space-y-2">
              <RailButton
                label="任务"
                icon={LayoutList}
                active={activeSection === "tasks" && contextVisible}
                onClick={() => handleSectionChange("tasks")}
              />
              <RailButton
                label="配置"
                icon={FolderCog}
                active={activeSection === "config" && contextVisible}
                onClick={() => handleSectionChange("config")}
              />
              <RailButton
                label="日志"
                icon={FileText}
                active={activeSection === "logs" && contextVisible}
                onClick={() => handleSectionChange("logs")}
                dot={hasUnreadErrors}
              />
            </div>
          </div>

          <div className="flex flex-col items-center gap-3">
            <ThemeSwitcher
              themeMode={themeMode}
              resolvedTheme={resolvedTheme}
              onThemeModeChange={setThemeMode}
            />
            <button
              type="button"
              title={contextVisible ? "隐藏侧栏" : "展开侧栏"}
              onClick={() => setContextVisible((current) => !current)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-background/80 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              {contextVisible ? (
                <ChevronsLeft className="h-4 w-4" />
              ) : (
                <ChevronsRight className="h-4 w-4" />
              )}
            </button>
          </div>
        </aside>

        {hasInlinePanel ? (
          <>
            <section
              className="flex h-full shrink-0 flex-col border-r hairline bg-[var(--app-surface)]"
              style={{ width: contextWidth }}
            >
              <WorkspacePanel
                activeSection={activeSection}
                config={config}
                configPath={configPath}
                dirty={mutationVersion > 0}
                logs={logs}
                selectedTaskId={selectedTaskId}
                enabledTaskCount={enabledTaskCount}
                onAddTask={handleAddTask}
                onSelectTask={setSelectedTaskId}
                onEditTask={handleEditTask}
                onDeleteTask={handleDeleteTask}
                onToggleTask={toggleTask}
                onReorderTasks={reorderTasks}
                onSetAllTasksEnabled={setAllTasksEnabled}
                onConfigPathChange={handleLoadConfig}
                onInputFolderChange={(path) => updateGlobalConfig({ inputFolder: path })}
                onOutputFolderChange={(path) => updateGlobalConfig({ outputFolder: path })}
                onSaveConfig={handleSaveConfig}
                onClearLogs={() => setLogs([])}
              />
            </section>

            <div
              className="w-1 shrink-0 cursor-col-resize bg-transparent transition-colors hover:bg-foreground/10"
              onMouseDown={() => setIsResizing(true)}
            />
          </>
        ) : null}

        <main className="min-w-0 flex-1 bg-background/18">
          <PreviewPanel
            pdfPath={previewPdf}
            page={previewPage}
            pageCount={previewPageCount}
            tasks={config?.tasks ?? []}
            selectedTaskId={selectedTaskId}
            processing={processing}
            progress={progress}
            toolbarActions={
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleSelectPreviewPdf}
                  disabled={processing}
                  className="h-9 rounded-xl px-3"
                >
                  <FileText className="mr-1.5 h-4 w-4" />
                  {previewFileName ? "更换预览" : "选择预览"}
                </Button>
                <Button
                  size="sm"
                  onClick={handleProcess}
                  disabled={processing || !config || config.tasks.length === 0}
                  className="h-9 rounded-xl px-3"
                >
                  <Play className="mr-1.5 h-4 w-4" />
                  {processing ? "处理中..." : "开始批处理"}
                </Button>
              </>
            }
            onPageChange={setPreviewPage}
          />
        </main>

        {hasOverlayPanel ? (
          <div className="absolute inset-y-0 left-[72px] z-30 flex w-[min(400px,calc(100%-72px))] max-w-full">
            <button
              type="button"
              aria-label="关闭工作区面板"
              className="absolute inset-0 left-auto right-[-100vw] w-[100vw] bg-[var(--app-overlay)]"
              onClick={() => setContextVisible(false)}
            />
            <section className="panel-surface-strong relative z-10 flex h-full w-full flex-col border-r">
              <WorkspacePanel
                activeSection={activeSection}
                config={config}
                configPath={configPath}
                dirty={mutationVersion > 0}
                logs={logs}
                selectedTaskId={selectedTaskId}
                enabledTaskCount={enabledTaskCount}
                onAddTask={handleAddTask}
                onSelectTask={setSelectedTaskId}
                onEditTask={handleEditTask}
                onDeleteTask={handleDeleteTask}
                onToggleTask={toggleTask}
                onReorderTasks={reorderTasks}
                onSetAllTasksEnabled={setAllTasksEnabled}
                onConfigPathChange={handleLoadConfig}
                onInputFolderChange={(path) => updateGlobalConfig({ inputFolder: path })}
                onOutputFolderChange={(path) => updateGlobalConfig({ outputFolder: path })}
                onSaveConfig={handleSaveConfig}
                onClearLogs={() => setLogs([])}
              />
            </section>
          </div>
        ) : null}
      </div>

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

interface WorkspacePanelProps {
  activeSection: WorkspaceSection;
  config: AppConfig | null;
  configPath: string;
  dirty: boolean;
  logs: LogEntry[];
  selectedTaskId: string | null;
  enabledTaskCount: number;
  onAddTask: () => void;
  onSelectTask: (taskId: string) => void;
  onEditTask: (task: TaskConfig) => void;
  onDeleteTask: (taskId: string) => void;
  onToggleTask: (taskId: string) => void;
  onReorderTasks: (sourceTaskId: string, targetIndex: number) => void;
  onSetAllTasksEnabled: (enabled: boolean) => void;
  onConfigPathChange: (path: string) => void;
  onInputFolderChange: (path: string) => void;
  onOutputFolderChange: (path: string) => void;
  onSaveConfig: () => void;
  onClearLogs: () => void;
}

function WorkspacePanel({
  activeSection,
  config,
  configPath,
  dirty,
  logs,
  selectedTaskId,
  enabledTaskCount,
  onAddTask,
  onSelectTask,
  onEditTask,
  onDeleteTask,
  onToggleTask,
  onReorderTasks,
  onSetAllTasksEnabled,
  onConfigPathChange,
  onInputFolderChange,
  onOutputFolderChange,
  onSaveConfig,
  onClearLogs,
}: WorkspacePanelProps) {
  if (activeSection === "tasks") {
    return (
      <div className="flex h-full min-h-0 flex-col px-5 py-5">
        <div className="border-b hairline pb-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs font-medium text-foreground">任务队列</div>
              <p className="mt-1 text-sm text-muted-foreground">
                当前共 {config?.tasks.length ?? 0} 个任务，其中 {enabledTaskCount} 个启用。
              </p>
            </div>
            <Button size="sm" onClick={onAddTask} className="h-9 rounded-xl px-3">
              <Plus className="mr-1.5 h-4 w-4" />
              新建
            </Button>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => onSetAllTasksEnabled(true)}
              disabled={!config || config.tasks.length === 0}
              className="rounded-xl"
            >
              全部启用
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onSetAllTasksEnabled(false)}
              disabled={!config || config.tasks.length === 0}
              className="rounded-xl"
            >
              全部停用
            </Button>
          </div>
        </div>

        <div className="min-h-0 flex-1 pt-4">
          <TaskList
            tasks={config?.tasks ?? []}
            selectedTaskId={selectedTaskId}
            onSelect={onSelectTask}
            onEdit={onEditTask}
            onDelete={onDeleteTask}
            onToggle={onToggleTask}
            onReorder={onReorderTasks}
          />
        </div>
      </div>
    );
  }

  if (activeSection === "config") {
    return (
      <div className="h-full px-5 py-5">
        <ConfigPanel
          configPath={configPath}
          inputFolder={config?.global.inputFolder ?? ""}
          outputFolder={config?.global.outputFolder ?? ""}
          dirty={dirty}
          onConfigPathChange={onConfigPathChange}
          onInputFolderChange={onInputFolderChange}
          onOutputFolderChange={onOutputFolderChange}
          onSave={onSaveConfig}
        />
      </div>
    );
  }

  return (
    <div className="h-full px-5 py-5">
      <LogConsole logs={logs} onClear={onClearLogs} />
    </div>
  );
}

function RailButton({
  label,
  icon: Icon,
  active,
  onClick,
  dot = false,
}: {
  label: string;
  icon: typeof LayoutList;
  active: boolean;
  onClick: () => void;
  dot?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      onClick={onClick}
      className={cn(
        "relative inline-flex h-11 w-11 items-center justify-center rounded-2xl border transition-colors",
        active
          ? "border-foreground/10 bg-foreground text-background"
          : "border-border bg-background/75 text-muted-foreground hover:bg-accent hover:text-foreground"
      )}
    >
      <Icon className="h-4 w-4" />
      {dot ? (
        <span className="absolute right-2 top-2 status-dot bg-[var(--app-destructive)]" />
      ) : null}
    </button>
  );
}

function ThemeSwitcher({
  themeMode,
  resolvedTheme,
  onThemeModeChange,
}: {
  themeMode: ThemeMode;
  resolvedTheme: "light" | "dark";
  onThemeModeChange: (mode: ThemeMode) => void;
}) {
  const options: { mode: ThemeMode; icon: typeof Sun; label: string }[] = [
    { mode: "light", icon: Sun, label: "浅色" },
    { mode: "system", icon: Monitor, label: "跟随系统" },
    { mode: "dark", icon: Moon, label: "深色" },
  ];

  return (
    <div className="rounded-[20px] border border-border bg-background/80 p-1.5">
      <div className="flex flex-col gap-1">
        {options.map(({ mode, icon: Icon, label }) => (
          <button
            key={mode}
            type="button"
            title={label}
            onClick={() => onThemeModeChange(mode)}
            className={cn(
              "inline-flex h-9 w-9 items-center justify-center rounded-xl transition-colors",
              themeMode === mode
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
          </button>
        ))}
      </div>
      <div className="mt-2 border-t hairline pt-2 text-center text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
        {resolvedTheme}
      </div>
    </div>
  );
}

export default App;

import { type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { TaskConfig } from "@/lib/types";
import { cn } from "@/lib/utils";

interface TaskListProps {
  tasks: TaskConfig[];
  selectedTaskId: string | null;
  onSelect: (taskId: string) => void;
  onEdit: (task: TaskConfig) => void;
  onDelete: (taskId: string) => void;
  onToggle: (taskId: string) => void;
  disabled?: boolean;
}

export function TaskList({
  tasks,
  selectedTaskId,
  onSelect,
  onEdit,
  onDelete,
  onToggle,
  disabled = false,
}: TaskListProps) {
  const { t } = useTranslation();

  if (tasks.length === 0) {
    return (
      <div className="panel-surface-muted flex min-h-[220px] flex-col items-center justify-center rounded-2xl border border-dashed px-6 text-center">
        <p className="text-sm font-medium text-foreground">{t("tasks.empty.title")}</p>
        <p className="mt-2 max-w-xs text-sm text-muted-foreground">
          {t("tasks.empty.description")}
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="space-y-1.5">
        {tasks.map((task, index) => (
          <div
            key={task.name}
            onClick={() => {
              if (!disabled) {
                onSelect(task.name);
              }
            }}
            className={cn(
              "group panel-surface-muted flex min-h-[92px] cursor-pointer items-stretch gap-3 rounded-2xl px-3 py-3 transition-[background,border-color,box-shadow,transform] duration-150",
              selectedTaskId === task.name &&
                "border-[color:var(--app-border-strong)] bg-[var(--app-surface-strong)] shadow-[var(--app-shadow-soft)]",
              !task.enabled && "opacity-65",
              disabled && "cursor-wait"
            )}
          >
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-2">
                <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full border border-border bg-background/80 px-1.5 font-mono text-[11px] text-muted-foreground">
                  {index + 1}
                </span>
                <span className="truncate text-sm font-medium text-foreground">{task.name}</span>
                {!task.enabled ? (
                  <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                    {t("tasks.list.disabled")}
                  </span>
                ) : null}
              </div>

              <div className="mt-2 text-xs leading-5 text-muted-foreground break-all">
                <span className="mr-2 text-[11px] uppercase tracking-[0.14em]">
                  {t("tasks.list.searchLabel")}
                </span>
                {task.searchText}
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
                <TaskMetaChip
                  label={t("tasks.meta.height")}
                  value={`${task.targetHeightPoints}pt`}
                />
                <TaskMetaChip
                  label={t("tasks.meta.baseOffset")}
                  value={`${task.baseOffsetX} / ${task.baseOffsetY}`}
                />
                <TaskMetaChip
                  label={t("tasks.meta.randomOffsetX")}
                  value={`±${task.randomOffsetX}`}
                />
                <TaskMetaChip
                  label={t("tasks.meta.randomOffsetY")}
                  value={`±${task.randomOffsetY}`}
                />
              </div>
            </div>

            <div className="flex w-10 shrink-0 flex-col items-center justify-between gap-1">
              <Switch
                checked={task.enabled}
                disabled={disabled}
                onClick={(event) => {
                  event.stopPropagation();
                }}
                onCheckedChange={() => onToggle(task.name)}
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-xl text-muted-foreground hover:text-foreground"
                aria-label={t("tasks.list.edit", { taskName: task.name })}
                title={t("tasks.list.edit", { taskName: task.name })}
                disabled={disabled}
                onClick={(event) => {
                  event.stopPropagation();
                  onEdit(task);
                }}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-xl text-destructive hover:text-destructive"
                aria-label={t("tasks.list.delete", { taskName: task.name })}
                title={t("tasks.list.delete", { taskName: task.name })}
                disabled={disabled}
                onClick={(event) => {
                  event.stopPropagation();
                  onDelete(task.name);
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}

function TaskMetaChip({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-background/72 px-2.5 py-1.5">
      <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-[11px] text-foreground">{value}</div>
    </div>
  );
}

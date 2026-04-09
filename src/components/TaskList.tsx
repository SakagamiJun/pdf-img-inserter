import { useState, type ReactNode } from "react";
import { Eye, EyeOff, GripVertical, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import type { TaskConfig } from "@/lib/types";
import { cn } from "@/lib/utils";

interface TaskListProps {
  tasks: TaskConfig[];
  selectedTaskId: string | null;
  onSelect: (taskId: string) => void;
  onEdit: (task: TaskConfig) => void;
  onDelete: (taskId: string) => void;
  onToggle: (taskId: string) => void;
  onReorder: (sourceTaskId: string, targetIndex: number) => void;
}

export function TaskList({
  tasks,
  selectedTaskId,
  onSelect,
  onEdit,
  onDelete,
  onToggle,
  onReorder,
}: TaskListProps) {
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  if (tasks.length === 0) {
    return (
      <div className="panel-surface-muted flex min-h-[220px] flex-col items-center justify-center rounded-2xl border border-dashed px-6 text-center">
        <p className="text-sm font-medium text-foreground">还没有任务</p>
        <p className="mt-2 max-w-xs text-sm text-muted-foreground">
          添加任务后，这里会变成高密度任务队列。预览区会立即使用启用任务进行叠加。
        </p>
      </div>
    );
  }

  const handleDrop = (sourceTaskId: string, nextDropIndex: number | null) => {
    if (nextDropIndex === null) {
      return;
    }

    onReorder(sourceTaskId, nextDropIndex);
  };

  return (
    <div className="min-h-0 overflow-auto pr-1">
      <div className="space-y-1.5">
        {tasks.map((task, index) => (
          <div
            key={task.name}
            onDragOver={(event) => {
              event.preventDefault();
              const bounds = event.currentTarget.getBoundingClientRect();
              const nextIndex =
                event.clientY <= bounds.top + bounds.height / 2 ? index : index + 1;
              setDropIndex(nextIndex);
            }}
            onDrop={(event) => {
              event.preventDefault();
              const sourceTaskId = event.dataTransfer.getData("text/plain");
              handleDrop(sourceTaskId, dropIndex);
              setDraggingTaskId(null);
              setDropIndex(null);
            }}
          >
            {draggingTaskId && dropIndex === index ? <DropPlaceholder /> : null}
            <div
              draggable
              onClick={() => onSelect(task.name)}
              onDragStart={(event) => {
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", task.name);
                setDraggingTaskId(task.name);
                setDropIndex(index);
              }}
              onDragEnd={() => {
                setDraggingTaskId(null);
                setDropIndex(null);
              }}
              className={cn(
                "group panel-surface-muted flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl px-3 py-2.5 transition-[background,border-color,box-shadow,transform] duration-150",
                selectedTaskId === task.name &&
                  "border-[color:var(--app-border-strong)] bg-[var(--app-surface-strong)] shadow-[var(--app-shadow-soft)]",
                draggingTaskId === task.name && "opacity-55",
                !task.enabled && "opacity-65"
              )}
            >
              <div className="flex items-center gap-2 text-muted-foreground">
                <button
                  type="button"
                  aria-label={`拖拽排序 ${task.name}`}
                  className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  onClick={(event) => event.stopPropagation()}
                >
                  <GripVertical className="h-4 w-4 cursor-grab" />
                </button>
                <span className="w-6 text-center font-mono text-[11px]">{index + 1}</span>
              </div>

              <Switch
                checked={task.enabled}
                onClick={(event) => event.stopPropagation()}
                onCheckedChange={() => onToggle(task.name)}
              />

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium text-foreground">{task.name}</span>
                  {task.enabled ? (
                    <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                  ) : (
                    <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                </div>
                <div className="mt-1 truncate text-xs text-muted-foreground">
                  搜索词: {task.searchText}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                  <TaskMetaChip>高度 {task.targetHeightPoints}pt</TaskMetaChip>
                  <TaskMetaChip>
                    偏移 {task.baseOffsetX}/{task.baseOffsetY}
                  </TaskMetaChip>
                  {(task.randomOffsetX > 0 || task.randomOffsetY > 0) && (
                    <TaskMetaChip>
                      随机 ±{task.randomOffsetX}/±{task.randomOffsetY}
                    </TaskMetaChip>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-xl"
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
                  onClick={(event) => {
                    event.stopPropagation();
                    onDelete(task.name);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        ))}

        {draggingTaskId && dropIndex === tasks.length ? <DropPlaceholder /> : null}
        <div
          className="h-4"
          onDragOver={(event) => {
            event.preventDefault();
            setDropIndex(tasks.length);
          }}
          onDrop={(event) => {
            event.preventDefault();
            const sourceTaskId = event.dataTransfer.getData("text/plain");
            handleDrop(sourceTaskId, tasks.length);
            setDraggingTaskId(null);
            setDropIndex(null);
          }}
        />
      </div>
    </div>
  );
}

function DropPlaceholder() {
  return (
    <div className="flex h-3 items-center px-2">
      <div className="flex w-full items-center gap-2">
        <span className="h-2 w-2 shrink-0 rounded-full bg-foreground/70" />
        <div className="h-[2px] flex-1 rounded-full bg-foreground/70" />
      </div>
    </div>
  );
}

function TaskMetaChip({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full border border-border bg-background/80 px-2 py-0.5">
      {children}
    </span>
  );
}

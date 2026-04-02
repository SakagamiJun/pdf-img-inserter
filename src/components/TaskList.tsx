import { useState } from "react";
import { Eye, EyeOff, GripVertical, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  onReorder: (sourceTaskId: string, targetTaskId: string) => void;
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

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-[22px] border border-dashed border-slate-300 bg-white/70 py-12 text-slate-500">
        <p className="text-sm font-medium">暂无任务</p>
        <p className="mt-1 text-xs">添加任务后即可批量处理与实时预览</p>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {tasks.map((task, index) => (
        <Card
          key={task.name}
          draggable
          className={cn(
            "cursor-pointer rounded-[22px] border-white/50 bg-white/88 shadow-sm backdrop-blur transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md",
            selectedTaskId === task.name &&
              "border-primary/60 bg-primary/[0.06] shadow-[0_10px_30px_rgba(15,23,42,0.08)]",
            draggingTaskId === task.name && "opacity-70",
            !task.enabled && "opacity-60"
          )}
          onClick={() => onSelect(task.name)}
          onDragStart={(event) => {
            event.dataTransfer.effectAllowed = "move";
            event.dataTransfer.setData("text/plain", task.name);
            setDraggingTaskId(task.name);
          }}
          onDragOver={(event) => {
            event.preventDefault();
            event.dataTransfer.dropEffect = "move";
          }}
          onDragEnd={() => setDraggingTaskId(null)}
          onDrop={(event) => {
            event.preventDefault();
            const sourceTaskId = event.dataTransfer.getData("text/plain");
            setDraggingTaskId(null);
            if (sourceTaskId) {
              onReorder(sourceTaskId, task.name);
            }
          }}
        >
          <CardContent className="flex items-center gap-3 p-3">
            <div className="flex items-center gap-2 text-slate-400">
              <GripVertical className="h-4 w-4 cursor-move" />
              <span className="w-5 text-center font-mono text-[11px]">{index + 1}</span>
            </div>

            <Switch
              checked={task.enabled}
              onCheckedChange={() => {
                onToggle(task.name);
              }}
            />

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-semibold text-slate-900">{task.name}</span>
                {task.enabled ? (
                  <Eye className="h-3 w-3 text-slate-400" />
                ) : (
                  <EyeOff className="h-3 w-3 text-slate-400" />
                )}
              </div>
              <div className="truncate text-xs text-slate-500">
                搜索: "{task.searchText}"
              </div>
              <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-400">
                <span className="rounded-full bg-slate-100 px-2 py-1">高 {task.targetHeightPoints}pt</span>
                <span className="rounded-full bg-slate-100 px-2 py-1">
                  偏移 {task.baseOffsetX}/{task.baseOffsetY}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(task);
                }}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(task.name);
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

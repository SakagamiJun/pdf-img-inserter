import { useEffect, useState, type ReactNode } from "react";
import { ImagePlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { TaskConfig } from "@/lib/types";
import { openFile } from "@/lib/tauri-commands";

interface TaskDialogProps {
  open: boolean;
  task?: TaskConfig;
  existingNames: string[];
  onSave: (task: TaskConfig) => void;
  onClose: () => void;
}

export function TaskDialog({
  open,
  task,
  existingNames,
  onSave,
  onClose,
}: TaskDialogProps) {
  const [formData, setFormData] = useState<Omit<TaskConfig, "id">>({
    name: "",
    searchText: "",
    imagePath: "",
    baseOffsetX: 0,
    baseOffsetY: 0,
    randomOffsetX: 0,
    randomOffsetY: 0,
    targetHeightPoints: 50,
    enabled: true,
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (task) {
      setFormData({
        name: task.name,
        searchText: task.searchText,
        imagePath: task.imagePath,
        baseOffsetX: task.baseOffsetX,
        baseOffsetY: task.baseOffsetY,
        randomOffsetX: task.randomOffsetX,
        randomOffsetY: task.randomOffsetY,
        targetHeightPoints: task.targetHeightPoints,
        enabled: task.enabled,
      });
    } else {
      setFormData({
        name: `任务 ${existingNames.length + 1}`,
        searchText: "",
        imagePath: "",
        baseOffsetX: 0,
        baseOffsetY: 0,
        randomOffsetX: 0,
        randomOffsetY: 0,
        targetHeightPoints: 50,
        enabled: true,
      });
    }

    setError(null);
  }, [existingNames.length, open, task]);

  const handleSelectImage = async () => {
    const path = await openFile("选择图片文件", [
      { name: "图片", extensions: ["png", "jpg", "jpeg", "bmp", "gif", "tiff"] },
    ]);

    if (path) {
      setFormData((prev) => ({ ...prev, imagePath: path }));
    }
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    if (!formData.name.trim()) {
      setError("任务名称不能为空");
      return;
    }

    if (!task && existingNames.includes(formData.name)) {
      setError("任务名称已存在");
      return;
    }

    if (!formData.searchText.trim()) {
      setError("搜索文本不能为空");
      return;
    }

    if (!formData.imagePath.trim()) {
      setError("图片路径不能为空");
      return;
    }

    onSave({ ...formData });
  };

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="关闭任务编辑器"
        className="absolute inset-0 bg-[var(--app-overlay)]"
        onClick={onClose}
      />

      <div className="panel-surface-strong relative z-10 flex h-full w-full max-w-[460px] flex-col border-l">
        <div className="flex items-start justify-between gap-3 border-b hairline px-6 py-5">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              {task ? "Edit Task" : "New Task"}
            </div>
            <h2 className="mt-2 text-lg font-semibold text-foreground">
              {task ? `编辑 ${task.name}` : "添加新任务"}
            </h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-xl">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-auto px-6 py-5">
            <div className="space-y-4">
              {error ? (
                <div className="rounded-2xl border border-destructive/25 bg-destructive/8 px-3 py-2 text-sm text-destructive">
                  {error}
                </div>
              ) : null}

              <Field label="任务名称">
                <Input
                  value={formData.name}
                  onChange={(event) =>
                    setFormData((prev) => ({ ...prev, name: event.target.value }))
                  }
                  className="h-10 rounded-xl"
                  disabled={!!task}
                />
              </Field>

              <Field label="搜索文本">
                <Input
                  value={formData.searchText}
                  onChange={(event) =>
                    setFormData((prev) => ({ ...prev, searchText: event.target.value }))
                  }
                  className="h-10 rounded-xl"
                  placeholder="在 PDF 中搜索此文本"
                />
              </Field>

              <Field label="图片路径">
                <div className="flex gap-2">
                  <Input
                    value={formData.imagePath}
                    onChange={(event) =>
                      setFormData((prev) => ({ ...prev, imagePath: event.target.value }))
                    }
                    className="h-10 flex-1 rounded-xl"
                    placeholder="选择或输入图片路径"
                    readOnly
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleSelectImage}
                    className="h-10 rounded-xl px-3"
                  >
                    <ImagePlus className="h-4 w-4" />
                    <span className="ml-1.5">选择</span>
                  </Button>
                </div>
              </Field>

              <div className="panel-surface-muted rounded-2xl p-4">
                <div className="text-sm font-medium text-foreground">位置控制</div>
                <div className="mt-1 text-sm text-muted-foreground">
                  基础偏移会稳定应用，随机偏移用于弱化机械感。
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <Field label="基础偏移 X">
                    <Input
                      type="number"
                      value={formData.baseOffsetX}
                      onChange={(event) =>
                        setFormData((prev) => ({
                          ...prev,
                          baseOffsetX: Number.parseInt(event.target.value, 10) || 0,
                        }))
                      }
                      className="h-10 rounded-xl"
                    />
                  </Field>
                  <Field label="基础偏移 Y">
                    <Input
                      type="number"
                      value={formData.baseOffsetY}
                      onChange={(event) =>
                        setFormData((prev) => ({
                          ...prev,
                          baseOffsetY: Number.parseInt(event.target.value, 10) || 0,
                        }))
                      }
                      className="h-10 rounded-xl"
                    />
                  </Field>
                  <Field label="随机偏移 X (±)">
                    <Input
                      type="number"
                      min="0"
                      value={formData.randomOffsetX}
                      onChange={(event) =>
                        setFormData((prev) => ({
                          ...prev,
                          randomOffsetX: Number.parseInt(event.target.value, 10) || 0,
                        }))
                      }
                      className="h-10 rounded-xl"
                    />
                  </Field>
                  <Field label="随机偏移 Y (±)">
                    <Input
                      type="number"
                      min="0"
                      value={formData.randomOffsetY}
                      onChange={(event) =>
                        setFormData((prev) => ({
                          ...prev,
                          randomOffsetY: Number.parseInt(event.target.value, 10) || 0,
                        }))
                      }
                      className="h-10 rounded-xl"
                    />
                  </Field>
                </div>
              </div>

              <div className="panel-surface-muted rounded-2xl p-4">
                <Field label="目标高度 (points)">
                  <Input
                    type="number"
                    min="0"
                    step="0.1"
                    value={formData.targetHeightPoints}
                    onChange={(event) => {
                      const nextValue =
                        event.target.value === "" ? 0 : Number.parseFloat(event.target.value);
                      setFormData((prev) => ({
                        ...prev,
                        targetHeightPoints: Number.isNaN(nextValue) ? 0 : nextValue,
                      }));
                    }}
                    className="h-10 rounded-xl"
                  />
                </Field>
                <p className="mt-2 text-sm text-muted-foreground">
                  设为 0 时，沿用图片原始高度。
                </p>
              </div>

              <div className="panel-surface-muted flex items-center justify-between rounded-2xl p-4">
                <div>
                  <div className="text-sm font-medium text-foreground">启用任务</div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    关闭后会保留配置，但不会参与预览和批处理。
                  </div>
                </div>
                <Switch
                  checked={formData.enabled}
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({ ...prev, enabled: checked }))
                  }
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 border-t hairline px-6 py-4">
            <Button type="button" variant="outline" onClick={onClose} className="rounded-xl">
              取消
            </Button>
            <Button type="submit" className="rounded-xl px-4">
              {task ? "保存更改" : "添加任务"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

import { useState, useEffect } from "react";
import { X } from "lucide-react";
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
  }, [task, existingNames.length, open]);

  const handleSelectImage = async () => {
    const path = await openFile("选择图片文件", [
      { name: "图片", extensions: ["png", "jpg", "jpeg", "bmp", "gif", "tiff"] },
    ]);
    if (path) {
      setFormData((prev) => ({ ...prev, imagePath: path }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
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

    onSave({
      ...formData,
    });
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="fixed inset-0 bg-black/50"
        onClick={onClose}
      />
      <div className="relative bg-background rounded-lg shadow-lg w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">
            {task ? "编辑任务" : "添加任务"}
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="text-sm text-destructive bg-destructive/10 p-2 rounded">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-xs">任务名称</Label>
            <Input
              value={formData.name}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, name: e.target.value }))
              }
              className="h-8"
              disabled={!!task}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs">搜索文本</Label>
            <Input
              value={formData.searchText}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, searchText: e.target.value }))
              }
              className="h-8"
              placeholder="在 PDF 中搜索此文本"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs">图片路径</Label>
            <div className="flex gap-2">
              <Input
                value={formData.imagePath}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, imagePath: e.target.value }))
                }
                className="flex-1 h-8"
                placeholder="选择或输入图片路径"
                readOnly
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSelectImage}
              >
                选择
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs">基础偏移 X</Label>
              <Input
                type="number"
                value={formData.baseOffsetX}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    baseOffsetX: parseInt(e.target.value) || 0,
                  }))
                }
                className="h-8"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">基础偏移 Y</Label>
              <Input
                type="number"
                value={formData.baseOffsetY}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    baseOffsetY: parseInt(e.target.value) || 0,
                  }))
                }
                className="h-8"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs">随机偏移 X (±)</Label>
              <Input
                type="number"
                min="0"
                value={formData.randomOffsetX}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    randomOffsetX: parseInt(e.target.value) || 0,
                  }))
                }
                className="h-8"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">随机偏移 Y (±)</Label>
              <Input
                type="number"
                min="0"
                value={formData.randomOffsetY}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    randomOffsetY: parseInt(e.target.value) || 0,
                  }))
                }
                className="h-8"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">目标高度 (points)</Label>
            <Input
              type="number"
              min="0"
              step="0.1"
              value={formData.targetHeightPoints}
              onChange={(e) => {
                const nextValue =
                  e.target.value === "" ? 0 : Number.parseFloat(e.target.value);
                setFormData((prev) => ({
                  ...prev,
                  targetHeightPoints: Number.isNaN(nextValue) ? 0 : nextValue,
                }));
              }}
              className="h-8"
            />
            <p className="text-xs text-muted-foreground">
              设为 0 使用图片原始高度
            </p>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border/70 bg-muted/40 px-3 py-2">
            <div>
              <div className="text-sm font-medium">启用任务</div>
              <div className="text-xs text-muted-foreground">
                关闭后会保留配置，但不会参与预览和批处理
              </div>
            </div>
            <Switch
              checked={formData.enabled}
              onCheckedChange={(checked) =>
                setFormData((prev) => ({ ...prev, enabled: checked }))
              }
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              取消
            </Button>
            <Button type="submit">{task ? "保存" : "添加"}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

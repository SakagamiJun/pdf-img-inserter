import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
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
  const { t, i18n } = useTranslation();
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
        name: i18n.t("tasks.dialog.defaultName", { index: existingNames.length + 1 }),
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
  }, [existingNames.length, i18n, open, task]);

  const handleSelectImage = async () => {
    const path = await openFile(t("tasks.dialog.filePicker.selectImage"), [
      {
        name: t("common.files.image"),
        extensions: ["png", "jpg", "jpeg", "bmp", "gif", "tiff"],
      },
    ]);

    if (path) {
      setFormData((prev) => ({ ...prev, imagePath: path }));
    }
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    if (!formData.name.trim()) {
      setError(t("tasks.dialog.validation.nameRequired"));
      return;
    }

    if (!task && existingNames.includes(formData.name)) {
      setError(t("tasks.dialog.validation.nameDuplicate"));
      return;
    }

    if (!formData.searchText.trim()) {
      setError(t("tasks.dialog.validation.searchTextRequired"));
      return;
    }

    if (!formData.imagePath.trim()) {
      setError(t("tasks.dialog.validation.imagePathRequired"));
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
        aria-label={t("tasks.dialog.ariaClose")}
        className="absolute inset-0 bg-[var(--app-overlay)]"
        onClick={onClose}
      />

      <div className="panel-surface-strong relative z-10 flex h-full w-full max-w-[460px] flex-col border-l">
        <div className="flex items-start justify-between gap-3 border-b hairline px-6 py-5">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              {task ? t("tasks.dialog.panelLabel.edit") : t("tasks.dialog.panelLabel.new")}
            </div>
            <h2 className="mt-2 text-lg font-semibold text-foreground">
              {task
                ? t("tasks.dialog.title.edit", { taskName: task.name })
                : t("tasks.dialog.title.new")}
            </h2>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="rounded-xl"
            title={t("common.actions.close")}
          >
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

              <Field label={t("tasks.dialog.fields.name")}>
                <Input
                  value={formData.name}
                  onChange={(event) =>
                    setFormData((prev) => ({ ...prev, name: event.target.value }))
                  }
                  className="h-10 rounded-xl"
                  disabled={!!task}
                />
              </Field>

              <Field label={t("tasks.dialog.fields.searchText")}>
                <Input
                  value={formData.searchText}
                  onChange={(event) =>
                    setFormData((prev) => ({ ...prev, searchText: event.target.value }))
                  }
                  className="h-10 rounded-xl"
                  placeholder={t("tasks.dialog.placeholders.searchText")}
                />
              </Field>

              <Field label={t("tasks.dialog.fields.imagePath")}>
                <div className="flex gap-2">
                  <Input
                    value={formData.imagePath}
                    onChange={(event) =>
                      setFormData((prev) => ({ ...prev, imagePath: event.target.value }))
                    }
                    className="h-10 flex-1 rounded-xl"
                    placeholder={t("tasks.dialog.placeholders.imagePath")}
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
                    <span className="ml-1.5">{t("common.actions.select")}</span>
                  </Button>
                </div>
              </Field>

              <div className="panel-surface-muted rounded-2xl p-4">
                <div className="text-sm font-medium text-foreground">
                  {t("tasks.dialog.sections.position.title")}
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {t("tasks.dialog.sections.position.description")}
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <Field label={t("tasks.dialog.fields.baseOffsetX")}>
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
                  <Field label={t("tasks.dialog.fields.baseOffsetY")}>
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
                  <Field label={t("tasks.dialog.fields.randomOffsetX")}>
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
                  <Field label={t("tasks.dialog.fields.randomOffsetY")}>
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
                <Field label={t("tasks.dialog.fields.targetHeight")}>
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
                  {t("tasks.dialog.sections.targetHeight.description")}
                </p>
              </div>

              <div className="panel-surface-muted flex items-center justify-between rounded-2xl p-4">
                <div>
                  <div className="text-sm font-medium text-foreground">
                    {t("tasks.dialog.sections.enabled.title")}
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {t("tasks.dialog.sections.enabled.description")}
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
              {t("common.actions.cancel")}
            </Button>
            <Button type="submit" className="rounded-xl px-4">
              {task ? t("common.actions.saveChanges") : t("common.actions.addTask")}
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

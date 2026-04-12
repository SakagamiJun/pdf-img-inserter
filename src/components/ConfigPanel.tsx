import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { FileText, FolderOpen, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { openFile, openFolder } from "@/lib/tauri-commands";

interface ConfigPanelProps {
  configPath: string;
  inputFolder: string;
  outputFolder: string;
  dirty?: boolean;
  onConfigPathChange: (path: string) => void;
  onInputFolderChange: (path: string) => void;
  onOutputFolderChange: (path: string) => void;
  onSave: () => void;
}

export function ConfigPanel({
  configPath,
  inputFolder,
  outputFolder,
  dirty = false,
  onConfigPathChange,
  onInputFolderChange,
  onOutputFolderChange,
  onSave,
}: ConfigPanelProps) {
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleSelectConfig = async () => {
    const path = await openFile(t("config.filePicker.selectConfig"), [
      { name: t("common.files.toml"), extensions: ["toml"] },
      { name: t("common.files.allFiles"), extensions: ["*"] },
    ]);

    if (path) {
      onConfigPathChange(path);
    }
  };

  const handleSelectInputFolder = async () => {
    const path = await openFolder(t("config.filePicker.selectInputFolder"));
    if (path) {
      onInputFolderChange(path);
    }
  };

  const handleSelectOutputFolder = async () => {
    const path = await openFolder(t("config.filePicker.selectOutputFolder"));
    if (path) {
      onOutputFolderChange(path);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      await onSave();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-3 border-b hairline pb-4">
        <div className="min-w-0">
          <div className="text-xs font-medium text-foreground">{t("config.title")}</div>
        </div>
        <div className="inline-flex h-9 min-w-[112px] shrink-0 items-center justify-center whitespace-nowrap rounded-xl border border-transparent bg-primary px-3 text-xs font-medium text-primary-foreground shadow-[var(--app-shadow-soft)]">
          {dirty ? t("config.status.dirty") : t("config.status.synced")}
        </div>
      </div>

      <div className="mt-4 flex min-h-0 flex-1 flex-col gap-3">
        <Field
          label={t("config.fields.configFile.label")}
          value={configPath}
          placeholder={t("config.fields.configFile.placeholder")}
          description={t("config.fields.configFile.description")}
          actionLabel={t("common.actions.select")}
          icon={<FileText className="h-4 w-4" />}
          onPick={handleSelectConfig}
        />

        <Field
          label={t("config.fields.inputFolder.label")}
          value={inputFolder}
          placeholder={t("config.fields.inputFolder.placeholder")}
          description={t("config.fields.inputFolder.description")}
          actionLabel={t("common.actions.browse")}
          icon={<FolderOpen className="h-4 w-4" />}
          onPick={handleSelectInputFolder}
        />

        <Field
          label={t("config.fields.outputFolder.label")}
          value={outputFolder}
          placeholder={t("config.fields.outputFolder.placeholder")}
          description={t("config.fields.outputFolder.description")}
          actionLabel={t("common.actions.browse")}
          icon={<FolderOpen className="h-4 w-4" />}
          onPick={handleSelectOutputFolder}
        />

        {saveError ? (
          <div className="rounded-2xl border border-destructive/25 bg-destructive/8 px-3 py-2 text-sm text-destructive">
            {saveError}
          </div>
        ) : null}

        <div className="mt-auto flex items-center justify-between gap-3 border-t hairline pt-4">
          <div className="text-xs text-muted-foreground">{t("config.note")}</div>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving}
            className="h-9 rounded-xl px-4"
          >
            <Save className="mr-1.5 h-3.5 w-3.5" />
            {saving ? t("common.actions.saving") : t("common.actions.saveConfig")}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  placeholder,
  description,
  actionLabel,
  icon,
  onPick,
}: {
  label: string;
  value: string;
  placeholder: string;
  description: string;
  actionLabel: string;
  icon: ReactNode;
  onPick: () => void;
}) {
  return (
    <div className="panel-surface-muted rounded-2xl p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Label className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            {label}
          </Label>
          <div className="mt-1 text-sm text-muted-foreground">{description}</div>
        </div>
        <Button variant="outline" size="sm" onClick={onPick} className="h-9 rounded-xl px-3">
          {icon}
          <span className="ml-1.5">{actionLabel}</span>
        </Button>
      </div>
      <Input
        value={value}
        placeholder={placeholder}
        className="mt-3 h-10 rounded-xl text-sm"
        readOnly
      />
    </div>
  );
}

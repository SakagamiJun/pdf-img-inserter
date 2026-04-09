import { useState, type ReactNode } from "react";
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
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleSelectConfig = async () => {
    const path = await openFile("选择配置文件", [
      { name: "TOML", extensions: ["toml"] },
      { name: "所有文件", extensions: ["*"] },
    ]);

    if (path) {
      onConfigPathChange(path);
    }
  };

  const handleSelectInputFolder = async () => {
    const path = await openFolder("选择输入文件夹");
    if (path) {
      onInputFolderChange(path);
    }
  };

  const handleSelectOutputFolder = async () => {
    const path = await openFolder("选择输出文件夹");
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
      <div className="flex items-start justify-between gap-3 border-b hairline pb-4">
        <div>
          <div className="text-xs font-medium text-foreground">路径与配置</div>
          <p className="mt-1 text-sm text-muted-foreground">
            这里保持极简，只放当前工作配置和输入输出路径。
          </p>
        </div>
        <div className="rounded-full border border-border bg-background/80 px-2.5 py-1 text-[11px] text-muted-foreground">
          {dirty ? "未保存更改" : "已同步"}
        </div>
      </div>

      <div className="mt-4 flex min-h-0 flex-1 flex-col gap-3">
        <Field
          label="配置文件"
          value={configPath}
          placeholder="config.toml"
          description="切换当前工作配置。新路径会立即加载。"
          actionLabel="选择"
          icon={<FileText className="h-4 w-4" />}
          onPick={handleSelectConfig}
        />

        <Field
          label="输入目录"
          value={inputFolder}
          placeholder="./input_pdfs"
          description="批处理时默认读取的 PDF 来源目录。"
          actionLabel="浏览"
          icon={<FolderOpen className="h-4 w-4" />}
          onPick={handleSelectInputFolder}
        />

        <Field
          label="输出目录"
          value={outputFolder}
          placeholder="./output_pdfs"
          description="处理完成后的 PDF 导出目录。"
          actionLabel="浏览"
          icon={<FolderOpen className="h-4 w-4" />}
          onPick={handleSelectOutputFolder}
        />

        {saveError ? (
          <div className="rounded-2xl border border-destructive/25 bg-destructive/8 px-3 py-2 text-sm text-destructive">
            {saveError}
          </div>
        ) : null}

        <div className="mt-auto flex items-center justify-between gap-3 border-t hairline pt-4">
          <div className="text-xs text-muted-foreground">
            更改路径后不会自动写盘，保存后才会更新配置文件。
          </div>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving}
            className="h-9 rounded-xl px-4"
          >
            <Save className="mr-1.5 h-3.5 w-3.5" />
            {saving ? "保存中..." : "保存配置"}
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

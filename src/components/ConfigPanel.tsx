import { useState, type ReactNode } from "react";
import { FolderOpen, FileText, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { openFile, openFolder } from "@/lib/tauri-commands";

interface ConfigPanelProps {
  configPath: string;
  inputFolder: string;
  outputFolder: string;
  onConfigPathChange: (path: string) => void;
  onInputFolderChange: (path: string) => void;
  onOutputFolderChange: (path: string) => void;
  onSave: () => void;
}

export function ConfigPanel({
  configPath,
  inputFolder,
  outputFolder,
  onConfigPathChange,
  onInputFolderChange,
  onOutputFolderChange,
  onSave,
}: ConfigPanelProps) {
  const [loading, setLoading] = useState(false);
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
    setLoading(true);
    setSaveError(null);
    try {
      await onSave();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="text-sm font-semibold text-slate-900">配置面板</div>

      <div className="space-y-4 rounded-[24px] border border-slate-200 bg-white/90 p-4 shadow-sm">
        <Field
          label="配置文件"
          value={configPath}
          placeholder="config.toml"
          icon={<FileText className="h-3 w-3" />}
          onPick={handleSelectConfig}
        />

        <Field
          label="输入文件夹"
          value={inputFolder}
          placeholder="./input_pdfs"
          icon={<FolderOpen className="h-3 w-3" />}
          onPick={handleSelectInputFolder}
        />

        <Field
          label="输出文件夹"
          value={outputFolder}
          placeholder="./output_pdfs"
          icon={<FolderOpen className="h-3 w-3" />}
          onPick={handleSelectOutputFolder}
        />

        {saveError ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {saveError}
          </div>
        ) : null}

        <Button
          size="sm"
          className="h-9 w-full rounded-2xl bg-slate-900 text-white hover:bg-slate-800"
          onClick={handleSave}
          disabled={loading}
        >
          <Save className="mr-1.5 h-3 w-3" />
          保存配置
        </Button>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  placeholder,
  icon,
  onPick,
}: {
  label: string;
  value: string;
  placeholder: string;
  icon: ReactNode;
  onPick: () => void;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{label}</Label>
      <div className="flex gap-2">
        <Input value={value} placeholder={placeholder} className="h-9 flex-1 text-xs" readOnly />
        <Button variant="outline" size="sm" onClick={onPick} className="h-9 rounded-xl">
          {icon}
        </Button>
      </div>
    </div>
  );
}

import { invoke } from "@tauri-apps/api/core";
import type {
  AppConfig,
  PreviewResponse,
  TaskConfig,
  TextPosition,
} from "./types";

type DialogFilter = { name: string; extensions: string[] };

// Load configuration from file
export async function loadConfig(path: string): Promise<AppConfig> {
  return invoke("load_config", { path });
}

// Save configuration to file
export async function saveConfig(path: string, config: AppConfig): Promise<void> {
  return invoke("save_config", { path, config });
}

export async function getDefaultConfigPath(): Promise<string> {
  return invoke("get_default_config_path");
}

export async function createDefaultConfig(path: string): Promise<void> {
  return invoke("create_default_config", { path });
}

export async function processFiles(
  inputFolder: string,
  outputFolder: string,
  tasks: TaskConfig[],
  previewFile?: string | null
): Promise<void> {
  return invoke("process_files", { inputFolder, outputFolder, tasks, previewFile });
}

export async function renderPreview(
  pdfPath: string,
  page: number,
  tasks: TaskConfig[],
  selectedTaskName?: string | null
): Promise<PreviewResponse> {
  return invoke("render_preview", { path: pdfPath, page, tasks, selectedTaskName });
}

export async function searchText(
  pdfPath: string,
  page: number,
  text: string
): Promise<TextPosition[]> {
  return invoke("search_text_in_pdf", { path: pdfPath, page, text });
}

export async function getPageCount(pdfPath: string): Promise<number> {
  return invoke("get_page_count_cmd", { path: pdfPath });
}

export async function openFile(
  title: string,
  filters?: DialogFilter[]
): Promise<string | null> {
  return invoke("pick_file_path", { title, filters });
}

export async function openFolder(title: string): Promise<string | null> {
  return invoke("pick_folder_path", { title });
}

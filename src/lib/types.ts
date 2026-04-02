export interface TaskConfig {
  id?: string;
  name: string;
  searchText: string;
  imagePath: string;
  baseOffsetX: number;
  baseOffsetY: number;
  randomOffsetX: number;
  randomOffsetY: number;
  targetHeightPoints: number;
  enabled: boolean;
}

export interface GlobalConfig {
  inputFolder: string;
  outputFolder: string;
}

export interface AppConfig {
  global: GlobalConfig;
  tasks: TaskConfig[];
}

export interface TextPosition {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
  page: number;
}

export interface ProcessResult {
  success: boolean;
  insertions: number;
  message: string;
  error?: string;
}

export type ProgressEvent =
  | { type: "BatchStarted"; total: number }
  | { type: "FileStarted"; filename: string; index: number; total: number }
  | {
      type: "FileCompleted";
      filename: string;
      insertions: number;
      completed: number;
      total: number;
    }
  | {
      type: "FileError";
      filename: string;
      error: string;
      completed: number;
      total: number;
    }
  | { type: "AllCompleted"; success: number; failed: number };

export interface PreviewOverlay {
  taskName: string;
  matchRect: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  imageRect: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  imageUrl: string;
  selected: boolean;
  randomized: boolean;
}

export interface PreviewResponse {
  imageUrl: string;
  pixelWidth: number;
  pixelHeight: number;
  pageWidthPoints: number;
  pageHeightPoints: number;
  overlays: PreviewOverlay[];
}

export interface LogEventPayload {
  timestampMs: number;
  level: string;
  target: string;
  message: string;
  fields: Record<string, string>;
}

export interface LogEntry {
  id: string;
  timestamp: Date;
  level: "trace" | "debug" | "info" | "warn" | "error";
  message: string;
  target?: string;
  fields?: Record<string, string>;
}

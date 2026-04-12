import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useProgressEvent, useLogEvent } from "@/hooks/useTauriEvent";
import type { LogEntry, LogEventPayload, ProgressEvent } from "@/lib/types";

interface UseAppStateReturn {
  onProgress: (event: ProgressEvent) => void;
  onLog: (payload: LogEventPayload) => void;
}

export function useAppState(
  setLogs: React.Dispatch<React.SetStateAction<LogEntry[]>>,
  setProcessing: React.Dispatch<React.SetStateAction<boolean>>,
  setProgress: React.Dispatch<React.SetStateAction<{ current: number; total: number }>>,
  setConsoleCollapsed?: React.Dispatch<React.SetStateAction<boolean>>
): UseAppStateReturn {
  const { t } = useTranslation();

  const onProgress = useCallback(
    (event: ProgressEvent) => {
      switch (event.type) {
        case "BatchStarted":
          setProgress({ current: 0, total: event.total });
          setProcessing(event.total > 0);
          break;
        case "FileStarted":
          setLogs((prev) => [
            ...prev,
            {
              id: crypto.randomUUID(),
              timestamp: new Date(),
              level: "info",
              message: t("progress.fileStarted", { filename: event.filename }),
              target: "batch",
            },
          ]);
          break;
        case "FileCompleted":
          setProgress({ current: event.completed, total: event.total });
          setLogs((prev) => [
            ...prev,
            {
              id: crypto.randomUUID(),
              timestamp: new Date(),
              level: "info",
              message: t("progress.fileCompleted", {
                filename: event.filename,
                insertionCount: event.insertions,
              }),
              target: "batch",
            },
          ]);
          break;
        case "FileError":
          setProgress({ current: event.completed, total: event.total });
          setConsoleCollapsed?.(false);
          setLogs((prev) => [
            ...prev,
            {
              id: crypto.randomUUID(),
              timestamp: new Date(),
              level: "error",
              message: t("progress.fileError", {
                error: event.error,
                filename: event.filename,
              }),
              target: "batch",
            },
          ]);
          break;
        case "AllCompleted":
          setProcessing(false);
          setLogs((prev) => [
            ...prev,
            {
              id: crypto.randomUUID(),
              timestamp: new Date(),
              level: "info",
              message: t("progress.allCompleted", {
                failedCount: event.failed,
                successCount: event.success,
              }),
              target: "batch",
            },
          ]);
          break;
      }
    },
    [setConsoleCollapsed, setLogs, setProcessing, setProgress, t]
  );

  const onLog = useCallback(
    (payload: LogEventPayload) => {
      const normalizedLevel = payload.level.toLowerCase() as LogEntry["level"];
      if (normalizedLevel === "error") {
        setConsoleCollapsed?.(false);
      }
      setLogs((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          timestamp: new Date(payload.timestampMs),
          level: normalizedLevel,
          message: payload.message,
          target: payload.target,
          fields: payload.fields,
        },
      ]);
    },
    [setConsoleCollapsed, setLogs]
  );

  useProgressEvent(onProgress);
  useLogEvent(onLog);

  return { onProgress, onLog };
}

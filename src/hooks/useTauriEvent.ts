import { useEffect } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { LogEventPayload, ProgressEvent } from "@/lib/types";

export function useProgressEvent(
  onProgress: (event: ProgressEvent) => void
): void {
  useEffect(() => {
    let unlisten: UnlistenFn | undefined;

    const setup = async () => {
      unlisten = await listen<ProgressEvent>("progress", (event) => {
        onProgress(event.payload);
      });
    };

    setup();

    return () => {
      unlisten?.();
    };
  }, [onProgress]);
}

export function useLogEvent(
  onLog: (payload: LogEventPayload) => void
): void {
  useEffect(() => {
    let unlisten: UnlistenFn | undefined;

    const setup = async () => {
      unlisten = await listen<LogEventPayload>("log", (event) => {
        onLog(event.payload);
      });
    };

    setup();

    return () => {
      unlisten?.();
    };
  }, [onLog]);
}

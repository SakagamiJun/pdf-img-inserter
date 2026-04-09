import { useState, useCallback } from "react";
import type { AppConfig, TaskConfig } from "@/lib/types";
import {
  createDefaultConfig,
  getDefaultConfigPath,
  loadConfig as loadConfigCmd,
  saveConfig as saveConfigCmd,
} from "@/lib/tauri-commands";

export function useConfig() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [configPath, setConfigPath] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mutationVersion, setMutationVersion] = useState(0);

  const loadConfigFromFile = useCallback(async (path: string) => {
    setLoading(true);
    setError(null);
    try {
      const cfg = await loadConfigCmd(path);
      setConfig(cfg);
      setConfigPath(path);
      setMutationVersion(0);
      return cfg;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const saveConfigToFile = useCallback(async (
    path: string,
    cfg: AppConfig,
    options?: { mutationVersion?: number }
  ) => {
    setLoading(true);
    setError(null);
    try {
      await saveConfigCmd(path, cfg);
      setMutationVersion((current) => {
        const snapshotVersion = options?.mutationVersion;
        if (snapshotVersion === undefined) {
          return 0;
        }

        return current === snapshotVersion ? 0 : current;
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const initDefaultConfig = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const defaultPath = await getDefaultConfigPath();
      setConfigPath(defaultPath);

      try {
        const cfg = await loadConfigCmd(defaultPath);
        setConfig(cfg);
        setMutationVersion(0);
        return cfg;
      } catch {
        await createDefaultConfig(defaultPath);
        const cfg = await loadConfigCmd(defaultPath);
        setConfig(cfg);
        setMutationVersion(0);
        return cfg;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateTask = useCallback((taskId: string, updates: Partial<TaskConfig>) => {
    setConfig((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        tasks: prev.tasks.map((t) =>
          t.name === taskId ? { ...t, ...updates } : t
        ),
      };
    });
    setMutationVersion((prev) => prev + 1);
  }, []);

  const addTask = useCallback((task: TaskConfig) => {
    setConfig((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        tasks: [...prev.tasks, task],
      };
    });
    setMutationVersion((prev) => prev + 1);
  }, []);

  const removeTask = useCallback((taskId: string) => {
    setConfig((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        tasks: prev.tasks.filter((t) => t.name !== taskId),
      };
    });
    setMutationVersion((prev) => prev + 1);
  }, []);

  const toggleTask = useCallback((taskId: string) => {
    setConfig((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        tasks: prev.tasks.map((t) =>
          t.name === taskId ? { ...t, enabled: !t.enabled } : t
        ),
      };
    });
    setMutationVersion((prev) => prev + 1);
  }, []);

  const reorderTasks = useCallback((sourceTaskId: string, targetIndex: number) => {
    setConfig((prev) => {
      if (!prev) return prev;

      const sourceIndex = prev.tasks.findIndex((task) => task.name === sourceTaskId);

      if (sourceIndex === -1) {
        return prev;
      }

      const nextTasks = [...prev.tasks];
      const [moved] = nextTasks.splice(sourceIndex, 1);
      const clampedIndex = Math.max(0, Math.min(targetIndex, nextTasks.length));
      const insertionIndex = sourceIndex < clampedIndex ? clampedIndex - 1 : clampedIndex;

      if (insertionIndex === sourceIndex) {
        return prev;
      }

      nextTasks.splice(insertionIndex, 0, moved);

      return {
        ...prev,
        tasks: nextTasks,
      };
    });
    setMutationVersion((prev) => prev + 1);
  }, []);

  const setAllTasksEnabled = useCallback((enabled: boolean) => {
    setConfig((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        tasks: prev.tasks.map((task) => ({ ...task, enabled })),
      };
    });
    setMutationVersion((prev) => prev + 1);
  }, []);

  const updateGlobalConfig = useCallback((updates: Partial<AppConfig["global"]>) => {
    setConfig((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        global: { ...prev.global, ...updates },
      };
    });
    setMutationVersion((prev) => prev + 1);
  }, []);

  return {
    config,
    configPath,
    loading,
    error,
    mutationVersion,
    loadConfig: loadConfigFromFile,
    saveConfig: saveConfigToFile,
    initDefaultConfig,
    updateTask,
    addTask,
    removeTask,
    toggleTask,
    reorderTasks,
    setAllTasksEnabled,
    updateGlobalConfig,
  };
}

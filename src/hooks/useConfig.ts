import { useState, useCallback } from "react";
import type { AppConfig, TaskConfig } from "@/lib/types";
import {
  createDefaultConfig,
  getDefaultConfigPath,
  loadConfig as loadConfigCmd,
  saveConfig as saveConfigCmd,
} from "@/lib/tauri-commands";

interface MutationOptions {
  markDirty?: boolean;
}

export function useConfig() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [configPath, setConfigPath] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mutationVersion, setMutationVersion] = useState(0);

  const markConfigDirty = useCallback((options?: MutationOptions) => {
    if (options?.markDirty === false) {
      return;
    }

    setMutationVersion((prev) => prev + 1);
  }, []);

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

  const replaceConfig = useCallback(
    (nextConfig: AppConfig, options?: MutationOptions) => {
      setConfig(nextConfig);
      markConfigDirty(options);
    },
    [markConfigDirty]
  );

  const updateTask = useCallback(
    (taskId: string, updates: Partial<TaskConfig>, options?: MutationOptions) => {
      setConfig((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          tasks: prev.tasks.map((t) => (t.name === taskId ? { ...t, ...updates } : t)),
        };
      });
      markConfigDirty(options);
    },
    [markConfigDirty]
  );

  const addTask = useCallback(
    (task: TaskConfig, options?: MutationOptions) => {
      setConfig((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          tasks: [...prev.tasks, task],
        };
      });
      markConfigDirty(options);
    },
    [markConfigDirty]
  );

  const removeTask = useCallback(
    (taskId: string, options?: MutationOptions) => {
      setConfig((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          tasks: prev.tasks.filter((t) => t.name !== taskId),
        };
      });
      markConfigDirty(options);
    },
    [markConfigDirty]
  );

  const toggleTask = useCallback(
    (taskId: string, options?: MutationOptions) => {
      setConfig((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          tasks: prev.tasks.map((t) => (t.name === taskId ? { ...t, enabled: !t.enabled } : t)),
        };
      });
      markConfigDirty(options);
    },
    [markConfigDirty]
  );

  const reorderTasks = useCallback(
    (sourceTaskId: string, targetIndex: number, options?: MutationOptions) => {
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
      markConfigDirty(options);
    },
    [markConfigDirty]
  );

  const setAllTasksEnabled = useCallback(
    (enabled: boolean, options?: MutationOptions) => {
      setConfig((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          tasks: prev.tasks.map((task) => ({ ...task, enabled })),
        };
      });
      markConfigDirty(options);
    },
    [markConfigDirty]
  );

  const updateGlobalConfig = useCallback(
    (updates: Partial<AppConfig["global"]>, options?: MutationOptions) => {
      setConfig((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          global: { ...prev.global, ...updates },
        };
      });
      markConfigDirty(options);
    },
    [markConfigDirty]
  );

  return {
    config,
    configPath,
    loading,
    error,
    mutationVersion,
    loadConfig: loadConfigFromFile,
    saveConfig: saveConfigToFile,
    initDefaultConfig,
    replaceConfig,
    updateTask,
    addTask,
    removeTask,
    toggleTask,
    reorderTasks,
    setAllTasksEnabled,
    updateGlobalConfig,
  };
}

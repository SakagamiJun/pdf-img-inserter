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

  const loadConfigFromFile = useCallback(async (path: string) => {
    setLoading(true);
    setError(null);
    try {
      const cfg = await loadConfigCmd(path);
      setConfig(cfg);
      setConfigPath(path);
      return cfg;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const saveConfigToFile = useCallback(async (path: string, cfg: AppConfig) => {
    setLoading(true);
    setError(null);
    try {
      await saveConfigCmd(path, cfg);
      setConfig(cfg);
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
        return cfg;
      } catch {
        await createDefaultConfig(defaultPath);
        const cfg = await loadConfigCmd(defaultPath);
        setConfig(cfg);
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
  }, []);

  const addTask = useCallback((task: TaskConfig) => {
    setConfig((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        tasks: [...prev.tasks, task],
      };
    });
  }, []);

  const removeTask = useCallback((taskId: string) => {
    setConfig((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        tasks: prev.tasks.filter((t) => t.name !== taskId),
      };
    });
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
  }, []);

  const reorderTasks = useCallback((sourceTaskId: string, targetTaskId: string) => {
    setConfig((prev) => {
      if (!prev || sourceTaskId === targetTaskId) return prev;

      const sourceIndex = prev.tasks.findIndex((task) => task.name === sourceTaskId);
      const targetIndex = prev.tasks.findIndex((task) => task.name === targetTaskId);

      if (sourceIndex === -1 || targetIndex === -1) {
        return prev;
      }

      const nextTasks = [...prev.tasks];
      const [moved] = nextTasks.splice(sourceIndex, 1);
      nextTasks.splice(targetIndex, 0, moved);

      return {
        ...prev,
        tasks: nextTasks,
      };
    });
  }, []);

  const setAllTasksEnabled = useCallback((enabled: boolean) => {
    setConfig((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        tasks: prev.tasks.map((task) => ({ ...task, enabled })),
      };
    });
  }, []);

  const updateGlobalConfig = useCallback((updates: Partial<AppConfig["global"]>) => {
    setConfig((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        global: { ...prev.global, ...updates },
      };
    });
  }, []);

  return {
    config,
    configPath,
    loading,
    error,
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

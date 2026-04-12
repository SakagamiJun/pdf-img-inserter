type DeepStringShape<T> = {
  [K in keyof T]: T[K] extends string ? string : DeepStringShape<T[K]>;
};

const zhCN = {
  common: {
    actions: {
      addTask: "添加任务",
      browse: "浏览",
      cancel: "取消",
      changePreview: "更换预览",
      clear: "清空",
      close: "关闭",
      copy: "复制",
      copied: "已复制",
      disableAll: "全部停用",
      enableAll: "全部启用",
      new: "新建",
      saveChanges: "保存更改",
      saveConfig: "保存配置",
      saving: "保存中...",
      select: "选择",
      selectPreview: "选择预览",
      startBatch: "开始批处理",
    },
    files: {
      allFiles: "所有文件",
      image: "图片",
      pdf: "PDF",
      toml: "TOML",
    },
    locale: {
      names: {
        enUs: "English",
        zhCn: "中文",
      },
      short: {
        enUs: "EN",
        zhCn: "中",
      },
    },
    theme: {
      dark: "深色",
      light: "浅色",
      resolved: {
        dark: "深色",
        light: "浅色",
      },
      system: "跟随系统",
    },
  },
  app: {
    dialogs: {
      confirmDeleteTask: '确定要删除任务 "{{taskId}}" 吗？',
    },
    filePicker: {
      selectPreviewPdf: "选择 PDF 文件",
    },
    logs: {
      configLoaded: "已加载配置文件: {{path}}",
      configSaveFailed: "保存配置失败: {{message}}",
      configSaved: "已保存配置文件: {{path}}",
      noEnabledTasks: "没有启用的任务，已取消处理。",
      previewLoaded: "已载入预览文件: {{fileName}} ({{pageCount}} 页)",
      previewPageCountFailed:
        "已选择预览文件 {{fileName}}，但读取页数失败: {{message}}",
      processFailed: "处理失败: {{message}}",
      processStarted: "开始处理，共 {{taskCount}} 个任务。",
      taskAdded: "已添加任务: {{taskName}}",
      taskDeleted: "已删除任务: {{taskId}}",
      taskUpdated: "已更新任务: {{taskName}}",
    },
    rail: {
      collapseSidebar: "隐藏侧栏",
      closeWorkspacePanel: "关闭工作区面板",
      config: "配置",
      expandSidebar: "展开侧栏",
      logs: "日志",
      tasks: "任务",
    },
    workspace: {
      tasks: {
        summary: "当前共 {{totalTasks}} 个任务，其中 {{enabledTasks}} 个启用。",
        title: "任务队列",
      },
    },
  },
  config: {
    fields: {
      configFile: {
        description: "切换当前工作配置。新路径会立即加载。",
        label: "配置文件",
        placeholder: "config.toml",
      },
      inputFolder: {
        description: "批处理时默认读取的 PDF 来源目录。",
        label: "输入目录",
        placeholder: "./input_pdfs",
      },
      outputFolder: {
        description: "处理完成后的 PDF 导出目录。",
        label: "输出目录",
        placeholder: "./output_pdfs",
      },
    },
    filePicker: {
      selectConfig: "选择配置文件",
      selectInputFolder: "选择输入文件夹",
      selectOutputFolder: "选择输出文件夹",
    },
    note: "更改路径后不会自动写盘，保存后才会更新配置文件。",
    status: {
      dirty: "未保存更改",
      synced: "已同步",
    },
    title: "路径与配置",
  },
  logs: {
    empty:
      "暂无日志。开始预览或批处理后，后端事件会在这里按时间顺序展开。",
    levels: {
      debug: "调试",
      error: "错误",
      info: "信息",
      trace: "跟踪",
      warn: "警告",
    },
    summary: {
      debug: "调试",
      error: "错误",
      info: "信息",
      warn: "警告",
    },
    title: "运行日志",
  },
  preview: {
    empty: {
      noPdfDescription:
        "从主工具栏选择一个 PDF 后，右侧会以接近最终输出的方式展示图片叠加效果。",
      noPdfTitle: "还没有预览 PDF",
      noTasksDescription:
        "启用至少一个任务后，这里会直接显示图片叠加效果与落点辅助线。",
      noTasksTitle: "没有启用的任务",
      preparingDescription: "当前状态还没有可显示的切片，请稍后再试。",
      preparingTitle: "预览准备中",
    },
    fallbackFileName: "未选择预览文件",
    failed: "预览失败",
    imageAlt: "PDF 预览",
    loading: "后端正在渲染预览...",
    modes: {
      all: "全部叠加",
      effect: "纯效果",
      focused: "当前任务",
    },
    navigation: {
      nextPage: "下一页",
      previousPage: "上一页",
    },
    status: {
      batchProgress: "{{stateLabel}} {{current}}/{{total}}",
      currentTask: "当前任务 {{taskName}}",
      enabledTasks: "{{taskCount}} 个启用任务",
      page: "第 {{current}} / {{total}} 页",
      processing: "处理中",
      randomOffset: "含随机偏移",
      recentBatch: "最近批处理",
    },
    title: "预览工作区",
  },
  progress: {
    allCompleted: "处理完成: 成功 {{successCount}} 个, 失败 {{failedCount}} 个",
    fileCompleted: "{{filename}} 已完成，插入 {{insertionCount}} 处",
    fileError: "处理失败: {{filename}} - {{error}}",
    fileStarted: "开始处理 {{filename}}",
  },
  tasks: {
    dialog: {
      ariaClose: "关闭任务编辑器",
      defaultName: "任务 {{index}}",
      fields: {
        baseOffsetX: "基础偏移 X",
        baseOffsetY: "基础偏移 Y",
        imagePath: "图片路径",
        name: "任务名称",
        randomOffsetX: "随机偏移 X (±)",
        randomOffsetY: "随机偏移 Y (±)",
        searchText: "搜索文本",
        targetHeight: "目标高度 (points)",
      },
      filePicker: {
        selectImage: "选择图片文件",
      },
      panelLabel: {
        edit: "编辑任务",
        new: "新建任务",
      },
      placeholders: {
        imagePath: "选择或输入图片路径",
        searchText: "在 PDF 中搜索此文本",
      },
      sections: {
        enabled: {
          description: "关闭后会保留配置，但不会参与预览和批处理。",
          title: "启用任务",
        },
        position: {
          description: "基础偏移会稳定应用，随机偏移用于弱化机械感。",
          title: "位置控制",
        },
        targetHeight: {
          description: "设为 0 时，沿用图片原始高度。",
        },
      },
      title: {
        edit: "编辑 {{taskName}}",
        new: "添加新任务",
      },
      validation: {
        imagePathRequired: "图片路径不能为空",
        nameDuplicate: "任务名称已存在",
        nameRequired: "任务名称不能为空",
        searchTextRequired: "搜索文本不能为空",
      },
    },
    empty: {
      description:
        "添加任务后，这里会变成高密度任务队列。预览区会立即使用启用任务进行叠加。",
      title: "还没有任务",
    },
    list: {
      delete: "删除任务 {{taskName}}",
      disabled: "已停用",
      edit: "编辑任务 {{taskName}}",
      searchLabel: "搜索",
    },
    meta: {
      baseOffset: "基础偏移",
      height: "高度",
      randomOffsetX: "随机偏移 X",
      randomOffsetY: "随机偏移 Y",
    },
  },
} as const;

type TranslationSchema = DeepStringShape<typeof zhCN>;

const enUS = {
  common: {
    actions: {
      addTask: "Add Task",
      browse: "Browse",
      cancel: "Cancel",
      changePreview: "Change Preview",
      clear: "Clear",
      close: "Close",
      copy: "Copy",
      copied: "Copied",
      disableAll: "Disable All",
      enableAll: "Enable All",
      new: "New",
      saveChanges: "Save Changes",
      saveConfig: "Save Config",
      saving: "Saving...",
      select: "Select",
      selectPreview: "Select Preview",
      startBatch: "Start Batch",
    },
    files: {
      allFiles: "All Files",
      image: "Images",
      pdf: "PDF",
      toml: "TOML",
    },
    locale: {
      names: {
        enUs: "English",
        zhCn: "Chinese",
      },
      short: {
        enUs: "EN",
        zhCn: "中",
      },
    },
    theme: {
      dark: "Dark",
      light: "Light",
      resolved: {
        dark: "Dark",
        light: "Light",
      },
      system: "System",
    },
  },
  app: {
    dialogs: {
      confirmDeleteTask: 'Delete task "{{taskId}}"?',
    },
    filePicker: {
      selectPreviewPdf: "Select PDF File",
    },
    logs: {
      configLoaded: "Loaded config file: {{path}}",
      configSaveFailed: "Failed to save config: {{message}}",
      configSaved: "Saved config file: {{path}}",
      noEnabledTasks: "No enabled tasks. Processing canceled.",
      previewLoaded: "Loaded preview file: {{fileName}} ({{pageCount}} pages)",
      previewPageCountFailed:
        "Selected preview file {{fileName}}, but failed to read page count: {{message}}",
      processFailed: "Processing failed: {{message}}",
      processStarted: "Started processing {{taskCount}} tasks.",
      taskAdded: "Added task: {{taskName}}",
      taskDeleted: "Deleted task: {{taskId}}",
      taskUpdated: "Updated task: {{taskName}}",
    },
    rail: {
      collapseSidebar: "Collapse Sidebar",
      closeWorkspacePanel: "Close Workspace Panel",
      config: "Config",
      expandSidebar: "Expand Sidebar",
      logs: "Logs",
      tasks: "Tasks",
    },
    workspace: {
      tasks: {
        summary: "{{totalTasks}} tasks total, {{enabledTasks}} enabled.",
        title: "Task Queue",
      },
    },
  },
  config: {
    fields: {
      configFile: {
        description: "Switch the current working config. The new path loads immediately.",
        label: "Config File",
        placeholder: "config.toml",
      },
      inputFolder: {
        description: "Default source folder for PDFs during batch processing.",
        label: "Input Folder",
        placeholder: "./input_pdfs",
      },
      outputFolder: {
        description: "Export folder for processed PDFs.",
        label: "Output Folder",
        placeholder: "./output_pdfs",
      },
    },
    filePicker: {
      selectConfig: "Select Config File",
      selectInputFolder: "Select Input Folder",
      selectOutputFolder: "Select Output Folder",
    },
    note: "Changing paths does not write to disk automatically. Save to update the config file.",
    status: {
      dirty: "Unsaved Changes",
      synced: "Synced",
    },
    title: "Paths & Config",
  },
  logs: {
    empty:
      "No logs yet. Once preview or batch processing starts, backend events will appear here in chronological order.",
    levels: {
      debug: "Debug",
      error: "Error",
      info: "Info",
      trace: "Trace",
      warn: "Warn",
    },
    summary: {
      debug: "Debug",
      error: "Errors",
      info: "Info",
      warn: "Warnings",
    },
    title: "Run Logs",
  },
  preview: {
    empty: {
      noPdfDescription:
        "Select a PDF from the main toolbar to preview the image overlay close to the final output.",
      noPdfTitle: "No Preview PDF Yet",
      noTasksDescription:
        "Enable at least one task to show image overlays and guide lines here.",
      noTasksTitle: "No Enabled Tasks",
      preparingDescription: "There is no preview slice to show yet. Try again in a moment.",
      preparingTitle: "Preparing Preview",
    },
    fallbackFileName: "No Preview File Selected",
    failed: "Preview Failed",
    imageAlt: "PDF preview",
    loading: "Rendering preview from backend...",
    modes: {
      all: "All Overlays",
      effect: "Effect Only",
      focused: "Current Task",
    },
    navigation: {
      nextPage: "Next Page",
      previousPage: "Previous Page",
    },
    status: {
      batchProgress: "{{stateLabel}} {{current}}/{{total}}",
      currentTask: "Current Task {{taskName}}",
      enabledTasks: "{{taskCount}} enabled tasks",
      page: "Page {{current}} / {{total}}",
      processing: "Processing",
      randomOffset: "Random Offset",
      recentBatch: "Recent Batch",
    },
    title: "Preview Workspace",
  },
  progress: {
    allCompleted:
      "Processing completed: {{successCount}} succeeded, {{failedCount}} failed",
    fileCompleted: "{{filename}} completed with {{insertionCount}} insertions",
    fileError: "Processing failed: {{filename}} - {{error}}",
    fileStarted: "Started processing {{filename}}",
  },
  tasks: {
    dialog: {
      ariaClose: "Close Task Editor",
      defaultName: "Task {{index}}",
      fields: {
        baseOffsetX: "Base Offset X",
        baseOffsetY: "Base Offset Y",
        imagePath: "Image Path",
        name: "Task Name",
        randomOffsetX: "Random Offset X (±)",
        randomOffsetY: "Random Offset Y (±)",
        searchText: "Search Text",
        targetHeight: "Target Height (points)",
      },
      filePicker: {
        selectImage: "Select Image File",
      },
      panelLabel: {
        edit: "Edit Task",
        new: "New Task",
      },
      placeholders: {
        imagePath: "Select or enter an image path",
        searchText: "Search for this text in the PDF",
      },
      sections: {
        enabled: {
          description:
            "When disabled, the config is kept but excluded from preview and batch processing.",
          title: "Enable Task",
        },
        position: {
          description:
            "Base offset stays stable while random offset reduces a mechanical look.",
          title: "Position Controls",
        },
        targetHeight: {
          description: "Set to 0 to keep the image's original height.",
        },
      },
      title: {
        edit: "Edit {{taskName}}",
        new: "Add New Task",
      },
      validation: {
        imagePathRequired: "Image path is required",
        nameDuplicate: "Task name already exists",
        nameRequired: "Task name is required",
        searchTextRequired: "Search text is required",
      },
    },
    empty: {
      description:
        "Once you add tasks, this becomes a dense task queue and the preview will immediately overlay enabled tasks.",
      title: "No Tasks Yet",
    },
    list: {
      delete: "Delete task {{taskName}}",
      disabled: "Disabled",
      edit: "Edit task {{taskName}}",
      searchLabel: "Search",
    },
    meta: {
      baseOffset: "Base Offset",
      height: "Height",
      randomOffsetX: "Random Offset X",
      randomOffsetY: "Random Offset Y",
    },
  },
} satisfies TranslationSchema;

export const defaultNS = "translation";

export const resources = {
  "en-US": {
    translation: enUS,
  },
  "zh-CN": {
    translation: zhCN,
  },
} as const;

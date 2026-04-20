# 项目结构与架构概览

本项目是一个基于 **Tauri** 框架开发的桌面应用程序，前端采用 **React + Vite (TypeScript)**，后端核心逻辑采用 **Rust** 编写。以下是项目主要目录结构及职责的详细说明。

## 根目录核心文件

- `package.json` / `pnpm-lock.yaml`: 前端及 Node.js 相关的依赖和脚本配置文件。本项目指定使用 `pnpm` 作为包管理器。
- `vite.config.ts`: Vite 的构建配置文件，包含开发服务器设置和各类插件配置。
- `tsconfig.json` / `tsconfig.node.json`: TypeScript 配置文件。
- `index.html`: 前端应用的入口 HTML 文件，负责引入 React 的启动脚本和应用图标。

## 主要目录结构

### 1. `src/` (前端代码目录)

该目录包含了所有与用户界面相关的 React 业务代码：

- `App.tsx` / `main.tsx`: React 应用的核心组件和程序入口。
- `components/`: 存放按功能划分的 UI 组件，例如：
  - `TaskList.tsx`: 任务列表与拖拽交互。
  - `ConfigPanel.tsx`: 全局设置面板。
  - `PreviewPanel.tsx`: PDF 实时预览面板。
  - `ui/`: 基于 Tailwind CSS 构建的基础通用组件。
- `hooks/`: 自定义 React Hooks，用于封装业务状态与逻辑：
  - `useAppState.ts`: 管理应用全局状态（进度、日志等）。
  - `useConfig.ts`: 负责配置文件的读取与持久化保存。
  - `useLocale.ts`: 处理国际化语言切换。
  - `useTheme.ts`: 管理主题（浅色/深色）模式。
- `i18n/`: 多语言国际化（i18next）相关的配置、类型声明和翻译资源文件。
- `lib/`: 核心工具函数与类型定义：
  - `tauri-commands.ts`: 封装与 Tauri Rust 后端通信的 API 命令（如文件读取、PDF 渲染指令）。
  - `types.ts`: 全局共享的 TypeScript 类型与接口定义。
  - `utils.ts`: 通用的基础工具函数。
- `assets/`: 前端页面内部需要经构建工具处理的静态资源（如 CSS 样式表、内联图片等）。

### 2. `src-tauri/` (后端/原生代码目录)

该目录是 Tauri 的核心工作区，负责系统级交互、文件 I/O 以及高强度的业务运算，完全由 Rust 编写：

- `Cargo.toml` / `Cargo.lock`: Rust 项目的包依赖管理与配置文件。
- `tauri.conf.json`: Tauri 桌面应用的核心配置文件，定义了应用名称、窗口尺寸、构建脚本和基础权限。
- `src/`: Rust 后端核心源代码：
  - `main.rs`, `lib.rs`: Rust 程序的生命周期管理与入口点，负责注册各类 Tauri Commands 供前端调用。
  - `batch.rs`: 核心批处理调度逻辑，处理多文件并发任务。
  - `pdf/`: 专门用于封装 PDFium 库调用，处理 PDF 解析和页面的图片插入操作。
  - `image/`: 图片预处理模块。
  - `config/`: 后端对于用户配置（如路径、任务参数）的读取和校验。
  - `coord/`: 处理页面尺寸及图片插入坐标（含随机偏移量）换算的工具模块。
- `resources/pdfium/`: 包含针对不同操作系统的 PDFium 预编译动态链接库（如 `.dll`, `.dylib`, `.so`），这是实现 PDF 底层操作的核心依赖。
- `icons/`: 存放各平台应用安装和运行时所需的各尺寸图标（如 macOS 的 `.icns` 和 Windows 的 `.ico`）。
- `capabilities/`: Tauri 2.0+ 的权限能力配置，定义了应用可以访问哪些核心 OS 功能（如文件系统白名单、对话框调用等）。

### 3. 辅助及构建目录

- `.github/`: 包含 GitHub 相关的配置：
  - `workflows/tauri-build.yml`: 自动化 CI/CD 工作流，利用 GitHub Actions 在多操作系统上自动构建和发布 Tauri 桌面安装包。
  - `dependabot.yml`: 自动化依赖更新配置。
- `public/`: 存放无需经过 Vite 构建系统处理的公共静态资源（例如基础图标 `vite.svg`），这些文件会在打包时原样复制。
- `scripts/`: 存放项目级的开发辅助脚本，如强制开发者必须使用 pnpm 安装依赖的脚本 `enforce-pnpm.cjs`。

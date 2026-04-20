# PDF Image Inserter

这是一个基于 [Tauri](https://tauri.app/) 开发的现代化跨平台桌面应用程序，专门用于批量自动化向 PDF 文件中插入图片。该工具可以根据自定义的任务配置，精准控制图片插入的坐标（支持随机偏移）和尺寸。

![Design](/public/Design.png)


## 核心特性

- **批量处理**：支持对整个文件夹内的多个 PDF 文件进行批量图片插入。
- **灵活的任务配置**：
  - 自定义图片插入的基准坐标（`baseOffsetX`, `baseOffsetY`）。
  - 支持随机偏移范围（`randomOffsetX`, `randomOffsetY`），模拟更自然的插入效果。
  - 精确控制图片的显示尺寸（`targetHeightPoints`）。
- **实时预览面板**：通过内置的 UI 实时预览目标 PDF 文件，方便进行坐标调整和校对。
- **现代化外观**：支持浅色（Light）、深色（Dark）及跟随系统的自动主题切换。
- **国际化支持**：内置多语言系统（中文 `zh-CN`、英文 `en-US`）。
- **高性能后端**：由 Rust 编写的底层业务逻辑，集成了 PDFium 用于高强度的 PDF 解析和渲染。

## 技术栈与致谢

本项目使用了以下优秀的开源技术，在此表示衷心的感谢，并遵循其相应的开源许可证：

- **[Tauri](https://tauri.app/)** (MIT / Apache-2.0): 提供轻量级、安全的跨平台桌面应用运行环境。
- **[React](https://react.dev/)** (MIT): 用于构建用户界面的 JavaScript 库。
- **[Vite](https://vitejs.dev/)** (MIT): 下一代前端构建工具。
- **[TypeScript](https://www.typescriptlang.org/)** (Apache-2.0): 强类型的 JavaScript 超集。
- **[Tailwind CSS](https://tailwindcss.com/)** (MIT): 实用优先的 CSS 框架。
- **[Lucide Icons](https://lucide.dev/)** (ISC): 精美的开源图标库。
- **[PDFium](https://pdfium.googlesource.com/pdfium/)** (BSD 3-Clause / Apache-2.0): 强大的 PDF 渲染引擎。
- **[Rust](https://www.rust-lang.org/)** (MIT / Apache-2.0): 提供内存安全与高性能的后端逻辑。
- **[pnpm](https://pnpm.io/)** (MIT): 快速、节省磁盘空间的包管理器。

特别感谢 **Codex** 和 **Gemini** 在本项目的开发过程中提供的智能协助与代码生成支持。

## 本地开发环境设置

### 前置要求

在开始开发之前，请确保您的系统中已经安装了以下依赖：
- **Node.js** (推荐 v24 或更高版本)
- **pnpm** (通过 `npm install -g pnpm` 安装)
- **Rust Toolchain** (通过 [rustup](https://rustup.rs/) 安装)
- 各平台所需的 Tauri [系统级依赖](https://tauri.app/v1/guides/getting-started/prerequisites)（如 macOS 需要 Xcode Command Line Tools，Windows 需要 C++ build tools，Linux 需要各类 `libgtk-3-dev` 和 `webkit2gtk` 等相关包）。

### 安装与运行

1. 克隆项目仓库并进入目录：
   ```bash
   git clone <你的仓库地址>
   cd pdf-img-inserter
   ```

2. 安装前端依赖（请务必使用 pnpm）：
   ```bash
   pnpm install
   ```

3. 启动本地开发服务器（同时启动前端页面和 Tauri 的 Rust 窗口）：
   ```bash
   pnpm tauri dev
   ```

## 项目构建与打包

要构建适用于您当前操作系统的桌面安装包，请运行以下命令：

```bash
pnpm tauri build
```

打包完成后，安装程序将被生成在 `src-tauri/target/release/bundle/` 目录下（如 macOS 的 `.dmg`，Windows 的 `.msi` 或 `.exe`，Linux 的 `.deb` / `.AppImage`）。

## 项目结构概览

详细的项目结构说明请参阅 [ARCHITECTURE.md](ARCHITECTURE.md)。

## 贡献指南

1. Fork 本仓库。
2. 创建您的功能分支 (`git checkout -b feature/AmazingFeature`)。
3. 提交您的修改 (`git commit -m 'Add some AmazingFeature'`)。
4. 将分支推送到远程仓库 (`git push origin feature/AmazingFeature`)。
5. 发起一个 Pull Request。

## 许可证

本项目遵循 [MIT License](LICENSE) 许可证发布。

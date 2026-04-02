# TESTS

本文档说明项目当前的测试结构、运行方式和覆盖范围。

## 测试目录

Rust 测试位于：

- [src-tauri/tests](/pdf-img-inserter/src-tauri/tests)

当前包含：

- [config_loader_tests.rs](/pdf-img-inserter/src-tauri/tests/config_loader_tests.rs)
  关注配置创建、可移植路径保存、路径恢复、旧配置迁移保护
- [coord_transform_tests.rs](/pdf-img-inserter/src-tauri/tests/coord_transform_tests.rs)
  关注 PDF 坐标与 Web 坐标的换算、可见性判断
- [image_cache_tests.rs](/pdf-img-inserter/src-tauri/tests/image_cache_tests.rs)
  关注原图缓存、预处理缓存、缩放尺寸计算
- [common/mod.rs](/pdf-img-inserter/src-tauri/tests/common/mod.rs)
  测试辅助代码，用于创建临时工作目录和示例 PNG

此外还有模块内单元测试：

- [transform.rs](/pdf-img-inserter/src-tauri/src/coord/transform.rs)

## 如何运行测试

### 运行全部 Rust 测试

```bash
cargo test --manifest-path src-tauri/Cargo.toml
```

### 运行 Rust 编译检查

```bash
cargo check --manifest-path src-tauri/Cargo.toml
```

### 运行前端类型检查

```bash
pnpm exec tsc --noEmit
```

## 当前已覆盖的风险点

- 配置文件保存为便携相对路径后，重新加载能否恢复为绝对路径
- 应用托管默认配置是否会正确创建输入/输出目录
- 旧版默认配置迁移时，是否错误覆盖用户自定义目录
- 图片缓存是否会复用相同资源
- 图片预处理在不同目标高度下是否产生正确尺寸
- PDF 左下角坐标系到 Web 左上角坐标系的换算是否正确

## 当前尚未自动化覆盖的部分

- 真实 Pdfium 动态库加载的端到端验证
- 真实 PDF 文本搜索命中结果
- 真正写出 PDF 文件后的视觉正确性
- React 组件级交互测试
- Tauri 前后端联调级 UI 自动化测试

这意味着：
- 当前测试更偏“核心逻辑正确性”
- 还不是完整的 E2E 测试体系

## 新增测试时的建议

- 优先补“容易 silently wrong”的逻辑
  例如路径迁移、坐标换算、随机偏移稳定采样、输出文件选择策略
- 对纯函数优先写单元测试
- 对文件系统与缓存逻辑优先写集成测试
- 如果后面引入前端测试，建议用 `Vitest`
- 如果后面引入桌面端自动化，建议单独规划 `Playwright` 或 Tauri 集成测试方案

## 发布前最低测试要求

建议至少执行以下命令：

```bash
pnpm exec tsc --noEmit
cargo check --manifest-path src-tauri/Cargo.toml
cargo test --manifest-path src-tauri/Cargo.toml
```

如果改动涉及打包资源、Pdfium、预览或批处理流程，建议再额外手动验证：

1. 选择一个 PDF，确认预览可见
2. 执行一次批处理
3. 打开导出的 PDF，确认图片落点正确

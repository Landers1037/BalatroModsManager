# Contributing | 参与贡献

感谢你关注 `Balatro Mods Manager`。

This document explains how to contribute to the project in both Chinese and English.

## 欢迎贡献 | Welcome

你可以通过以下方式参与项目：

- 提交 Bug 反馈
- 提交功能建议
- 改进文档
- 修复问题
- 提交新功能或优化

You can contribute by:

- Reporting bugs
- Suggesting improvements
- Improving documentation
- Fixing issues
- Sending new features or refactors

## 开发环境 | Development Environment

推荐环境：

- Windows
- Bun `>= 1.3`
- Git

Recommended environment:

- Windows
- Bun `>= 1.3`
- Git

安装依赖：

```bash
bun install
```

Install dependencies:

```bash
bun install
```

## 本地运行 | Run Locally

启动开发模式：

```bash
bun run dev
```

Start in development mode:

```bash
bun run dev
```

启用调试模式：

```bash
bun run src/index.tsx --debug
```

Run with debug logging:

```bash
bun run src/index.tsx --debug
```

## 提交前检查 | Before Submitting

提交前请至少执行以下命令：

```bash
bun run typecheck
bun test
```

Before submitting, please run:

```bash
bun run typecheck
bun test
```

如果你改动了打包相关逻辑，也建议额外测试：

```bash
bun run build:exe
```

If you changed build logic, also test:

```bash
bun run build:exe
```

## 分支与提交建议 | Branch and Commit Suggestions

建议为每个功能或修复创建独立分支，例如：

```text
feat/scrolling-mod-list
fix/mod-status-render
docs/readme-update
```

Suggested branch naming:

```text
feat/scrolling-mod-list
fix/mod-status-render
docs/readme-update
```

建议提交信息尽量简洁明确，例如：

```text
feat: add scrollbox for mod list
fix: avoid stale status text rendering
docs: expand readme and contributing guide
```

Suggested commit messages:

```text
feat: add scrollbox for mod list
fix: avoid stale status text rendering
docs: expand readme and contributing guide
```

## 代码风格 | Code Style

请尽量遵循当前项目已有风格：

- 使用 TypeScript
- 保持代码简洁清晰
- 优先小范围、可验证的改动
- 不要引入无关的大规模重构
- 非必要不要增加复杂抽象

Please follow the existing project style:

- Use TypeScript
- Keep code simple and readable
- Prefer focused and verifiable changes
- Avoid unrelated large refactors
- Do not add unnecessary abstractions

## TUI 相关说明 | TUI Notes

本项目使用 `@opentui/react` 构建终端界面。

修改 TUI 相关逻辑时，请注意：

- 列表区域的高度与滚动行为
- 选中项是否始终可见
- 文本刷新时是否存在残影
- 键盘快捷键是否与现有行为冲突

This project uses `@opentui/react` for the terminal UI.

When changing the TUI, please pay attention to:

- List height and scrolling behavior
- Whether the selected item stays visible
- Whether text redraw leaves stale artifacts
- Whether new keyboard shortcuts conflict with existing behavior

## Mods 扫描逻辑说明 | Mods Scanning Notes

修改扫描逻辑时，请保持这些规则不被破坏：

- 只扫描 `Mods` 根目录
- 不进入子目录
- 只识别 `.lua` 和 `.lua.disable`
- 必须通过 `SMODS.INIT.*` 判定为模组
- 尽量保持顶部注释解析兼容现有格式

When changing scan logic, keep these rules intact:

- Only scan the root of `Mods`
- Do not enter subdirectories
- Only recognize `.lua` and `.lua.disable`
- Treat files as mods only if they define `SMODS.INIT.*`
- Keep top-comment parsing compatible with existing formats

## 文档贡献 | Documentation Contributions

欢迎改进以下内容：

- README
- 使用示例
- 快捷键说明
- 贡献流程
- 错误排查说明

Documentation improvements are welcome, including:

- README
- Usage examples
- Keybinding reference
- Contribution process
- Troubleshooting notes

## Pull Request 建议 | Pull Request Tips

请在 PR 描述中尽量包含：

- 改动目的
- 改动内容摘要
- 测试方式
- 是否影响现有行为
- 如有界面改动，附截图或录屏

Please include in your PR description:

- Why the change is needed
- A short summary of the change
- How it was tested
- Whether behavior changes
- Screenshots or recordings for UI changes

## Issue 反馈建议 | Issue Reporting Tips

提交 Issue 时建议提供：

- 操作系统版本
- Bun 版本
- 终端类型
- 复现步骤
- 期望行为
- 实际行为
- 截图或日志

When opening an issue, please provide:

- OS version
- Bun version
- Terminal type
- Reproduction steps
- Expected behavior
- Actual behavior
- Screenshots or logs


## 致谢 | Thanks

感谢你的时间与贡献。

Thank you for your time and contributions.

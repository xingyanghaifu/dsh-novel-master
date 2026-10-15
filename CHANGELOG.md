# Changelog

## 1.1.0 (2025-01-15)

### 新增
- ✨ 配置面板支持：可以在 DSH 插件设置里选择启用/禁用每个命令
- ✨ `Config` Schema 导出，支持插件设置 UI
- 📦 完善的 npm 包元数据（repository、bugs、homepage）

### 改进
- 📝 更新 README，添加两种安装方式说明
- 📝 添加配置示例和完整的文档
- 🔧 添加 `.npmignore` 优化打包体积

## 1.0.0 (2025-01-15)

### 初始发布
- 13 个斜杠命令：`/novel`、`/novel-continue`、`/novel-study`、`/novel-outline`、`/novel-cast`、`/novel-rewrite`、`/novel-review`、`/novel-idea`、`/novel-spark`、`/novel-world`、`/novel-role`、`/novel-stats`、`/novel-export`
- 完本和续写由 DSH 目标服务驱动；没有目标服务时退回逐轮写作
- 剧情分岔（ask / auto）记在 `剧情树.md`；每章推进一次世界时钟和幕后行动
- 拆书时先做客观统计，再写风格档案，可以套用到项目的 `写作规范.md`
- 导入 txt/md 时自动识别 UTF-8 / GB18030 编码并拆章；导出支持 txt / md / html

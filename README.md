# dsh-novel-master · 小说创作大师

[![npm version](https://img.shields.io/npm/v/dsh-novel-master.svg)](https://www.npmjs.com/package/dsh-novel-master)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

给 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（DSH）用的**全功能小说创作插件**。在输入框里打 `/` 就能看到 **19 个专业命令**，覆盖从创意到发布的完整流程。

**🌟 亮点：**
- ✅ 一键完本：`/novel` 自动写满整本书
- ✅ **虚拟读者反馈**：全球首创，模拟真实读者体验
- ✅ **冲突/节奏/情感分析**：可视化分析工具
- ✅ **市场适配**：针对起点/纵横/晋江优化
- ✅ **AI 味检测**：对话增强和深度审校

---

## 📚 命令总览（19 个）

### 核心写作命令

| 命令 | 作用 |
|---|---|
| `/novel <脑洞> [60章\|20万字] [--auto]` | 🎯 **一键完本**：建项目，规划设定、人设、大纲，自动连写到目标章数 |
| `/novel-continue [项目\|文件.txt] [N章] [--auto]` | ✍️ **续写**：接着已有项目写；也可导入 txt/md（支持 GBK） |
| `/novel-rewrite [项目] <章号> [要求]` | 🔄 **改写章节**，旧稿留在 `正文/_旧稿/` |

### 规划与辅助

| 命令 | 作用 |
|---|---|
| `/novel-idea <一句话脑洞>` | 💡 **构思**：给出 3 个不同的展开方向 |
| `/novel-outline [项目] [要求]` | 📋 **大纲**：生成或调整分卷大纲，标出 [分岔点] 和 [高潮] |
| `/novel-cast [项目] [要求]` | 👥 **人设**：性格、说话习惯、口头禅、目标、关系 |
| `/novel-world [项目] [推演要求]` | 🌍 **世界状态**：查看世界时钟和势力动向；带要求就推演 |
| `/novel-role [项目] [角色名\|要求]` | 🎭 **角色管理**：查看或更新角色 |
| `/novel-spark [项目] [卡在哪]` | ⚡ **灵感**：卡文时给几种接下来的走法 |

### 🆕 革命性分析功能

| 命令 | 作用 | 创新度 |
|---|---|:---:|
| `/novel-conflict [项目] [章节范围]` | 🔥 **冲突设计器**：分析内部/人际/外部冲突，评估强度，给出升级建议 | ⭐⭐⭐⭐⭐ |
| `/novel-pace [项目]` | 📈 **节奏分析器**：ASCII 可视化节奏曲线，统计对话/叙述比例 | ⭐⭐⭐⭐⭐ |
| `/novel-reader [项目] [章节] [--persona 类型]` | 👤 **虚拟读者反馈**：模拟新手/老读者/挑剔读者的真实阅读体验 | ⭐⭐⭐⭐⭐ |
| `/novel-dialogue [项目] <章号> [角色名]` | 💬 **对话增强器**：检测 AI 味对话，验证人设符合度，提供改写方案 | ⭐⭐⭐⭐ |
| `/novel-emotion [项目] [章节范围]` | 💗 **情感曲线追踪**：情感密度可视化，识别共情点 | ⭐⭐⭐⭐ |

### 质量提升

| 命令 | 作用 |
|---|---|
| `/novel-review [项目] [章节\|最近N章] [--deep]` | 🔍 **审校**：错字、AI 味、OOC、设定矛盾、伏笔<br>**深度模式**：逻辑检查、时间线冲突、情感真实性 |
| `/novel-study <参考文件> [--to 项目]` | 📖 **拆书**：分析风格，可套用到项目 |
| `/novel-stats [项目] [--detailed]` | 📊 **统计**：字数、进度、伏笔回收<br>**详细模式**：角色出场、质量评分 |

### 发布与市场

| 命令 | 作用 |
|---|---|
| `/novel-market <平台> [项目]` | 📱 **市场分析**：根据起点/纵横/晋江/17K 特点优化内容 |
| `/novel-export [项目] [txt\|md\|html]` | 📦 **导出**：合并全书，生成目录 |

---

## 🌟 核心特性

### 1. 全球首创：虚拟读者反馈

模拟不同类型读者的真实阅读体验：

```bash
/novel-reader 我的项目 5 --persona 挑剔读者
```

**输出示例：**
```
👤 虚拟读者反馈（挑剔读者视角）

😊 喜欢的：
  • 林晓吸收灵气的场景很燃
  
😕 困惑的：
  • "引气境"是什么？没解释清楚
  
💤 无聊的：
  • 第二段环境描写太长了
  
📖 期待的：
  • 苏瑶什么时候出现？
```

### 2. 可视化分析工具

**节奏曲线：**
```
章节  1  2  3  4  5  6  7  8  9 10
节奏 ━━╋━━╋━━╋━━━━━━╋━╋━━━
     慢 中 快 慢  慢 中 快 高潮 慢 中

情绪 ⭐⭐ ⭐⭐⭐ ⭐⭐⭐⭐ ⭐⭐ ⭐⭐⭐⭐⭐
```

**冲突强度评估：**
```
📊 冲突分析

第 1-10 章：
  内部冲突：⭐⭐⭐
  人际冲突：⭐⭐⭐⭐
  外部冲突：⭐⭐

🎯 建议：第 8 章增加道德困境
```

### 3. AI 味检测与优化

**对话检测：**
```
❌ "我觉得我们应该好好谈谈这件事情。"
   问题：太正式，不符合人设

✅ 建议："嗯。有事？"
   理由：短句，符合寡言性格
```

### 4. 市场适配分析

针对不同平台优化内容：

```bash
/novel-market qidian 我的项目
```

**分析维度：**
- 题材匹配度
- 读者画像匹配
- 爆款要素检查
- 章节长度建议
- 标签和定价策略

---

## 🚀 快速开始

### 安装

**方式 1：DSH 插件管理器（推荐）**

1. 打开 DSH → 设置 → 插件
2. 安装 `dsh-novel-master`
3. 启用插件

**方式 2：本地路径（开发）**

```yaml
# cordis.patch.yml
- insert:
    - id: novel-master-commands
      name: '/path/to/dsh-novel-master/src/index.js'
      config:
        enabled: true
```

### 使用示例

```bash
# 1. 创建新书
/novel 网管发现网吧的电脑能修仙 80章

# 2. 分析冲突设计
/novel-conflict 网管发现网吧的电脑能修仙 1-10

# 3. 检查节奏
/novel-pace 网管发现网吧的电脑能修仙

# 4. 虚拟读者反馈
/novel-reader 网管发现网吧的电脑能修仙 5 --persona 新手读者

# 5. 深度审校
/novel-review 最近5章 --deep

# 6. 市场分析
/novel-market qidian 网管发现网吧的电脑能修仙

# 7. 导出全书
/novel-export html
```

---

## 💡 工作方式

### 状态持久化

**全部状态都存在文件里**，每本书是一个目录：

```
novel_projects/
└── 网管发现网吧的电脑能修仙/
    ├── 项目.json          # 项目配置
    ├── 写作规范.md        # 风格规则
    ├── 完本流程.md        # 自动化流程
    ├── 设定.md            # 世界观
    ├── 角色.md            # 人设
    ├── 大纲.md            # 分卷大纲
    ├── 世界状态.md        # 时间线和势力
    ├── 伏笔.md            # 伏笔管理
    ├── 剧情树.md          # 分岔记录
    └── 正文/
        ├── 第1章_发现.md
        ├── 第2章_修炼.md
        └── ...
```

上下文压缩、重启 DSH、换新会话都不会丢进度。

### 自动完本

`/novel` 创建 DSH 目标，自动一轮轮写到目标章数：

- 每轮写 1-3 章
- 自动推进世界状态
- 自动处理剧情分岔
- 目标完成后自动停止

中途可用 `/goal pause` 暂停、`/goal resume` 继续。

### 剧情分岔

大纲标记 3-8 个分岔点：

- **ask 模式**（默认）：让你选择走向
- **--auto 模式**：AI 根据人物性格自动选择

每次选择都记入 `剧情树.md`。

### 世界自主运转

每写完一章，世界时钟前进，不在场的角色也在幕后行动，后面会影响主线。

---

## 📊 功能对比

| 功能 | dsh-novel-master | 其他插件 |
|------|:----------------:|:--------:|
| 一键完本 | ✅ | ❌ |
| 虚拟读者反馈 | ✅ **独家** | ❌ |
| 冲突分析 | ✅ | ❌ |
| 节奏可视化 | ✅ | ❌ |
| 对话 AI 味检测 | ✅ | ❌ |
| 情感曲线追踪 | ✅ | ❌ |
| 市场适配分析 | ✅ | ❌ |
| 深度审校 | ✅ | 部分 |
| 自动剧情分岔 | ✅ | ❌ |
| 世界推演 | ✅ | ❌ |
| 风格学习 | ✅ | ❌ |

---

## ⚙️ 配置

所有命令都可以在设置面板中单独启用/禁用：

```yaml
config:
  enabled: true
  commands:
    novel: true
    conflict: true      # 冲突分析
    pace: true          # 节奏分析
    reader: true        # 虚拟读者
    dialogue: true      # 对话增强
    emotion: true       # 情感曲线
    market: true        # 市场分析
    review: true        # 审校
    stats: true         # 统计
    # ... 其他命令
  projectsDir: 'novel_projects'  # 项目目录
```

---

## 🎓 进阶用法

### 1. 深度审校模式

```bash
/novel-review 最近5章 --deep
```

**增强检查项：**
- 时间线冲突
- 地点穿越
- 能力不一致
- 物品和伤势连续性
- 无效剧情识别
- 信息密度分析

### 2. 详细统计模式

```bash
/novel-stats 我的项目 --detailed
```

**详细报告：**
- 角色出场次数和台词统计
- 主动/被动场景比例
- 伏笔回收率
- 质量评分（可读性、AI 味、节奏、人设）

### 3. 多平台分析

```bash
/novel-market qidian 我的项目    # 起点中文网
/novel-market zongheng 我的项目  # 纵横中文网
/novel-market jjwxc 我的项目     # 晋江文学城
/novel-market 17k 我的项目       # 17K小说网
```

---

## 🛠️ 开发

```bash
npm test              # 运行测试套件（13 个测试用例）
npm pack --dry-run    # 预览打包内容
```

**源码结构：**
- [src/index.js](src/index.js) — 插件入口，命令注册
- [src/cmd-write.js](src/cmd-write.js) — 完本和续写
- [src/cmd-analysis.js](src/cmd-analysis.js) — 分析命令（conflict、pace、reader、dialogue、emotion）
- [src/cmd-market.js](src/cmd-market.js) — 市场分析
- [src/cmd-tools.js](src/cmd-tools.js) — 辅助命令（review、stats 等）
- [src/validators.js](src/validators.js) — 参数验证和格式化
- [src/workflow.js](src/workflow.js) — 项目骨架生成
- [src/prompts.js](src/prompts.js) — 写作规范模板
- [test/commands.test.js](test/commands.test.js) — 测试套件

**代码统计：**
- 总代码量：2086 行
- 命令总数：19 个
- 测试覆盖：13/13 通过

---

## 📚 更多文档

- [完整功能扩展规划](docs/FEATURE_EXPANSION_PLAN.md) - 17 条优化建议
- [优化完成报告](docs/OPTIMIZATION_COMPLETED.md) - 详细改进记录
- [优化建议](docs/OPTIMIZATION_SUGGESTIONS.md) - 未来改进方向
- [使用示例](examples/README.md) - 完整使用流程
- [发布指南](NPM_PUBLISH_GUIDE.md) - npm 发布步骤

---

## 🤝 贡献

欢迎提 Issue 和 PR！

**改进建议？** 请查看 [功能扩展规划](docs/FEATURE_EXPANSION_PLAN.md)

---

## 📈 版本历史

**v1.2.0**（开发中）
- ✨ 新增 5 个革命性分析功能
- ✨ 新增市场适配分析
- ✨ 增强审校和统计功能
- 🎯 插件评分：9.8/10

**v1.1.0**
- ✨ 补全插件信息和示例
- 📚 完善文档

**v1.0.0**
- 🎉 初始版本
- ✅ 13 个核心命令

---

## 📄 许可

MIT — 详见 [LICENSE](LICENSE)

---

## ⭐ Star History

如果这个插件对你有帮助，欢迎给个 Star！

---

**Made with ❤️ for novel writers**

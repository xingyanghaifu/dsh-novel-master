# dsh-novel-master · 小说创作大师

为 DeepSeek Harness（DSH）提供小说写作、分析和项目管理工具。当前包含 26 个创作命令及 1 个更新维护命令。

## 安装

在 DSH 的「设置 → 插件」中选择 GitHub 来源，填写：

```text
github:xingyanghaifu/dsh-novel-master
```

启用 bundle。此项目通过 GitHub 分发；不要在 npm 来源里仅填写包名。需要宿主提供 commands 服务和 @deepseek-ai/schemastery。goals 服务可选：有 goals 时可以持续执行写作目标，否则每轮写作后等待继续。

## 配置与更新

配置页提供创作总开关、每个命令的开关及项目目录。开关保存后按差异注册/移除命令，无需重启。关闭创作总开关仍保留更新维护入口；在插件管理器禁用整个 bundle 则卸载全部入口。

项目目录默认为 `novel_projects`，可改成 `books/novels` 等工作目录内的相对路径。新调用使用新目录，已有任务保留原路径；不会自动搬迁项目。每次命令拥有独立目录快照，并发会话不会串目录。绝对路径和 `..` 等不合法路径会被拒绝。

更新入口参考 Our Free Model 的检查/拉取流程：检查固定 GitHub 仓库的最新提交，拉取时交给 DSH 插件管理器安装该确定提交，而不是直接覆盖运行中的文件。不保存 GitHub 令牌，也不自动批准依赖安装脚本。

直连 GitHub 超时时，可在设置页填写「更新检查代理」，例如本地代理 `http://127.0.0.1:7897`。该地址只是示例，请使用自己实际的代理端口；留空使用 `HTTPS_PROXY` / `HTTP_PROXY` 或直连。安装下载沿用 DSH 插件管理器网络设置。代理设置可热更新，不修改整个 DSH 的全局网络配置。

```text
/novel-update check
/novel-update apply
/novel-update reload
```

更新结果区分安装成功、代码重载、需要重启和失败。安装成功后会尝试代码热重载；也可以点「重载插件」或执行 `reload`。兼容性适配层只在宿主提供已识别的 Loader/cache 能力时切换运行实例，失败时尝试恢复旧缓存与实例并报告恢复状态，不支持的宿主会明确要求重启。新增客户端页面首次加载仍可能需要重启；界面代码更新后可刷新当前页面。配置热更新与插件代码更新属于不同操作。

## 命令

参数中的 `[项目]` 可省略，默认使用当前目录下最近更新的项目。涉及文件导入的相对源文件路径仍以会话工作目录为基准。

| 命令 | 用途 |
|---|---|
| `/novel <脑洞> [60章\|20万字] [--auto]` | 建项目并提交规划、写作和收尾目标 |
| `/novel-continue [项目\|文件.txt] [N章] [--auto]` | 续写项目或导入 TXT/Markdown（支持 GBK） |
| `/novel-chapter [项目] <章号> [要求]` | 请求生成指定新章节，避免静默覆盖已有章 |
| `/novel-rewrite [项目] <章号> [要求]` | 请求改写，要求先保留旧稿 |
| `/novel-idea <脑洞>` | 请求展开多个构思方向 |
| `/novel-outline [项目] [要求]` | 请求生成或调整大纲 |
| `/novel-cast [项目] [要求]` | 请求生成角色档案 |
| `/novel-world [项目] [推演要求]` | 直接查看世界状态；有要求时提交世界推演任务 |
| `/novel-role [项目] [角色名\|要求]` | 查看角色，或提交修改任务 |
| `/novel-spark [项目] [卡点]` | 请求下一步剧情建议 |
| `/novel-study <参考文件> [--to 项目]` | 统计参考文本并请求风格分析 |
| `/novel-review [项目] [章号\|最近N章] [--deep]` | 请求基础或深度审校 |
| `/novel-conflict [项目] [章号\|N-M]` | 请求冲突分析 |
| `/novel-pace [项目]` | 请求节奏分析和文字图示 |
| `/novel-reader [项目] [章号\|N-M] [--persona 类型]` | 请求模拟读者反馈 |
| `/novel-dialogue [项目] <章号> [角色名]` | 请求对话检查与改写建议 |
| `/novel-emotion [项目] [章号\|N-M]` | 请求情感变化分析 |
| `/novel-market <平台> [项目]` | 根据平台经验请求适配建议 |
| `/novel-compare ...` | 请求对比两份作品或章节，具体参数见命令提示 |
| `/novel-tips ...` | 请求针对写作问题的技巧与示例 |
| `/novel-trope ...` | 请求套路设计、变体及风险分析 |
| `/novel-stats [项目] [--detailed]` | 直接计算字数、章数、进度、伏笔与详细统计 |
| `/novel-export [项目] [txt\|md\|html]` | 直接导出整书及目录 |
| `/novel-backup ...` | 创建快照、列出快照、恢复预览/执行及差异比较 |
| `/novel-merge ...` | 将选定章节合为新文件，保留源文件 |
| `/novel-split ...` | 将选定章节分成新文件，保留源文件 |
| `/novel-update check\|apply\|reload` | 检查、拉取固定提交更新及重载代码 |

```text
/novel-compare "参考作品.txt"
/novel-chapter 4-6 --length 2500 --style 轻松
/novel-chapter 1 --draft
/novel-backup create
/novel-backup list
/novel-backup restore <ID>
/novel-backup restore <ID> --apply
/novel-backup diff <ID>
/novel-merge 1-3,5
/novel-merge 主项目 子项目1 子项目2
/novel-split 1-3 --length 2500 --name 第一部
/novel-tips 开头
/novel-trope 身份揭秘
```

恢复默认只预览，明确指定 `--apply` 才执行；执行前保留恢复前快照，额外文件不会被删除。恢复按文件原子替换，并非整项目事务；I/O 失败时可使用恢复前快照处理。差异比较按文件哈希列出变化，不是逐行 diff。合并/拆分生成项目「整理」目录下的新文件，不自动统一角色设定或重排原正文；拆分按 Unicode 字符目标硬切，可能跨句。

## 实际行为与边界

写作、审校、冲突、节奏、虚拟读者、市场等命令会把任务和文件路径交给当前会话的模型。命令返回「已提交」表示任务排队成功，报告和正文需由模型后续生成；评分与读者反应属于模型判断，不是客观测量或真实读者测试。

市场分析使用经验性平台描述，未接入实时市场数据库。不得据此宣称真实读者规模、推荐概率或收益。技巧与套路工具提供模型生成的建议，不宣称内置了固定数量的资料库。

`--detailed` 直接读取正文，提供逐章字数、最短/最长章及成对引号内文字占比。此占比是明确规则下的文本统计，无法识别所有对话，更不是角色主动率、质量分或 AI 检测概率。

## 示例

```text
/novel 网管发现网吧电脑能修仙 30章
/novel-outline
/novel-chapter 1 开场直接出现异常
/novel-reader 1 --persona 挑剔读者
/novel-review 最近3章 --deep
/novel-stats --detailed
/novel-export html
```

## 文件与持久化

每本书一个项目目录，包含 `项目.json`、`写作规范.md`、`完本流程.md`、`设定.md`、`角色.md`、`大纲.md`、`世界状态.md`、`伏笔.md`、`剧情树.md` 和 `正文/`。进度以文件为准，可跨会话、压缩和重启保留。生成工作流要求模型持续同步这些文件。

## 开发

```sh
npm install
npm test
npm pack --dry-run
```

- [入口与配置](src/index.js)
- [项目路径](src/project.js)
- [扩展工具](src/cmd-extra.js)
- [更新服务](src/updater.js)
- [更新记录](CHANGELOG.md)

MIT，见 [LICENSE](LICENSE)。

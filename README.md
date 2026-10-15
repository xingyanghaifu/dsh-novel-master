# dsh-novel-master · 小说创作大师

[![npm version](https://img.shields.io/npm/v/dsh-novel-master.svg)](https://www.npmjs.com/package/dsh-novel-master)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

给 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（DSH）用的小说写作斜杠命令插件。在输入框里打 `/` 就能看到这些命令。主打的是 `/novel`：给一句脑洞，它借 DSH 的目标（goal）机制一轮一轮自动写，写满整本才停。

## 命令

DSH 规定命令名只能用小写英文、数字、`-`、`_`，所以命令名是英文，菜单里的说明是中文。

| 命令 | 作用 |
|---|---|
| `/novel <脑洞> [60章\|20万字] [--auto]` | 一键完本：建项目，规划设定、人设、大纲，自动连写到目标章数 |
| `/novel-continue [项目名\|小说.txt] [N章] [--auto] [要求]` | 续写：接着已有项目写；也可以导入 txt/md（自动按「第X章」拆章，支持 GBK） |
| `/novel-study <参考文件> [--to 项目名]` | 拆书：先算句长、对话占比，再用大白话写风格档案，可直接套用到项目 |
| `/novel-outline [项目名] [要求]` | 生成或调整分卷大纲，标出 [分岔点] 和 [高潮] |
| `/novel-cast [项目名] [要求]` | 人设：性格、说话习惯、口头禅、目标、关系 |
| `/novel-rewrite [项目名] <章号> [要求]` | 改写指定章节，旧稿留在 `正文/_旧稿/` |
| `/novel-review [项目名] [章号\|最近N章]` | 审校：错字、AI 味、OOC、设定矛盾、伏笔；小问题直接修 |
| `/novel-idea <一句话脑洞>` | 构思：给出 3 个不同的展开方向 |
| `/novel-spark [项目名] [卡在哪]` | 灵感：卡文时给几种接下来的走法 |
| `/novel-world [项目名] [推演要求]` | 查看世界状态和剧情树；带上要求就推演世界 |
| `/novel-role [项目名] [角色名\|要求]` | 查看或更新角色 |
| `/novel-stats [项目名]` | 字数、进度、缺章、偏短章节、伏笔回收情况 |
| `/novel-export [项目名] [txt\|md\|html]` | 合并全书导出，同时生成 `目录.md` |

不写项目名时，默认用最近改过的那个项目。

## 工作方式

- **全部状态都存在文件里。** 每本书是 `novel_projects/<书名>/` 一个目录：`项目.json`、`写作规范.md`、`完本流程.md`、`设定.md`、`角色.md`、`大纲.md`、`世界状态.md`、`伏笔.md`、`剧情树.md`、`正文/第N章_标题.md`。上下文压缩、重启 DSH、换新会话都不会丢进度，你也可以直接手改这些文件。
- **自动完本。** `/novel` 和 `/novel-continue` 会创建一个 DSH 目标，目标里写着“读 `完本流程.md` 并执行，直到写满第 N 章”。目标驱动器每轮把它重新交给模型，模型每轮写 1-3 章，写完全书后自己把目标标为完成。轮数上限是“剩余章数 + 10”。中途可以用 `/goal pause` 暂停、`/goal resume` 继续。同一个会话里已经有进行中的目标时，命令会拒绝启动。
- **剧情分岔。** 大纲里会标 3-8 个分岔点，写到分岔点时：
  - 默认模式（ask）：调用 `ask_user_question` 让你挑一条路；
  - `--auto` 模式：模型按人物性格和处境自己选。
  每次选择都记进 `剧情树.md`，没走的路也留着备用。
- **世界会自己运转。** 每写完一章，世界时钟往前走一步，不在场的势力和角色也按各自的目标推进一步幕后行动，记在 `世界状态.md`，后面会真的影响主线。
- **风格学习。** `写作规范.md` 自带一份去 AI 味的写作规则。`/novel-study --to` 会把风格档案里的「写法要点」和「仿写示范」追加到这份规则末尾，之后每章动笔前都会重读。

## 安装

需要 Node.js 20+ 和 DSH。插件没有任何第三方依赖。

### 方式 1：通过 DSH 插件管理器安装（推荐）

1. 打开 DSH，进入「设置」→「插件」
2. 点击「安装插件」
3. 输入包名：`dsh-novel-master`
4. 点击「安装」
5. 在插件列表里启用它，可以在设置面板里选择启用哪些命令

### 方式 2：用文件路径加载（开发调试）

1. 克隆或下载本仓库
2. 在 DSH profile 的 `cordis.patch.yml`（例如 `~/.dsh/profiles/desktop/cordis.patch.yml`）末尾追加：

   ```yaml
   - insert:
       - id: novel-master-commands
         name: '/absolute/path/to/dsh-novel-master/src/index.js'
         config:
           enabled: true
           commands:
             novel: true
             continue: true
             # ... 其他命令
   ```

3. 重启 DSH，或者等 profile 热重载

### 配套 Agent 预设

想用「📖 小说创作大师」预设（真人作者人设），把 [preset/novel-master.patch.yml](preset/novel-master.patch.yml) 的内容追加到 `cordis.patch.yml`。

## 配置

插件支持配置面板，可以在 DSH 的插件设置里调整：

- **启用插件**：总开关，关闭后所有命令都不会注册
- **命令开关**：13 个命令每个都有独立开关，可以只启用需要的
- **项目目录**：小说项目存放位置，默认 `novel_projects`

配置示例：

```yaml
config:
  enabled: true
  commands:
    novel: true
    continue: true
    study: true
    outline: false  # 不需要大纲命令就关掉
    export: true
  projectsDir: 'my_novels'
```

## 示例

```text
/novel 网管发现网吧的电脑能修仙 80章
/novel-study ./参考/某作者.txt --to 网管发现网吧的电脑能
/novel-continue ./旧作.txt 20章 --auto 后面节奏快一点
/novel-review 最近5章
/novel-export html
```

## 开发

```bash
npm test              # 运行测试套件
npm pack --dry-run    # 预览打包内容
```

源码结构：
- [`src/index.js`](src/index.js) — 插件入口，命令注册和配置 Schema
- [`src/cmd-write.js`](src/cmd-write.js) — 完本和续写命令
- [`src/cmd-study.js`](src/cmd-study.js) — 拆书命令
- [`src/cmd-tools.js`](src/cmd-tools.js) — 其余辅助命令
- [`src/workflow.js`](src/workflow.js) — 项目骨架和完本流程生成
- [`src/prompts.js`](src/prompts.js) — 写作规范和世界规则模板
- [`src/project.js`](src/project.js) — 文件读写和项目管理
- [`src/importer.js`](src/importer.js) — 小说导入和章节拆分

## 贡献

欢迎提 Issue 和 PR！

## 许可

MIT — 详见 [LICENSE](LICENSE)

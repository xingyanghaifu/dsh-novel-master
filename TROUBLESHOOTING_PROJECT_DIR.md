# 项目目录配置问题修复指南

## ❌ 问题描述

如果你在使用 `/novel` 等命令时遇到以下错误：

```
项目目录必须是工作目录内的相对路径，不能含 . 或 .. 路径段
```

这是因为在插件设置中配置了**不符合规范的项目目录路径**。

---

## 🔍 原因分析

`dsh-novel-master` 插件对「项目目录」（`projectsDir`）配置有严格的安全校验，以下任何一种写法都会被拒绝：

### ❌ 不允许的写法

| 类型 | 示例 | 说明 |
|------|------|------|
| **绝对路径** | `E:\dshwork\novel_projects`<br>`D:/books`<br>`/home/user/novels` | 任何绝对路径都不允许 |
| **含冒号 `:`** | `E:novels`<br>`D:books` | Windows 盘符标识 |
| **含 `.` 或 `..`** | `./novel_projects`<br>`../novel_projects`<br>`books/./novels` | 相对路径标识 |
| **路径段末尾有 `.` 或空格** | `novel_projects.`<br>`novel_projects ` | 易引起问题 |
| **Windows 非法字符** | `books<novels`<br>`books>novels`<br>`books\|novels` | `< > " \| ? *` 等 |

### ✅ 允许的写法

| 类型 | 示例 |
|------|------|
| **单级相对路径** | `novel_projects`（默认值）<br>`books`<br>`novels` |
| **多级相对路径** | `books/novels`<br>`writing/projects`<br>`work/fiction` |

---

## 🔧 修复步骤

### 方法1：通过设置界面修复（推荐）

1. **打开插件设置**
   - 在 DSH Web GUI 中点击右上角 ⚙️ 图标
   - 找到 **小说写作大师（dsh-novel-master）** 插件

2. **修改项目目录**
   - 找到「**项目目录**」配置项
   - 将其改为**简单的相对路径**，例如：
     - `novel_projects`（默认推荐）
     - `books/novels`
     - `writing`

3. **保存配置**
   - 点击「保存项目目录」按钮
   - 等待保存成功提示

4. **重试命令**
   ```bash
   /novel 测试小说
   ```

---

### 方法2：通过配置文件修复

如果设置界面无法访问，可以手动编辑配置文件：

1. **找到配置文件**
   
   配置文件可能在以下位置之一：
   - `%APPDATA%\deepseek-harness\config\cordis.yml`
   - 或你的自定义配置文件

2. **编辑配置**
   
   找到 `novel-master` 相关配置，修改 `projectsDir`：

   ```yaml
   plugins:
     - id: novel-master
       name: dsh-novel-master
       config:
         enabled: true
         projectsDir: novel_projects  # ✅ 改成简单相对路径
   ```

3. **重启 DSH**
   
   保存文件后重启 DeepSeek Harness。

---

## 📁 关于项目目录的说明

### 什么是项目目录？

项目目录是存放所有小说项目的根文件夹。每个小说会在此目录下创建独立子文件夹。

**示例结构**：
```
E:\dshwork\                          # 工作目录
└── novel_projects\                  # 项目目录
    ├── 我的第一本小说\
    │   ├── 项目.json
    │   ├── 写作规范.md
    │   └── 正文\
    │       ├── 第1章-开篇.md
    │       └── 第2章-转折.md
    └── 另一本小说\
        └── ...
```

### 为什么必须是相对路径？

1. **安全性** - 防止插件访问工作目录之外的文件
2. **可移植性** - 项目可以随工作目录一起移动
3. **隔离性** - 避免不同会话之间的路径冲突

### 修改目录后会怎样？

⚠️ **重要提醒**：

- **修改目录不会自动搬迁已有项目**
- 新命令会使用新目录
- 旧项目仍在旧目录下
- 如需迁移，请手动移动文件夹

---

## 🆚 项目目录 vs 资料存储目录

插件有两个独立的目录配置，不要混淆：

| 配置项 | 默认值 | 允许绝对路径 | 用途 |
|--------|--------|-------------|------|
| **项目目录**<br>`projectsDir` | `novel_projects` | ❌ 不允许 | 存放小说项目 |
| **资料存储目录**<br>`research.storageDir` | `novel_research` | ✅ 允许 | 存放检索资料 |

资料存储目录可以配置为绝对路径，例如：
```yaml
research:
  storageDir: E:\dshwork\research_data  # ✅ 资料目录允许绝对路径
```

---

## ✅ 验证修复

修复后，运行以下命令验证：

```bash
# 测试创建项目
/novel 测试项目

# 测试列出项目
/novel-stats
```

如果能正常执行，说明配置已修复成功！

---

## 📞 常见问题

### Q1: 我需要在 D 盘创建项目怎么办？

**A**: 修改 DSH 的工作目录到 D 盘，然后配置相对路径：

1. 启动 DSH 时指定工作目录为 `D:\novels`
2. 配置 `projectsDir: projects`
3. 项目会创建在 `D:\novels\projects\`

### Q2: 我已经在 E 盘有很多项目了

**A**: 两种方案：

**方案A**: 移动项目文件夹
```bash
# 将项目移动到工作目录内
move E:\my_novels E:\dshwork\novel_projects
```

**方案B**: 改变工作目录
1. 将 DSH 工作目录设置为 `E:\`
2. 配置 `projectsDir: my_novels`

### Q3: 为什么不能用 `./novel_projects`？

**A**: `./` 是显式的相对路径标识符，会被校验拒绝。直接写 `novel_projects` 即可，它本身就是相对路径。

---

## 🔧 开发者说明

如果你需要修改路径校验逻辑（不推荐），可以编辑：

```javascript
// dsh-novel-master/src/project.js
export function withProjectsDirectory(directory, operation) {
  // 校验逻辑在第 17-23 行
  const value = directory.trim().replace(/\\/gu, '/')
  if (path.posix.isAbsolute(value) || path.win32.isAbsolute(value)
    || value.includes(':') || value.includes('\0')
    || value.split('/').some((part) => part === '..' || part === '.'
      || /[.\s]$/u.test(part) || /[<>"|?*\u0000-\u001f]/u.test(part))) {
    throw new TypeError('项目目录必须是工作目录内的相对路径，不能含 . 或 .. 路径段')
  }
  // ...
}
```

---

## 📝 总结

- ✅ 使用简单相对路径：`novel_projects`、`books/novels`
- ❌ 不要使用绝对路径：`E:\dshwork\novels`
- ❌ 不要使用 `./`、`../` 等相对路径标识
- ⚠️ 修改目录不会自动迁移已有项目

**推荐配置**：保持默认值 `novel_projects`，简单可靠！

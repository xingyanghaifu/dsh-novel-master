# v2.1.0 路径验证防呆设计更新

## 🎯 主要改进

### 1. 智能路径验证 ✨

为「项目目录」配置项添加了实时验证和一键修复功能：

- ✅ **即时反馈**：输入时立即显示验证结果
- 🔧 **一键修复**：自动提取相对路径、清理非法字符
- 💡 **智能建议**：针对不同错误类型给出修复方案
- 🛡️ **双重校验**：前端 + 后端验证，确保数据安全

### 2. 常见错误自动修复

| 错误类型 | 示例 | 修复结果 |
|---------|------|---------|
| 绝对路径 | `E:\dshwork\novels` | `novels` |
| 点路径段 | `./novels` 或 `../books` | `novels` / `books` |
| 末尾空格 | `novels ` | `novels` |
| 非法字符 | `novels<test>` | 提示错误（需手动修改）|

### 3. 零学习成本

- 不需要查阅文档，界面上直接显示错误和修复方案
- 点击一个按钮即可修复大部分问题
- 对现有合法配置无影响

---

## 📦 新增文件

```
dsh-novel-master/
├── src/
│   └── path-helper.js           # 路径验证核心逻辑
├── client/
│   ├── index.ts                 # 客户端入口
│   └── components/
│       └── ProjectDirectoryInput.vue  # 智能输入组件
└── docs/
    └── 路径验证防呆设计.md      # 完整技术文档
```

---

## 🔧 修改文件

### `src/index.js`
- 新增 `validateProjectDirectory` 导入
- 新增 `installPathValidationAPI()` 函数，提供验证 API
- 为 `projectsDir` 配置添加自定义组件 meta

### `src/project.js`
- 引入 `validateProjectDirectory` 辅助函数
- 增强错误提示，提供修复建议

---

## 🚀 使用示例

### 场景：用户误填绝对路径

**之前**：
1. 填入 `E:\dshwork\novel_projects`
2. 保存成功（看似正常）
3. 运行 `/novel` 命令 → 报错 `项目目录不能使用绝对路径...`
4. 用户困惑：「什么是相对路径？」

**现在**：
1. 填入 `E:\dshwork\novel_projects`
2. **实时显示**：
   ```
   ✗ 不能使用绝对路径
   建议：novel_projects
   [一键修复]
   ```
3. 点击「一键修复」→ 自动变为 `novel_projects`
4. 保存成功 ✅

---

## ⚙️ API 端点

### POST `/api/novel/validate-project-directory`

**请求**：
```json
{
  "directory": "用户输入的路径",
  "cwd": "E:\\dshwork"
}
```

**响应**：
```json
{
  "valid": false,
  "error": "absolute",
  "message": "不能使用绝对路径",
  "suggestion": "novel_projects",
  "canAutoFix": true,
  "normalized": "novel_projects"
}
```

---

## 🧪 测试检查清单

- [ ] 正常相对路径：`novel_projects` → ✓ 有效
- [ ] 绝对路径：`E:\dshwork\novels` → 建议 `novels`
- [ ] 点路径段：`./books` → 建议 `books`
- [ ] 末尾空格：`novels ` → 建议 `novels`
- [ ] 非法字符：`test<>` → 提示错误
- [ ] 多级目录：`books/novels/fantasy` → ✓ 有效
- [ ] 空输入：`` → 提示不能为空

---

## 📝 迁移说明

### 对现有用户的影响

1. **已有合法配置**：无需任何操作，一切正常
2. **已有非法配置**：
   - 打开设置页会看到错误提示
   - 点击「一键修复」后保存即可
   - 命令行为保持一致（仍会报错，直到配置修复）

### 开发者扩展

如需添加自定义验证规则，编辑 `src/path-helper.js`：

```javascript
export function validateProjectDirectory(directory, cwd) {
  // ... 现有检查 ...
  
  // 新增自定义规则
  if (directory.length > 200) {
    return {
      valid: false,
      error: 'too-long',
      message: '路径过长（最多 200 字符）',
      canAutoFix: false
    }
  }
  
  // ...
}
```

---

## 🎨 技术亮点

### 1. 防呆设计哲学
不拒绝用户，而是引导用户 —— 提供修复建议而非简单报错。

### 2. 性能优化
- 输入防抖（500ms），减少服务器请求
- 验证逻辑轻量级，毫秒级响应

### 3. 双重保障
- 前端验证：即时反馈，提升体验
- 后端验证：防止绕过，确保安全

### 4. 扩展性
- 模块化设计，易于添加新验证规则
- 前后端分离，便于独立测试

---

## 🔗 相关文档

- [完整技术文档](./docs/路径验证防呆设计.md)
- [Vue 组件源码](./client/components/ProjectDirectoryInput.vue)
- [验证逻辑源码](./src/path-helper.js)

---

## 🙏 反馈

如遇到问题或有改进建议，请提交 Issue 或 PR！

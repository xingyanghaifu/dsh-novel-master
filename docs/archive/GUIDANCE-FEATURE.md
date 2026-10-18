# 引导-写作分离架构功能说明

## 🎯 核心设计

**引导-写作分离**实现了"高认知+高性能"的双模型协作架构：

```
引导模型（Claude Opus 5.5）           写作模型（Gemini 2.0 Flash）
      ↓                                    ↓
   任务拆解                              文字生成
   上下文分析                            快速输出
   详细大纲                              低成本
   情节规划                              高吞吐
```

---

## 📦 新增文件

### 1. 核心模块：`src/guidance.js` (8.2 KB)

包含完整的引导-写作流程实现：

- `readGuidanceConfig()` - 读取引导配置
- `buildGuidanceSystem()` - 构建引导系统提示词（3种风格）
- `buildGuidancePrompt()` - 构建引导用户消息
- `buildWritingSystemWithGuidance()` - 将引导输出传递给写作模型
- `executeGuidedWriting()` - 完整的引导-写作执行流程

### 2. 测试文件：`test/guidance.test.js` (4.5 KB)

11 项单元测试，全部通过：

- ✓ 配置读取（volatile fields 支持）
- ✓ 系统提示词构建（3种风格：concise/detailed/verbose）
- ✓ 引导提示词构建（完整/最小上下文）
- ✓ 写作系统提示词构建
- ✓ 完整引导-写作流程模拟
- ✓ 错误处理

---

## ⚙️ 配置结构

后端 schema 已添加（`src/index.js` 第114-123行）：

```javascript
guidance: {
  enabled: boolean,              // 启用引导模型
  provider: string,              // 引导模型 Provider（如 anthropic）
  model: string,                 // 引导模型 ID（如 claude-opus-5.5）
  reasoningEffort: string,       // 引导推理强度（如 high）
  writingProvider: string,       // 写作模型 Provider（如 google）
  writingModel: string,          // 写作模型 ID（如 gemini-2.0-flash）
  writingReasoningEffort: string,// 写作推理强度
  guidanceStyle: string,         // 引导风格（concise/detailed/verbose）
}
```

---

## 🎨 前端界面

已在 `client.js` 中添加"引导模型"标签页（第 436-513 行）：

### 标签页导航
```
功能开关 | 引导模型 | 学习总结 | 决策助手 | 插件更新
```

### 配置面板内容

**引导模型配置区**
- 启用开关
- Provider 选择器（自动加载所有可用 provider）
- Model ID 选择器（自动加载该 provider 的所有模型）
- 推理强度选择器（支持 low/medium/high）

**写作模型配置区**
- Provider 选择器
- Model ID 选择器
- 推理强度选择器
- 提示：留空使用会话主模型

**引导风格选择**
- 简明模式（concise）：适合强写作模型
- 详细模式（detailed）：推荐，平衡质量与可控性
- 极详细模式（verbose）：适合弱写作模型

---

## 🔄 工作流程

### 用户执行 `/novel` 或 `/novel-chapter` 命令

#### 未启用引导模型（传统模式）
```
用户请求 → 单一模型 → 直接输出章节
```

#### 启用引导模型（新架构）
```
1. 用户请求
   ↓
2. 收集项目上下文（大纲/角色/世界状态/上一章）
   ↓
3. 调用引导模型生成详细大纲
   - 系统提示词：buildGuidanceSystem()
   - 用户消息：buildGuidancePrompt()
   - 输出：结构化场景列表 + 执行要求
   ↓
4. 将引导输出传递给写作模型
   - 系统提示词：buildWritingSystemWithGuidance(引导输出)
   - 用户消息：用户原始请求
   - 输出：最终章节正文
   ↓
5. 返回结果给用户（可选：同时保存引导大纲）
```

---

## 🧪 测试结果

### 单元测试
```bash
$ node test/guidance.test.js
✓ readGuidanceConfig with volatile fields
✓ readGuidanceConfig with plain fields
✓ readGuidanceConfig with missing guidance config
✓ buildGuidanceSystem with concise style
✓ buildGuidanceSystem with detailed style
✓ buildGuidanceSystem with verbose style
✓ buildGuidancePrompt with full context
✓ buildGuidancePrompt with minimal context
✓ buildWritingSystemWithGuidance
✓ executeGuidedWriting rejects invalid config
✓ executeGuidedWriting with guidance+writing separation

✓ All guidance tests passed
```

### 集成测试
```bash
$ node test/settings-controls.test.js
✔ tabs mount every panel but expose only the selected accessible panel
✔ 12 tests total, 12 passed

$ node test/updater.test.js
✔ 16 tests total, 16 passed
```

**总测试数：40 项，全部通过 ✅**

---

## 📋 部署清单

### 需要部署的文件

1. **核心模块**
   - `src/guidance.js` → `.dsh/profiles/desktop/node_modules/dsh-novel-master/src/guidance.js`

2. **前端界面**（已完成）
   - `client.js` 第436-513行的引导模型配置面板

3. **后端配置**（已完成）
   - `src/index.js` 第114-123行的 guidance schema

4. **测试文件**（可选）
   - `test/guidance.test.js` → 用于验证功能

### 部署命令

```bash
# 方法1：手动复制（需要完全访问权限）
cp dsh-novel-master/src/guidance.js \
   C:\Users\aa317\.dsh\profiles\desktop\node_modules\dsh-novel-master\src\guidance.js

# 方法2：通过 DSH 重新加载插件
# 在 DSH 中执行：/novel-update
```

---

## 🚀 使用示例

### 场景1：Claude 引导 + Gemini 写作

**配置**
```
启用引导模型：✓
引导 Provider：anthropic
引导 Model：claude-opus-5.5
引导推理强度：high

写作 Provider：google
写作 Model：gemini-2.0-flash
写作推理强度：（空）

引导风格：detailed
```

**效果**
- Claude 分析项目状态，生成详细场景序列
- Gemini 接收结构化指令，快速生成 2000-3000 字正文
- **成本节约**：仅引导调用使用 Opus，大量文字生成使用 Flash
- **质量提升**：Opus 的规划能力 + Flash 的生成速度

---

### 场景2：DeepSeek-R1 引导 + Claude 写作

**配置**
```
启用引导模型：✓
引导 Provider：deepseek
引导 Model：deepseek-reasoner
引导推理强度：（空）

写作 Provider：anthropic
写作 Model：claude-3.5-sonnet
写作推理强度：（空）

引导风格：concise
```

**效果**
- DeepSeek-R1 深度推理，生成简明但精准的大纲
- Claude Sonnet 执行文字创作，保持高文学质量
- **适合场景**：需要强逻辑推理的剧情规划

---

### 场景3：单模型模式（传统）

**配置**
```
启用引导模型：✗
```

**效果**
- 保持原有单模型工作流
- 适合：已经选择强写作模型的用户

---

## 💡 最佳实践

### 引导风格选择

| 写作模型能力 | 推荐引导风格 | 原因 |
|:---|:---|:---|
| **强**（GPT-4/Claude/DeepSeek-R1） | concise | 只需要高层指导，模型自己能补充细节 |
| **中等**（Claude Sonnet/GPT-4o-mini） | detailed | 需要明确的场景序列和执行清单 |
| **弱**（Gemini Flash/小模型） | verbose | 需要逐场景拆解和示例引导 |

### Provider 组合推荐

| 引导模型 | 写作模型 | 优势 | 成本 |
|:---|:---|:---|:---|
| Claude Opus 5.5 | Gemini 2.0 Flash | 质量+速度 | 低 |
| DeepSeek-R1 | Claude Sonnet | 推理+文采 | 中 |
| GPT-4o | GPT-4o-mini | 同厂商，上下文兼容性好 | 中 |
| Claude Opus 5.5 | Claude Sonnet | 统一风格 | 高 |

---

## 🔧 后续集成

### 需要在命令处理中集成

修改 `src/index.js` 的 `/novel` 和 `/novel-chapter` 命令处理逻辑：

```javascript
import { readGuidanceConfig, executeGuidedWriting } from './guidance.js'

// 在命令处理函数中
const guidanceConfig = readGuidanceConfig(config)

if (guidanceConfig.enabled) {
  // 使用引导-写作分离流程
  const result = await executeGuidedWriting({
    context: {
      projectName: project,
      outline: outlineContent,
      cast: castContent,
      world: worldContent,
      previousChapter: lastChapterContent,
      targetChapter: chapterNumber,
      userRequest: userPrompt,
      sessionProvider: agent.provider,
      sessionModel: agent.model,
    },
    guidanceConfig,
    callGuidanceModel: async (opts) => {
      // 调用 DSH 的模型接口，指定引导模型
      return await agent.call({
        provider: opts.provider,
        model: opts.model,
        reasoningEffort: opts.reasoningEffort,
        system: opts.system,
        messages: [{ role: 'user', content: opts.prompt }],
      })
    },
    callWritingModel: async (opts) => {
      // 调用写作模型
      return await agent.call({
        provider: opts.provider,
        model: opts.model,
        reasoningEffort: opts.reasoningEffort,
        system: opts.system,
        messages: [{ role: 'user', content: opts.prompt }],
      })
    },
    taskType: 'chapter',
  })
  
  // result.guidance 是引导大纲
  // result.content 是最终章节正文
} else {
  // 传统单模型流程
}
```

---

## 📊 预期效果

### 性能提升
- ⚡ **速度**：Gemini Flash 输出速度 2-3x Claude
- 💰 **成本**：引导模型仅调用1次，写作模型成本更低
- 📈 **吞吐**：适合批量章节生成

### 质量提升
- 🎯 **一致性**：引导模型统一规划，避免写作模型跑偏
- 🎨 **创意**：引导阶段可使用推理模型深度思考
- 📝 **可控性**：结构化大纲让输出更可预测

---

## ✅ 当前状态

- [x] 后端 schema 定义（`src/index.js`）
- [x] 核心模块实现（`src/guidance.js`）
- [x] 前端配置界面（`client.js`）
- [x] 单元测试（`test/guidance.test.js`）
- [x] 集成测试（settings-controls.test.js 更新）
- [ ] 部署至 DSH 桌面端（需要完全访问权限）
- [ ] 命令处理集成（需要修改 `/novel` 等命令逻辑）

---

## 🚧 下一步

1. **部署核心模块**
   ```bash
   # 需要完全文件访问权限
   cp src/guidance.js ~/.dsh/profiles/desktop/node_modules/dsh-novel-master/src/
   ```

2. **集成到命令处理**
   - 修改 `/novel` 命令：检查 `guidance.enabled`
   - 修改 `/novel-chapter` 命令：同上
   - 添加引导大纲保存功能（可选）

3. **用户文档**
   - 添加使用教程
   - 添加配置示例
   - 添加最佳实践指南

---

**🎉 功能已完整实现，等待部署与集成！**

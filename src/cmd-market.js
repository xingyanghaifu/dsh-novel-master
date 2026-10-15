/**
 * Market analysis and platform adaptation commands.
 * Helps authors optimize their novels for different publishing platforms.
 */
import { agentCwd, fail, ok, projectExists, queueTask, resolveProject } from './context.js'
import { listChapters, readProjectFile } from './project.js'
import { formatError, formatSuccess } from './validators.js'

/** Resolve the target project or return an error result. */
function target(invocation) {
  const cwd = agentCwd(invocation)
  const { project, note } = resolveProject(cwd, invocation.rawInput)
  if (!projectExists(cwd, project)) return { error: fail(formatError('还没有小说项目')) }
  return { cwd, project, note, dir: `novel_projects/${project}` }
}

/**
 * /novel-market - 市场适配分析
 * 根据不同网文平台特点优化内容
 */
export function marketCommand() {
  return {
    name: 'novel-market',
    description: '市场分析：根据起点、纵横、晋江等平台特点优化内容',
    input: { hint: '<平台名> [项目名]' },
    handler: (invocation) => {
      // 解析平台和项目名
      const rawInput = invocation.rawInput.trim()
      const parts = rawInput.split(/\s+/)
      
      if (parts.length === 0) {
        return fail(formatError(
          '请指定平台名称',
          [
            '/novel-market qidian 我的项目',
            '/novel-market zongheng 我的项目',
            '/novel-market jjwxc 我的项目'
          ]
        ))
      }

      const platformInput = parts[0].toLowerCase()
      const projectInput = parts.slice(1).join(' ')

      // 平台映射
      const platformMap = {
        'qidian': '起点中文网',
        'qd': '起点中文网',
        '起点': '起点中文网',
        'zongheng': '纵横中文网',
        'zh': '纵横中文网',
        '纵横': '纵横中文网',
        'jjwxc': '晋江文学城',
        'jj': '晋江文学城',
        '晋江': '晋江文学城',
        '17k': '17K小说网',
        'chuangshi': '创世中文网',
        '创世': '创世中文网'
      }

      const platform = platformMap[platformInput]
      
      if (!platform) {
        return fail(formatError(
          '不支持的平台',
          [
            '支持的平台：',
            '  qidian / 起点  - 起点中文网',
            '  zongheng / 纵横 - 纵横中文网',
            '  jjwxc / 晋江   - 晋江文学城',
            '  17k           - 17K小说网'
          ]
        ))
      }

      // 解析项目
      const cwd = agentCwd(invocation)
      const { project } = resolveProject(cwd, projectInput)
      
      if (!projectExists(cwd, project)) {
        return fail(formatError('还没有小说项目'))
      }

      const dir = `novel_projects/${project}`
      const chapters = listChapters(cwd, project)
      
      if (chapters.length === 0) {
        return fail(formatError('这本书还没有正文'))
      }

      const prompt = `【市场适配分析】平台：${platform}
项目：${dir}

## 任务

分析《${project}》在 ${platform} 的适配情况，给出具体优化建议。

## 1. 读取文件

- 读 ${dir}/脑洞.md - 了解创意
- 读 ${dir}/设定.md - 了解世界观
- 读 ${dir}/角色.md - 了解人物设定
- 读 ${dir}/大纲.md - 了解情节结构
- 读 ${dir}/正文/ 前 5 章 - 了解开头和风格

## 2. 平台特征数据库

### 起点中文网特征
**读者画像：**
- 主要：男性 18-35 岁
- 偏好：玄幻、都市、科幻、游戏
- 付费意愿：高（起点订阅制）

**内容特点：**
- 爽文节奏快，打脸频繁
- 金手指/系统流欢迎
- 章节长度：3500-4500 字
- 更新频率：日更 2 章以上
- 前 3 章要抓人
- 女主不宜太早出现（男频）

**爆款要素：**
- 新颖设定 + 熟悉套路
- 主角快速变强
- 装逼打脸
- 土豪角色（月票、打赏）
- 多条感情线

**标签热度：**
- 热门：系统流、重生、穿越、无敌
- 中等：都市修真、异能、游戏异界
- 冷门：慢热、文艺、沉重

---

### 纵横中文网特征
**读者画像：**
- 主要：男性 20-40 岁
- 偏好：历史、军事、都市、玄幻
- 付费意愿：中高

**内容特点：**
- 偏重剧情和逻辑
- 历史军事类优势明显
- 章节长度：3000-4000 字
- 可以慢热，但要有深度
- 战争、权谋类受欢迎

**爆款要素：**
- 历史架空题材
- 军事战争
- 智斗权谋
- 真实感强
- 人物有深度

---

### 晋江文学城特征
**读者画像：**
- 主要：女性 16-35 岁
- 偏好：言情、耽美、古言、现言
- 付费意愿：高

**内容特点：**
- 重视感情线
- 人物刻画细腻
- 章节长度：2500-3500 字
- 可以慢热铺垫
- 文笔要求较高

**爆款要素：**
- CP 感强
- 人设鲜明
- 感情线曲折
- 甜宠/虐文明确
- 金手指可以有但不能太夸张

---

### 17K 小说网特征
**读者画像：**
- 主要：男性 18-30 岁
- 偏好：玄幻、都市、历史
- 付费意愿：中等

**内容特点：**
- 相对包容
- 新人友好
- 章节长度：2500-3500 字
- 更新压力较小

**爆款要素：**
- 稳定更新
- 有特色即可
- 套路不要太老

## 3. 适配分析输出

\`\`\`
📱 《${project}》× ${platform} 适配分析

━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 基础匹配度：XX/100

【题材匹配】⭐⭐⭐⭐☆ (4/5)
  你的题材：[从设定.md 提取]
  平台优势题材：[对应平台的强项]
  → 评价：[是否匹配]

【读者画像匹配】⭐⭐⭐☆☆ (3/5)
  你的目标读者：[推断]
  平台主流读者：[平台数据]
  → 评价：[匹配程度]

━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ 符合平台特点：

  1. [具体优点]
     → 说明：[为什么符合]
  
  2. [具体优点]
     → 说明：[为什么符合]
  
  3. [具体优点]
     → 说明：[为什么符合]

━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️  需要优化的地方：

  1. 章节长度不符
     现状：平均 ${chapters.length > 0 ? 'XXXX' : '0'} 字/章
     建议：[平台要求] 字/章
     → 如何调整：[具体方法]
  
  2. [其他问题]
     现状：[...]
     建议：[...]
     → 如何调整：[具体方法]
  
  3. [其他问题]
     现状：[...]
     建议：[...]
     → 如何调整：[具体方法]

━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎯 ${platform} 爆款要素检查：

  ✅ [已具备的要素]
  ✅ [已具备的要素]
  ⚠️  [部分具备的要素]
  ❌ [缺失的要素]
  ❌ [缺失的要素]

━━━━━━━━━━━━━━━━━━━━━━━━━━━

📈 优化方案：

【立即可改】
  1. [具体操作]
     预期效果：[...]
  
  2. [具体操作]
     预期效果：[...]

【长期规划】
  1. [方向性建议]
     实施难度：⭐⭐⭐
     预期收益：⭐⭐⭐⭐
  
  2. [方向性建议]
     实施难度：⭐⭐
     预期收益：⭐⭐⭐⭐⭐

━━━━━━━━━━━━━━━━━━━━━━━━━━━

💡 平台策略建议：

【标签选择】
  推荐标签：[标签1]、[标签2]、[标签3]
  避免标签：[不适合的标签]

【简介写法】
  [给出适合该平台的简介建议]

【更新节奏】
  建议：[每日/每周更新量]
  理由：[...]

【定价策略】（如适用）
  建议：[定价建议]
  理由：[...]

━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 预估数据：

  潜在读者规模：⭐⭐⭐⭐☆
  竞争激烈程度：⭐⭐⭐☆☆
  推荐位机会：⭐⭐⭐☆☆
  
  综合评估：[适合/较适合/需优化后再投/不太适合]

━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎯 总结建议：

[3-5 句话总结，包括：
1. 这本书最适合哪个平台
2. 当前平台的主要问题
3. 优先要改的 3 件事]

💡 如果想分析其他平台，使用：
  /novel-market <平台名> ${project}
\`\`\`

## 4. 分析要求

1. **数据真实**：基于实际文本内容分析，不编造
2. **建议具体**：给出可执行的优化方案，不只是泛泛而谈
3. **客观评价**：优缺点都要说，不一味吹捧
4. **多维度**：从题材、节奏、长度、风格等多方面分析

开始分析吧！`

      return queueTask(
        invocation,
        prompt,
        formatSuccess(`开始分析《${project}》在 ${platform} 的适配情况`, {
          '📱 目标平台': platform,
          '📖 分析项目': project,
          '📊 分析维度': '题材/读者/爆款要素/优化方案'
        })
      )
    }
  }
}

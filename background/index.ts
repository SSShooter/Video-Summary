// Background script to handle AI API requests and avoid CORS issues

import { Storage } from "@plasmohq/storage"

interface AIConfig {
  enabled: boolean
  provider: string
  apiKeys: {
    openai?: string
    gemini?: string
    claude?: string
    "openai-compatible"?: string
  }
  model: string
  baseUrl?: string
  baseUrls?: {
    openai?: string
    gemini?: string
    claude?: string
    "openai-compatible"?: string
  }
  customModel?: string
}

interface SubtitleSummary {
  summary: string
  keyPoints: string[]
  topics: string[]
}

class BackgroundAIService {
  private storage = new Storage()

  // 统一的系统提示词
  private readonly SYSTEM_PROMPT = `你是一个专业的视频内容分析师和知识提取专家。请仔细分析用户提供的视频字幕内容，并按照以下要求生成结构化的分析结果：

**分析要求：**
1. **总结(summary)**：生成150-300字的精炼总结，概括视频的核心内容和主要观点
2. **关键要点(keyPoints)**：提取3-8个最重要的知识点或观点，每个要点简洁明了
3. **主要话题(topics)**：识别2-6个核心话题标签，便于分类和检索

**输出格式：**
请严格按照JSON格式输出，确保格式正确：
{
  "summary": "视频内容的精炼总结",
  "keyPoints": ["关键要点1", "关键要点2", "关键要点3"],
  "topics": ["话题标签1", "话题标签2", "话题标签3"]
}

**注意事项：**
- 使用中文输出
- 保持客观和准确
- 避免重复内容
- 确保JSON格式正确`

  private readonly USER_PROMPT_TEMPLATE = (subtitles: string) =>
    `请分析以下视频字幕内容：

**字幕内容：**
${subtitles}

请按照系统要求生成结构化的分析结果。`

  private readonly MINDMAP_PROMPT = `
\`\`\`ts
export interface NodeObj {
  topic: string
  id: string
  tags: string[]
  children?: NodeObj[]
}
// 总结父id的第start到end个节点的内容
export interface Summary {
  id: string
  label: string
  /**
   * parent node id of the summary
   */
  parent: string
  /**
   * start index of the summary
   */
  start: number
  /**
   * end index of the summary
   */
  end: number
}

export interface Arrow {
  id: string
  /**
   * label of arrow
   */
  label: string
  /**
   * id of start node
   */
  from: string
  /**
   * id of end node
   */
  to: string
  /**
   * offset of control point from start point
   */
  delta1: {
    x: number
    y: number
  }
  /**
   * offset of control point from end point
   */
  delta2: {
    x: number
    y: number
  }
  /**
   * whether the arrow is bidirectional
   */
  bidirectional?: boolean
}
\`\`\`

使用符合  {
  nodeData: NodeObj
  arrows?: Arrow[]
  summaries?: Summary[]
} 格式的 JSON 回复用户，这是一个表达**思维导图数据**的递归结构。

**注意！！nodeData、arrows、summaries 三者的同一层级！！**

**提醒**：
- 节点 ID 使用递增数字即可
- 注意不要一昧使用兄弟节点关系，适当应用父子级别的分层
- 只能向根节点插入 tags，tag 必须是普适的，不是独特的，用于用户快速找到同类内容
- Summary 是总结多个同父节点的子节点的工具，会使用花括号把总结文本显示在指定子节点侧边，因为节点存在两侧分布的情况，禁止总结根节点
- Arrow 可以添加连接任意节点的箭头，label 间接说明两个节点的联系，delta 的默认值为 50,50。**直接的父子关系不需要链接**
- 适当添加 Summary 和 Arrow
- **直接的父子关系不需要使用 Arrow 链接**

**注意事项：**
- 使用中文输出
- 确保JSON格式正确，不要返回任何JSON以外的内容
`

  async getConfig(): Promise<AIConfig | null> {
    try {
      const config = await this.storage.get<AIConfig>("aiConfig")
      return config || null
    } catch (error) {
      console.error("获取AI配置失败:", error)
      return null
    }
  }

  async summarizeSubtitles(subtitles: string): Promise<SubtitleSummary> {
    const config = await this.getConfig()
    const apiKey = config?.apiKeys?.[config.provider as keyof typeof config.apiKeys]
    if (!config || !config.enabled || !apiKey) {
      throw new Error("AI功能未配置或未启用")
    }

    const model = config.customModel || config.model

    switch (config.provider) {
      case "openai":
      case "openai-compatible":
        return this.callOpenAI(config, subtitles, model, apiKey)
      case "gemini":
        return this.callGemini(config, subtitles, model, apiKey)
      case "claude":
        return this.callClaude(config, subtitles, model, apiKey)
      default:
        throw new Error(`不支持的AI服务商: ${config.provider}`)
    }
  }

  async generateMindmap(subtitles: string): Promise<any> {
    const config = await this.getConfig()
    const apiKey = config?.apiKeys?.[config.provider as keyof typeof config.apiKeys]
    if (!config || !config.enabled || !apiKey) {
      throw new Error("AI功能未配置或未启用")
    }

    const model = config.customModel || config.model

    switch (config.provider) {
      case "openai":
      case "openai-compatible":
        return this.callOpenAIForMindmap(config, subtitles, model, apiKey)
      case "gemini":
        return this.callGeminiForMindmap(config, subtitles, model, apiKey)
      case "claude":
        return this.callClaudeForMindmap(config, subtitles, model, apiKey)
      default:
        throw new Error(`不支持的AI服务商: ${config.provider}`)
    }
  }

  async generateArticleMindmap(content: string, title: string): Promise<any> {
    const config = await this.getConfig()
    const apiKey = config?.apiKeys?.[config.provider as keyof typeof config.apiKeys]
    if (!config || !config.enabled || !apiKey) {
      throw new Error("AI功能未配置或未启用")
    }

    const model = config.customModel || config.model

    switch (config.provider) {
      case "openai":
      case "openai-compatible":
        return this.callOpenAIForArticleMindmap(config, content, title, model, apiKey)
      case "gemini":
        return this.callGeminiForArticleMindmap(config, content, title, model, apiKey)
      case "claude":
        return this.callClaudeForArticleMindmap(config, content, title, model, apiKey)
      default:
        throw new Error(`不支持的AI服务商: ${config.provider}`)
    }
  }

  private async callOpenAI(config: AIConfig, subtitles: string, model: string, apiKey: string): Promise<SubtitleSummary> {
    const baseUrl = config.baseUrl || "https://api.openai.com/v1"
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: "system",
            content: this.SYSTEM_PROMPT
          },
          {
            role: "user",
            content: this.USER_PROMPT_TEMPLATE(subtitles)
          }
        ],
        temperature: 0.3
      })
    })

    if (!response.ok) {
      throw new Error(`OpenAI API请求失败: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    const content = data.choices[0]?.message?.content

    try {
      return this.parseJSONResponse(content)
    } catch {
      return this.parseTextResponse(content)
    }
  }

  private async callGemini(config: AIConfig, subtitles: string, model: string, apiKey: string): Promise<SubtitleSummary> {
    const baseUrl = config.baseUrl || "https://generativelanguage.googleapis.com/v1beta"
    // Gemini API 需要完整的模型路径
    const fullModelName = model.startsWith('models/') ? model : `models/${model}`
    const response = await fetch(`${baseUrl}/${fullModelName}:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `${this.SYSTEM_PROMPT}\n\n${this.USER_PROMPT_TEMPLATE(subtitles)}`
          }]
        }],
        generationConfig: {
          temperature: 0.3
        }
      })
    })

    if (!response.ok) {
      throw new Error(`Gemini API请求失败: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    const content = data.candidates[0]?.content?.parts[0]?.text

    try {
      return this.parseJSONResponse(content)
    } catch {
      return this.parseTextResponse(content)
    }
  }

  private async callClaude(config: AIConfig, subtitles: string, model: string, apiKey: string): Promise<SubtitleSummary> {
    const baseUrl = config.baseUrl || "https://api.anthropic.com/v1"
    const response = await fetch(`${baseUrl}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: model,
        system: this.SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: this.USER_PROMPT_TEMPLATE(subtitles)
          }
        ]
      })
    })

    if (!response.ok) {
      throw new Error(`Claude API请求失败: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    const content = data.content[0]?.text

    try {
      return this.parseJSONResponse(content)
    } catch {
      return this.parseTextResponse(content)
    }
  }





  // 思维导图生成方法
  private async callOpenAIForMindmap(config: AIConfig, subtitles: string, model: string, apiKey: string): Promise<any> {
    const baseUrl = config.baseUrl || "https://api.openai.com/v1"
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: "system",
            content: this.MINDMAP_PROMPT
          },
          {
            role: "user",
            content: `请根据以下视频字幕内容生成思维导图：\n\n${subtitles}`
          }
        ],
        temperature: 0.3
      })
    })

    if (!response.ok) {
      throw new Error(`OpenAI API请求失败: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    const content = data.choices[0]?.message?.content

    return this.parseMindmapResponse(content)
  }

  private async callGeminiForMindmap(config: AIConfig, subtitles: string, model: string, apiKey: string): Promise<any> {
    const baseUrl = config.baseUrl || "https://generativelanguage.googleapis.com/v1beta"
    const fullModelName = model.startsWith('models/') ? model : `models/${model}`
    const response = await fetch(`${baseUrl}/${fullModelName}:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `${this.MINDMAP_PROMPT}\n\n请根据以下视频字幕内容生成思维导图：\n\n${subtitles}`
          }]
        }],
        generationConfig: {
          temperature: 0.3,
          responseMimeType: "application/json",
        }
      })
    })

    if (!response.ok) {
      throw new Error(`Gemini API请求失败: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    const content = data.candidates[0]?.content?.parts[0]?.text

    return this.parseMindmapResponse(content)
  }

  private async callClaudeForMindmap(config: AIConfig, subtitles: string, model: string, apiKey: string): Promise<any> {
    const baseUrl = config.baseUrl || "https://api.anthropic.com/v1"
    const response = await fetch(`${baseUrl}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: model,
        system: this.MINDMAP_PROMPT,
        messages: [
          {
            role: "user",
            content: `请根据以下视频字幕内容生成思维导图：\n\n${subtitles}`
          }
        ]
      })
    })

    if (!response.ok) {
      throw new Error(`Claude API请求失败: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    const content = data.content[0]?.text

    return this.parseMindmapResponse(content)
  }





  // 文章思维导图API调用方法
  private async callOpenAIForArticleMindmap(config: AIConfig, content: string, title: string, model: string, apiKey: string): Promise<any> {
    const baseUrl = config.baseUrl || "https://api.openai.com/v1"
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: "system",
            content: this.MINDMAP_PROMPT
          },
          {
            role: "user",
            content: `请根据以下文章内容生成思维导图：\n\n标题：${title}\n\n内容：\n${content}`
          }
        ],
        temperature: 0.3
      })
    })

    if (!response.ok) {
      throw new Error(`OpenAI API请求失败: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    const responseContent = data.choices[0]?.message?.content

    return this.parseMindmapResponse(responseContent)
  }

  private async callGeminiForArticleMindmap(config: AIConfig, content: string, title: string, model: string, apiKey: string): Promise<any> {
    const baseUrl = config.baseUrl || "https://generativelanguage.googleapis.com/v1beta"
    const fullModelName = model.startsWith('models/') ? model : `models/${model}`
    const response = await fetch(`${baseUrl}/${fullModelName}:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `${this.MINDMAP_PROMPT}\n\n请根据以下文章内容生成思维导图：\n\n标题：${title}\n\n内容：\n${content}`
          }]
        }],
        generationConfig: {
          temperature: 0.3,
          responseMimeType: "application/json",
        }
      })
    })

    if (!response.ok) {
      throw new Error(`Gemini API请求失败: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    const responseContent = data.candidates[0]?.content?.parts[0]?.text

    return this.parseMindmapResponse(responseContent)
  }

  private async callClaudeForArticleMindmap(config: AIConfig, content: string, title: string, model: string, apiKey: string): Promise<any> {
    const baseUrl = config.baseUrl || "https://api.anthropic.com/v1"
    const response = await fetch(`${baseUrl}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: model,
        system: this.MINDMAP_PROMPT,
        messages: [
          {
            role: "user",
            content: `请根据以下文章内容生成思维导图：\n\n标题：${title}\n\n内容：\n${content}`
          }
        ]
      })
    })

    if (!response.ok) {
      throw new Error(`Claude API请求失败: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    const responseContent = data.content[0]?.text

    return this.parseMindmapResponse(responseContent)
  }



  /**
   * 解析思维导图响应
   */
  private parseMindmapResponse(content: string): any {
    if (!content) {
      throw new Error('AI响应内容为空')
    }

    // 尝试直接解析
    try {
      const parsed = JSON.parse(content)
      console.log(parsed, 'parsed')
      if (this.isValidMindmapData(parsed)) {
        return parsed
      }
    } catch {
      // 继续尝试其他方法
    }

    // 尝试提取JSON代码块
    const jsonBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (jsonBlockMatch) {
      try {
        const parsed = JSON.parse(jsonBlockMatch[1].trim())
        if (this.isValidMindmapData(parsed)) {
          return parsed
        }
      } catch {
        // 继续尝试其他方法
      }
    }

    // 尝试提取花括号内的JSON
    const jsonMatch = content.match(/{[\s\S]*}/)
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0])
        if (this.isValidMindmapData(parsed)) {
          return parsed
        }
      } catch {
        // 继续尝试其他方法
      }
    }

    // 如果所有JSON解析都失败，抛出错误
    throw new Error('无法解析AI响应为有效的思维导图JSON格式')
  }

  /**
   * 验证思维导图数据格式
   */
  private isValidMindmapData(obj: any): boolean {
    return obj &&
      typeof obj === 'object' &&
      obj.nodeData &&
      typeof obj.nodeData === 'object' &&
      typeof obj.nodeData.topic === 'string' &&
      typeof obj.nodeData.id === 'string'
  }

  /**
   * 解析JSON响应，支持多种格式的JSON提取
   */
  private parseJSONResponse(content: string): SubtitleSummary {
    if (!content) {
      throw new Error('AI响应内容为空')
    }

    // 尝试直接解析
    try {
      const parsed = JSON.parse(content)
      if (this.isValidSubtitleSummary(parsed)) {
        return parsed
      }
    } catch {
      // 继续尝试其他方法
    }

    // 尝试提取JSON代码块
    const jsonBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (jsonBlockMatch) {
      try {
        const parsed = JSON.parse(jsonBlockMatch[1].trim())
        if (this.isValidSubtitleSummary(parsed)) {
          return parsed
        }
      } catch {
        // 继续尝试其他方法
      }
    }

    // 尝试提取花括号内的JSON
    const jsonMatch = content.match(/{[\s\S]*}/)
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0])
        if (this.isValidSubtitleSummary(parsed)) {
          return parsed
        }
      } catch {
        // 继续尝试其他方法
      }
    }

    // 如果所有JSON解析都失败，抛出错误
    throw new Error('无法解析AI响应为有效的JSON格式')
  }

  /**
   * 验证解析结果是否符合SubtitleSummary接口
   */
  private isValidSubtitleSummary(obj: any): obj is SubtitleSummary {
    return obj &&
      typeof obj === 'object' &&
      typeof obj.summary === 'string' &&
      Array.isArray(obj.keyPoints) &&
      Array.isArray(obj.topics) &&
      obj.keyPoints.every((item: any) => typeof item === 'string') &&
      obj.topics.every((item: any) => typeof item === 'string')
  }

  /**
   * 当JSON解析失败时的备用文本解析方法
   */
  private parseTextResponse(content: string): SubtitleSummary {
    console.warn('JSON解析失败，使用文本解析备用方案')

    const lines = content.split('\n').filter(line => line.trim())

    // 尝试从文本中提取结构化信息
    let summary = ''
    let keyPoints: string[] = []
    let topics: string[] = []

    // 查找总结部分
    const summaryMatch = content.match(/(?:总结|summary)[：:](.*?)(?=\n|$)/i)
    if (summaryMatch) {
      summary = summaryMatch[1].trim()
    } else {
      summary = content.substring(0, 200) + (content.length > 200 ? '...' : '')
    }

    // 查找关键要点
    const keyPointsSection = content.match(/(?:关键要点|要点|keypoints?)[：:]([\s\S]*?)(?=(?:话题|topics?)[：:]|$)/i)
    if (keyPointsSection) {
      keyPoints = keyPointsSection[1]
        .split('\n')
        .map(line => line.replace(/^[\d\-\*\s]+/, '').trim())
        .filter(line => line.length > 0)
        .slice(0, 6)
    } else {
      keyPoints = lines
        .slice(0, 4)
        .map(line => line.replace(/^[\d\-\*\s]+/, '').trim())
        .filter(line => line.length > 0)
    }

    // 查找话题标签
    const topicsSection = content.match(/(?:话题|topics?)[：:]([\s\S]*?)$/i)
    if (topicsSection) {
      topics = topicsSection[1]
        .split(/[,，\n]/)
        .map(topic => topic.replace(/^[\d\-\*\s]+/, '').trim())
        .filter(topic => topic.length > 0)
        .slice(0, 5)
    } else {
      topics = ['视频内容分析', '知识提取']
    }

    return {
      summary: summary || '视频内容总结',
      keyPoints: keyPoints.length > 0 ? keyPoints : ['内容要点提取'],
      topics: topics.length > 0 ? topics : ['视频分析']
    }
  }

  /**
   * 格式化字幕数据供AI分析使用
   * @param subtitles 字幕数组
   * @returns 格式化后的字幕文本
   */
  formatSubtitlesForAI(subtitles: any[]): string {
    if (!Array.isArray(subtitles) || subtitles.length === 0) {
      throw new Error('字幕数据为空或格式不正确')
    }

    const formattedText = subtitles
      .map(subtitle => {
        // 支持多种字幕格式
        const text = subtitle.text || subtitle.content || subtitle.transcript || ''
        return text.trim()
      })
      .filter(text => text.length > 0)
      // 去除重复的相邻文本
      .filter((text, index, array) => {
        if (index === 0) return true
        return text !== array[index - 1]
      })
      // 合并短句，避免过度分割
      .reduce((acc: string[], current: string) => {
        if (acc.length === 0) {
          acc.push(current)
        } else {
          const last = acc[acc.length - 1]
          // 如果当前句子很短且上一句也很短，则合并
          if (current.length < 20 && last.length < 50) {
            acc[acc.length - 1] = last + ' ' + current
          } else {
            acc.push(current)
          }
        }
        return acc
      }, [])
      .join(' ')
      // 清理多余的空格和标点
      .replace(/\s+/g, ' ')
      .replace(/[。，！？；：、\s]+/g, ' ')
      .trim()

    // 限制长度，但保持句子完整性
    if (formattedText.length <= 8000) {
      return formattedText
    }

    // 如果超长，尝试在句号处截断
    const truncated = formattedText.substring(0, 8000)
    const lastPeriod = truncated.lastIndexOf('。')
    const lastSpace = truncated.lastIndexOf(' ')

    const cutPoint = lastPeriod > 7000 ? lastPeriod + 1 :
      lastSpace > 7000 ? lastSpace : 8000

    return formattedText.substring(0, cutPoint).trim()
  }
}

const backgroundAIService = new BackgroundAIService()

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "summarizeSubtitles") {
    backgroundAIService.summarizeSubtitles(request.subtitles)
      .then(result => {
        sendResponse({ success: true, data: result })
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message })
      })
    return true // Keep the message channel open for async response
  }

  if (request.action === "generateMindmap") {
    backgroundAIService.generateMindmap(request.subtitles)
      .then(result => {
        sendResponse({ success: true, data: result })
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message })
      })
    return true // Keep the message channel open for async response
  }

  if (request.action === "formatSubtitles") {
    const formatted = backgroundAIService.formatSubtitlesForAI(request.subtitles)
    sendResponse({ success: true, data: formatted })
  }

  if (request.action === "generateArticleMindmap") {
    backgroundAIService.generateArticleMindmap(request.content, request.title)
      .then(result => {
        sendResponse({ success: true, data: result })
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message })
      })
    return true // Keep the message channel open for async response
  }
})
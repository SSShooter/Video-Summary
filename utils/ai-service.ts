import { Storage } from "@plasmohq/storage"

export interface AIConfig {
  provider: string
  apiKeys: {
    openai?: string
    gemini?: string
    claude?: string
    zhipu?: string
    "openai-compatible"?: string
  }
  model: string
  baseUrl?: string
  baseUrls?: {
    openai?: string
    gemini?: string
    claude?: string
    zhipu?: string
    "openai-compatible"?: string
  }
  enabled: boolean
  customModel?: string
}

export interface SubtitleSummary {
  summary: string
  keyPoints: string[]
  topics: string[]
}

class AIService {
  private storage = new Storage()

  async getConfig(): Promise<AIConfig | null> {
    try {
      return await this.storage.get("aiConfig")
    } catch (error) {
      console.error("获取AI配置失败:", error)
      return null
    }
  }

  async summarizeSubtitles(subtitles: any[]): Promise<SubtitleSummary> {
    const config = await this.getConfig()
    const apiKey = config.apiKeys?.[config.provider as keyof typeof config.apiKeys]
    if (!config || !config.enabled || !apiKey) {
      throw new Error("AI功能未配置或未启用")
    }

    const formattedSubtitles = this.formatSubtitlesForAI(subtitles)
    
    // 通过background脚本发送请求避免CORS问题
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        {
          action: "summarizeSubtitles",
          subtitles: formattedSubtitles
        },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message))
            return
          }
          
          if (response.success) {
            resolve(response.data)
          } else {
            reject(new Error(response.error))
          }
        }
      )
    })
  }

  // 所有API调用现在都通过background脚本处理，避免CORS问题

  // 格式化字幕文本用于AI分析
  formatSubtitlesForAI(subtitles: any[]): string {
    if (!Array.isArray(subtitles)) {
      console.error('formatSubtitlesForAI: 输入参数不是数组:', subtitles)
      return ''
    }
    
    return subtitles
      .map(subtitle => {
        const text = subtitle.text || subtitle.content || ''
        return text.trim()
      })
      .filter(text => text.length > 0)
      .join(' ')
      .substring(0, 8000) // 限制长度避免超出API限制
  }
}

export const aiService = new AIService()
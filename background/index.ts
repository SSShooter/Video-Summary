// Background script to handle AI API requests and avoid CORS issues

import { Storage } from "@plasmohq/storage"
import { PROMPTS } from "./prompts"
import { ResponseParser } from "../utils/response-parser"
import type { SubtitleSummary } from "../utils/types"

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
  replyLanguage?: string
}

interface APIRequestConfig {
  url: string
  headers: Record<string, string>
  body: any
}

interface ProviderConfig {
  getDefaultBaseUrl(): string
  buildRequestConfig(config: AIConfig, systemPrompt: string, userPrompt: string, model: string, apiKey: string): APIRequestConfig
  extractContent(response: any): string
}



// 提供商配置类
class OpenAIProvider implements ProviderConfig {
  getDefaultBaseUrl(): string {
    return "https://api.openai.com/v1"
  }

  buildRequestConfig(config: AIConfig, systemPrompt: string, userPrompt: string, model: string, apiKey: string): APIRequestConfig {
    const baseUrl = config.baseUrl || this.getDefaultBaseUrl()

    const messages = []
    if (systemPrompt) {
      messages.push({ role: "system", content: systemPrompt })
    }
    messages.push({ role: "user", content: userPrompt })

    return {
      url: `${baseUrl}/chat/completions`,
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: {
        model: model,
        messages: messages,
        temperature: 0.3
      }
    }
  }

  extractContent(response: any): string {
    return response.choices[0]?.message?.content || ''
  }
}

class GeminiProvider implements ProviderConfig {
  getDefaultBaseUrl(): string {
    return "https://generativelanguage.googleapis.com/v1beta"
  }

  buildRequestConfig(config: AIConfig, systemPrompt: string, userPrompt: string, model: string, apiKey: string): APIRequestConfig {
    const baseUrl = config.baseUrl || this.getDefaultBaseUrl()
    const fullModelName = model.startsWith('models/') ? model : `models/${model}`

    // Gemini 不支持分离的系统提示词，需要合并
    const combinedPrompt = systemPrompt ? `${systemPrompt}\n\n${userPrompt}` : userPrompt

    return {
      url: `${baseUrl}/${fullModelName}:generateContent?key=${apiKey}`,
      headers: {
        "Content-Type": "application/json"
      },
      body: {
        contents: [{
          parts: [{ text: combinedPrompt }]
        }],
        generationConfig: {
          temperature: 0.3,
          responseMimeType: "application/json"
        }
      }
    }
  }

  extractContent(response: any): string {
    return response.candidates[0]?.content?.parts[0]?.text || ''
  }
}

class ClaudeProvider implements ProviderConfig {
  getDefaultBaseUrl(): string {
    return "https://api.anthropic.com/v1"
  }

  buildRequestConfig(config: AIConfig, systemPrompt: string, userPrompt: string, model: string, apiKey: string): APIRequestConfig {
    const baseUrl = config.baseUrl || this.getDefaultBaseUrl()

    return {
      url: `${baseUrl}/messages`,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: {
        model: model,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }]
      }
    }
  }

  extractContent(response: any): string {
    return response.content[0]?.text || ''
  }
}

class BackgroundAIService {
  private storage = new Storage()
  private providers: Record<string, ProviderConfig> = {
    'openai': new OpenAIProvider(),
    'openai-compatible': new OpenAIProvider(),
    'gemini': new GeminiProvider(),
    'claude': new ClaudeProvider()
  }

  // 从prompts文件导入提示词
  private readonly USER_PROMPT_TEMPLATE = PROMPTS.SUBTITLE_SUMMARY_USER

  async getConfig(): Promise<AIConfig | null> {
    try {
      const config = await this.storage.get<AIConfig>("aiConfig")
      return config || null
    } catch (error) {
      console.error("获取AI配置失败:", error)
      return null
    }
  }

  /**
   * 统一的API调用方法
   */
  private async callAI(systemPrompt: string, userPrompt: string): Promise<string> {
    const config = await this.getConfig()
    const apiKey = config?.apiKeys?.[config.provider as keyof typeof config.apiKeys]

    if (!config || !config.enabled || !apiKey) {
      throw new Error("AI功能未配置或未启用")
    }

    const provider = this.providers[config.provider]
    if (!provider) {
      throw new Error(`不支持的AI服务商: ${config.provider}`)
    }

    const model = config.customModel || config.model
    const requestConfig = provider.buildRequestConfig(config, systemPrompt, userPrompt, model, apiKey)

    const response = await fetch(requestConfig.url, {
      method: "POST",
      headers: requestConfig.headers,
      body: JSON.stringify(requestConfig.body)
    })

    if (!response.ok) {
      throw new Error(`${config.provider} API请求失败: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    return provider.extractContent(data)
  }

  async summarizeSubtitles(subtitles: string): Promise<SubtitleSummary> {
    const systemPrompt = await PROMPTS.SUBTITLE_SUMMARY_SYSTEM()
    const userPrompt = this.USER_PROMPT_TEMPLATE(subtitles)
    const content = await this.callAI(systemPrompt, userPrompt)
    return ResponseParser.parseSubtitleSummaryResponse(content, { enableTextFallback: true })
  }

  async generateMindmap(subtitles: string): Promise<any> {
    const mindmapPrompt = await PROMPTS.MINDMAP_GENERATION()
    const userPrompt = PROMPTS.MINDMAP_VIDEO_USER(subtitles)
    const content = await this.callAI(mindmapPrompt, userPrompt)
    return ResponseParser.parseMindmapResponse(content)
  }

  async generateArticleMindmap(content: string, title: string): Promise<any> {
    const mindmapPrompt = await PROMPTS.MINDMAP_GENERATION()
    const userPrompt = PROMPTS.MINDMAP_ARTICLE_USER(content, title)
    const responseContent = await this.callAI(mindmapPrompt, userPrompt)
    return ResponseParser.parseMindmapResponse(responseContent)
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

// YouTube字幕URL监听器
let capturedSubtitleUrl: string | null = null

// 监听YouTube的timedtext API请求
chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    const url = new URL(details.url)

    // 检查是否是YouTube的timedtext API请求
    if (url.hostname === "www.youtube.com" && url.pathname === "/api/timedtext") {
      // 检查是否包含pot参数（表示这是一个有效的字幕请求）
      if (url.searchParams.has('pot')) {
        console.log('捕获到YouTube字幕URL:', details.url)
        capturedSubtitleUrl = details.url

        // 通知content script字幕URL已捕获
        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
          if (tabs[0]?.id) {
            chrome.tabs.sendMessage(tabs[0].id, {
              type: "SUBTITLE_URL_CAPTURED",
              url: details.url
            }).catch(() => {
              // 忽略发送失败的错误（可能content script还未加载）
            })
          }
        })
      }
    }
  },
  {
    urls: ["https://www.youtube.com/api/timedtext*"]
  }
)

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
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

  if (request.action === "getCapturedSubtitleUrl") {
    sendResponse({ success: true, data: capturedSubtitleUrl })
  }

  if (request.action === "clearCapturedSubtitleUrl") {
    capturedSubtitleUrl = null
    sendResponse({ success: true })
  }
})
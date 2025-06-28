import styleText from "data-text:mind-elixir/style"
import styleOverride from "data-text:./mind-elixir-css-override.css"
import tailwindStyles from "data-text:~style.css"
import type { MindElixirData } from "mind-elixir"
import type { PlasmoCSConfig, PlasmoGetStyle } from "plasmo"
import { useEffect, useRef, useState } from "react"

import { Storage } from "@plasmohq/storage"

import MindElixirReact, {
  type MindElixirReactRef
} from "~components/MindElixirReact"
import { detectAndConvertArticle } from "~utils/html-to-markdown"

export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"],
  exclude_matches: [
    "https://www.youtube.com/*",
    "https://www.bilibili.com/*",
    "https://youtube.com/*"
  ],
  all_frames: false
}

export const getStyle: PlasmoGetStyle = () => {
  const style = document.createElement("style")
  style.textContent = tailwindStyles + styleText + styleOverride
  return style
}

interface ArticleInfo {
  title: string
  content: string
  url: string
}

interface CachedData {
  mindmapData: MindElixirData | null
  timestamp: number
}

function ArticleMindmapPanel() {
  const [articleInfo, setArticleInfo] = useState<ArticleInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mindmapData, setMindmapData] = useState<MindElixirData | null>(null)
  const [mindmapLoading, setMindmapLoading] = useState(false)
  const [mindmapError, setMindmapError] = useState<string | null>(null)
  const [showMindmap, setShowMindmap] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const [isEnabled, setIsEnabled] = useState(true)
  const storage = new Storage()
  const mindElixirRef = useRef<MindElixirReactRef>(null)

  // 检测页面是否包含文章内容
  const detectArticle = (): ArticleInfo | null => {
    // 常见的文章容器选择器
    const articleSelectors = [
      'article',
      '[role="main"]',
      '.post-content',
      '.article-content',
      '.entry-content',
      '.content',
      '.post-body',
      '.article-body',
      'main',
      '.markdown-body',
      '.prose'
    ]

    // 常见的标题选择器
    const titleSelectors = [
      'h1',
      '.title',
      '.post-title',
      '.article-title',
      '.entry-title',
      'title'
    ]

    let articleElement: Element | null = null
    let titleElement: Element | null = null

    // 查找文章容器
    for (const selector of articleSelectors) {
      const element = document.querySelector(selector)
      if (element && element.textContent && element.textContent.trim().length > 500) {
        articleElement = element
        break
      }
    }

    // 如果没找到明确的文章容器，尝试查找包含大量文本的元素
    if (!articleElement) {
      const allElements = document.querySelectorAll('div, section, main')
      for (const element of allElements) {
        const textContent = element.textContent || ''
        const childElements = element.children.length
        // 判断是否为文章：文本长度 > 1000 且子元素不太多（避免选中整个页面）
        if (textContent.trim().length > 1000 && childElements < 50) {
          articleElement = element
          break
        }
      }
    }

    // 查找标题
    for (const selector of titleSelectors) {
      const element = document.querySelector(selector)
      if (element && element.textContent && element.textContent.trim().length > 0) {
        titleElement = element
        break
      }
    }

    if (!articleElement) {
      return null
    }

    const title = titleElement?.textContent?.trim() || document.title || '未知标题'
    const content = articleElement.textContent?.trim() || ''

    // 最终验证：确保内容足够长
    if (content.length < 500) {
      return null
    }

    return {
      title,
      content,
      url: window.location.href
    }
  }

  // 使用智能HTML到Markdown转换

  // 生成思维导图
  const generateMindmap = async () => {
    if (!articleInfo) return

    setMindmapLoading(true)
    setMindmapError(null)

    try {
      // 使用智能HTML到Markdown转换
      let markdownContent = detectAndConvertArticle({
        maxLength: 8000,
        includeImages: false,
        includeLinks: true
      })

      // 如果智能检测失败，使用原始文本内容
      if (!markdownContent) {
        markdownContent = articleInfo.content
      }

      // 通过background脚本调用AI服务
      const response = await new Promise<MindElixirData>((resolve, reject) => {
        chrome.runtime.sendMessage(
          {
            action: "generateArticleMindmap",
            content: markdownContent,
            title: articleInfo.title
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
      console.log('生成思维导图成功', response)

      setMindmapData(response)
      setShowMindmap(true)

      // 缓存结果
      const cacheKey = `article_mindmap_${btoa(articleInfo.url).slice(0, 20)}`
      const cacheData: CachedData = {
        mindmapData: response,
        timestamp: Date.now()
      }
      await storage.set(cacheKey, cacheData)

    } catch (error) {
      console.error('生成思维导图失败:', error)
      setMindmapError(error instanceof Error ? error.message : '生成思维导图失败')
    } finally {
      setMindmapLoading(false)
    }
  }

  // 检查缓存
  const checkCache = async (url: string): Promise<MindElixirData | null> => {
    try {
      const cacheKey = `article_mindmap_${btoa(url).slice(0, 20)}`
      const cached = await storage.get<CachedData>(cacheKey)

      if (cached && cached.mindmapData) {
        const isExpired = Date.now() - cached.timestamp > 24 * 60 * 60 * 1000 // 24小时过期
        if (!isExpired) {
          return cached.mindmapData
        }
      }
    } catch (error) {
      console.error('检查缓存失败:', error)
    }
    return null
  }

  // 加载开关状态
  const loadEnabledStatus = async () => {
    try {
      const enabled = await storage.get<boolean>("articleMindmapEnabled")
      setIsEnabled(enabled !== false) // 默认为true
    } catch (error) {
      console.error("加载文章思维导图开关状态失败:", error)
    }
  }

  // 监听来自popup的消息
  useEffect(() => {
    const messageListener = (message: any) => {
      if (message.type === "TOGGLE_ARTICLE_MINDMAP") {
        setIsEnabled(message.enabled)
        if (!message.enabled) {
          setIsVisible(false)
        } else if (articleInfo) {
          setIsVisible(true)
        }
      }
    }

    chrome.runtime.onMessage.addListener(messageListener)
    return () => chrome.runtime.onMessage.removeListener(messageListener)
  }, [articleInfo])

  // 初始化检测
  useEffect(() => {
    const initDetection = async () => {
      setLoading(true)
      setError(null)

      try {
        // 先加载开关状态
        await loadEnabledStatus()
        
        const detected = detectArticle()
        if (detected) {
          setArticleInfo(detected)
          
          // 只有在开关启用时才显示浮框
          const enabled = await storage.get<boolean>("articleMindmapEnabled")
          if (enabled !== false) {
            setIsVisible(true)
          }

          // 检查缓存
          const cachedMindmap = await checkCache(detected.url)
          if (cachedMindmap) {
            setMindmapData(cachedMindmap)
            setShowMindmap(true)
          }
        }
      } catch (error) {
        console.error('文章检测失败:', error)
        setError('文章检测失败')
      } finally {
        setLoading(false)
      }
    }

    // 延迟执行，确保页面加载完成
    const timer = setTimeout(initDetection, 2000)
    return () => clearTimeout(timer)
  }, [])

  if (!isVisible || !articleInfo || !isEnabled) {
    return null
  }

  return (
    <div className="fixed top-5 right-5 w-96 max-h-[80vh] bg-white border border-gray-300 rounded-lg shadow-lg z-[10000] font-sans overflow-hidden">
      <div className="flex justify-between items-center px-4 py-3 bg-gray-50 border-b border-gray-200">
        <h3 className="m-0 text-base font-semibold text-gray-800">📄 文章思维导图</h3>
        <button
          className="bg-transparent border-none text-lg cursor-pointer text-gray-600 p-0 w-6 h-6 flex items-center justify-center hover:text-gray-800 hover:bg-gray-200 rounded"
          onClick={() => setIsVisible(false)}
        >
          ✕
        </button>
      </div>

      <div className="p-4 max-h-[calc(80vh-60px)] overflow-y-auto">
        <div className="mb-4">
          <h4 className="m-0 mb-2 text-sm font-semibold text-gray-800 leading-tight">{articleInfo.title}</h4>
          <p className="m-0 text-xs text-gray-600 leading-tight">
            字数: {articleInfo.content.length} |
            URL: {articleInfo.url.length > 50 ? articleInfo.url.slice(0, 50) + '...' : articleInfo.url}
          </p>
        </div>

        <div className="flex gap-2 mb-4">
          <button
            onClick={generateMindmap}
            disabled={mindmapLoading}
            className="flex-1 px-3 py-2 border border-blue-600 bg-blue-600 text-white rounded cursor-pointer text-xs font-medium transition-all duration-200 hover:bg-blue-700 hover:border-blue-700 disabled:bg-gray-500 disabled:border-gray-500 disabled:cursor-not-allowed"
          >
            {mindmapLoading ? '生成中...' : '生成思维导图'}
          </button>

          {mindmapData && (
            <button
              onClick={() => setShowMindmap(!showMindmap)}
              className="flex-1 px-3 py-2 border border-green-600 bg-green-600 text-white rounded cursor-pointer text-xs font-medium transition-all duration-200 hover:bg-green-700 hover:border-green-700"
            >
              {showMindmap ? '隐藏思维导图' : '显示思维导图'}
            </button>
          )}
        </div>

        {mindmapError && (
          <div className="px-3 py-2 bg-red-100 text-red-800 border border-red-200 rounded text-xs mb-4">
            ❌ {mindmapError}
          </div>
        )}

        {showMindmap && mindmapData && (
          <div className="w-full h-full">
            <MindElixirReact
              ref={mindElixirRef}
              data={mindmapData}
              options={{
                editable: false,
                draggable: false,
                toolBar: false,
                mouseSelectionButton: 2
              }}
            />
          </div>
        )}
      </div>
    </div>
  )
}


export default ArticleMindmapPanel
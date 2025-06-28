import styleText from "data-text:mind-elixir/style"
import styleOverride from "data-text:./mind-elixir-css-override.css"
import type { MindElixirData } from "mind-elixir"
import type { PlasmoCSConfig, PlasmoGetStyle } from "plasmo"
import { useEffect, useRef, useState } from "react"
import { createRoot } from "react-dom/client"

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
  style.textContent = styleText + styleText2 + styleOverride
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

  // 初始化检测
  useEffect(() => {
    const initDetection = async () => {
      setLoading(true)
      setError(null)

      try {
        const detected = detectArticle()
        if (detected) {
          setArticleInfo(detected)
          setIsVisible(true)

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

  if (!isVisible || !articleInfo) {
    return null
  }

  return (
    <div className="video-summary-container">
      <div className="video-summary-header">
        <h3>📄 文章思维导图</h3>
        <button
          className="close-btn"
          onClick={() => setIsVisible(false)}
        >
          ✕
        </button>
      </div>

      <div className="video-summary-content">
        <div className="article-info">
          <h4>{articleInfo.title}</h4>
          <p className="article-meta">
            字数: {articleInfo.content.length} |
            URL: {articleInfo.url.length > 50 ? articleInfo.url.slice(0, 50) + '...' : articleInfo.url}
          </p>
        </div>

        <div className="action-buttons">
          <button
            onClick={generateMindmap}
            disabled={mindmapLoading}
            className="generate-btn"
          >
            {mindmapLoading ? '生成中...' : '生成思维导图'}
          </button>

          {mindmapData && (
            <button
              onClick={() => setShowMindmap(!showMindmap)}
              className="toggle-btn"
            >
              {showMindmap ? '隐藏思维导图' : '显示思维导图'}
            </button>
          )}
        </div>

        {mindmapError && (
          <div className="error-message">
            ❌ {mindmapError}
          </div>
        )}

        {showMindmap && mindmapData && (
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
        )}
      </div>
    </div>
  )
}

const styleText2 = `
.video-summary-container {
  position: fixed;
  top: 20px;
  right: 20px;
  width: 400px;
  max-height: 80vh;
  background: white;
  border: 1px solid #ddd;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 10000;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  overflow: hidden;
}

.video-summary-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: #f8f9fa;
  border-bottom: 1px solid #eee;
}

.video-summary-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #333;
}

.close-btn {
  background: none;
  border: none;
  font-size: 18px;
  cursor: pointer;
  color: #666;
  padding: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn:hover {
  color: #333;
  background: #e9ecef;
  border-radius: 4px;
}

.video-summary-content {
  padding: 16px;
  max-height: calc(80vh - 60px);
  overflow-y: auto;
}

.article-info {
  margin-bottom: 16px;
}

.article-info h4 {
  margin: 0 0 8px 0;
  font-size: 14px;
  font-weight: 600;
  color: #333;
  line-height: 1.4;
}

.article-meta {
  margin: 0;
  font-size: 12px;
  color: #666;
  line-height: 1.4;
}

.action-buttons {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.generate-btn, .toggle-btn {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #007bff;
  background: #007bff;
  color: white;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  transition: all 0.2s;
}

.generate-btn:hover, .toggle-btn:hover {
  background: #0056b3;
  border-color: #0056b3;
}

.generate-btn:disabled {
  background: #6c757d;
  border-color: #6c757d;
  cursor: not-allowed;
}

.toggle-btn {
  background: #28a745;
  border-color: #28a745;
}

.toggle-btn:hover {
  background: #1e7e34;
  border-color: #1e7e34;
}

.error-message {
  padding: 8px 12px;
  background: #f8d7da;
  color: #721c24;
  border: 1px solid #f5c6cb;
  border-radius: 4px;
  font-size: 12px;
  margin-bottom: 16px;
}

#mind-elixir-container {
  width: 100%;
  height: 100%;
}
`

// 创建并挂载组件
const container = document.createElement('div')
container.id = 'article-mindmap-extension'
document.body.appendChild(container)

const root = createRoot(container)
root.render(<ArticleMindmapPanel />)

export default ArticleMindmapPanel
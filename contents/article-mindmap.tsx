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
import { detectArticle, type ArticleInfo } from "~utils/article-detector"

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

interface CachedData {
  mindmapData: MindElixirData | null
  timestamp: number
}

function ArticleMindmapPanel({ key }: { key: string }) {
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
      const cacheKey = `article_mindmap_${btoa(articleInfo.url)}`
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
      const cacheKey = `article_mindmap_${btoa(url)}`
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



  // 监听来自popup的消息
  useEffect(() => {
    const messageListener = (message: any) => {
      if (message.type === "SHOW_ARTICLE_MINDMAP_PANEL") {
        setIsVisible(true)
      }
    }

    chrome.runtime.onMessage.addListener(messageListener)
    return () => chrome.runtime.onMessage.removeListener(messageListener)
  }, [articleInfo])

  // 初始化检测文章信息（但不显示面板）
  useEffect(() => {
    const initDetection = async () => {
      setLoading(true)
      setError(null)

      try {
        const detected = detectArticle()
        if (detected) {
          setArticleInfo(detected)

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

// Wrapper组件，监听地址变化并重新运行ArticleMindmapPanel
function ArticleMindmapWrapper() {
  const [locationKey, setLocationKey] = useState(window.location.href)

  useEffect(() => {
    console.log('ArticleMindmapWrapper: 初始化地址监听器', window.location.href)
    
    // 监听地址变化
    const handleLocationChange = () => {
      const newLocation = window.location.href
      console.log('ArticleMindmapWrapper: 检测到地址变化', { from: locationKey, to: newLocation })
      setLocationKey(newLocation)
    }

    // 监听pushstate和replacestate事件
    const originalPushState = history.pushState
    const originalReplaceState = history.replaceState

    history.pushState = function(...args) {
      originalPushState.apply(history, args)
      console.log('ArticleMindmapWrapper: pushState触发')
      setTimeout(handleLocationChange, 0) // 使用setTimeout确保URL已更新
    }

    history.replaceState = function(...args) {
      originalReplaceState.apply(history, args)
      console.log('ArticleMindmapWrapper: replaceState触发')
      setTimeout(handleLocationChange, 0) // 使用setTimeout确保URL已更新
    }

    // 监听popstate事件（浏览器前进后退）
    const handlePopState = () => {
      console.log('ArticleMindmapWrapper: popstate触发')
      setTimeout(handleLocationChange, 0)
    }
    
    window.addEventListener('popstate', handlePopState)

    // 使用MutationObserver监听DOM变化（适用于某些SPA框架）
    const observer = new MutationObserver(() => {
      const currentLocation = window.location.href
      if (currentLocation !== locationKey) {
        console.log('ArticleMindmapWrapper: MutationObserver检测到地址变化')
        handleLocationChange()
      }
    })

    observer.observe(document.body, {
      childList: true,
      subtree: true
    })

    // 定期检查地址变化（兜底方案）
    const intervalId = setInterval(() => {
      const currentLocation = window.location.href
      if (currentLocation !== locationKey) {
        console.log('ArticleMindmapWrapper: 定期检查发现地址变化')
        handleLocationChange()
      }
    }, 1000)

    // 清理函数
    return () => {
      history.pushState = originalPushState
      history.replaceState = originalReplaceState
      window.removeEventListener('popstate', handlePopState)
      observer.disconnect()
      clearInterval(intervalId)
      console.log('ArticleMindmapWrapper: 清理地址监听器')
    }
  }, []) // 移除locationKey依赖，避免重复设置监听器

  // 使用locationKey作为key，确保地址变化时组件重新挂载
  console.log('ArticleMindmapWrapper: 渲染组件，当前地址key:', locationKey)
  return <ArticleMindmapPanel key={locationKey} />
}

export default ArticleMindmapWrapper
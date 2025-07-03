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
import { fullscreen } from "~utils/fullscreen"
import { launchMindElixir } from "~utils/mind-elixir"
import type { SubtitleSummary } from "~utils/types"

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
  aiSummary: SubtitleSummary | null
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
  const [mindElixirLoading, setMindElixirLoading] = useState(false)
  const [mindElixirError, setMindElixirError] = useState<string | null>(null)
  const [aiSummary, setAiSummary] = useState<SubtitleSummary | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<"summary" | "mindmap">("summary")
  const [cacheLoaded, setCacheLoaded] = useState(false)
  const storage = new Storage()
  const mindElixirRef = useRef<MindElixirReactRef>(null)

  // AI总结文章
  const summarizeWithAI = async (forceRegenerate = false) => {
    if (!articleInfo) {
      setAiError("没有文章内容可以总结")
      return
    }

    // 如果不是强制重新生成且已有缓存数据，直接使用缓存
    if (!forceRegenerate && aiSummary) {
      setActiveTab("summary")
      return
    }

    try {
      setAiLoading(true)
      setAiError(null)

      // 使用智能HTML到Markdown转换
      let markdownContent = detectAndConvertArticle()
      
      // 如果智能检测失败，使用原始文本内容
      if (!markdownContent) {
        markdownContent = articleInfo.content
      }

      // 通过background脚本调用AI服务
      const response = await new Promise<SubtitleSummary>((resolve, reject) => {
        chrome.runtime.sendMessage(
          {
            action: "summarizeSubtitles",
            subtitles: markdownContent
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

      setAiSummary(response)
      setActiveTab("summary")

      // 保存到缓存
      const cacheKey = `article_mindmap_${btoa(articleInfo.url)}`
      const cacheData: CachedData = {
        mindmapData,
        aiSummary: response,
        timestamp: Date.now()
      }
      await storage.set(cacheKey, cacheData)

    } catch (error) {
      console.error("AI总结失败:", error)
      setAiError(
        error instanceof Error ? error.message : "总结失败，请检查AI配置"
      )
    } finally {
      setAiLoading(false)
    }
  }

  // 生成思维导图
  const generateMindmap = async () => {
    if (!articleInfo) return

    setMindmapLoading(true)
    setMindmapError(null)

    try {
      // 使用智能HTML到Markdown转换
      let markdownContent = detectAndConvertArticle()
      console.log('智能HTML到Markdown转换结果:', markdownContent)

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
        aiSummary,
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

  // 在 Mind Elixir 中打开思维导图
  const openInMindElixir = async () => {
    if (mindmapData) {
      setMindElixirLoading(true)
      setMindElixirError(null)

      try {
        // 使用通用的 Mind Elixir 启动函数
        await launchMindElixir(mindmapData)
      } catch (error) {
        console.error('打开 Mind Elixir 失败:', error)
        setMindElixirError(error instanceof Error ? error.message : '打开 Mind Elixir 失败')
      } finally {
        setMindElixirLoading(false)
      }
    }
  }

  // 检查缓存
  const checkCache = async (url: string): Promise<CachedData | null> => {
    try {
      const cacheKey = `article_mindmap_${btoa(url)}`
      const cached = await storage.get<CachedData>(cacheKey)

      if (cached) {
        const isExpired = Date.now() - cached.timestamp > 24 * 60 * 60 * 1000 // 24小时过期
        if (!isExpired) {
          return cached
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
          const cachedData = await checkCache(detected.url)
          if (cachedData) {
            if (cachedData.mindmapData) {
              setMindmapData(cachedData.mindmapData)
              setShowMindmap(true)
            }
            if (cachedData.aiSummary) {
              setAiSummary(cachedData.aiSummary)
            }
            setCacheLoaded(true)
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
        <h3 className="m-0 text-base font-semibold text-gray-800">📄 文章助手</h3>
        <button
          className="bg-transparent border-none text-lg cursor-pointer text-gray-600 p-0 w-6 h-6 flex items-center justify-center hover:text-gray-800 hover:bg-gray-200 rounded"
          onClick={() => setIsVisible(false)}
        >
          ✕
        </button>
      </div>

      {/* Tab导航 */}
      <div className="flex border-b border-gray-200 bg-gray-50">
        <button
          onClick={() => setActiveTab("summary")}
          className={`flex-1 py-2 px-3 text-xs font-medium transition-all duration-200 ${
            activeTab === "summary"
              ? "text-blue-600 border-b-2 border-blue-600 bg-white"
              : "text-gray-600 hover:text-blue-500"
          }`}
        >
          AI总结
        </button>
        <button
          onClick={() => {
            setActiveTab("mindmap")
            setTimeout(() => {
              mindElixirRef.current?.instance.toCenter()
            }, 200)
          }}
          className={`flex-1 py-2 px-3 text-xs font-medium transition-all duration-200 ${
            activeTab === "mindmap"
              ? "text-blue-600 border-b-2 border-blue-600 bg-white"
              : "text-gray-600 hover:text-blue-500"
          }`}
        >
          思维导图
        </button>
      </div>

      <div className="p-4 max-h-[calc(80vh-100px)] overflow-y-auto">
        {/* 文章信息 */}
        <div className="mb-4">
          <h4 className="m-0 mb-2 text-sm font-semibold text-gray-800 leading-tight">{articleInfo.title}</h4>
          <p className="m-0 text-xs text-gray-600 leading-tight">
            字数: {articleInfo.content.length} |
            URL: {articleInfo.url.length > 50 ? articleInfo.url.slice(0, 50) + '...' : articleInfo.url}
          </p>
        </div>

        {/* AI总结Tab内容 */}
        {activeTab === "summary" && (
          <>
            {/* AI总结功能按钮 */}
            <div className="mb-4">
              <div className="flex gap-2">
                <button
                  onClick={() => summarizeWithAI(false)}
                  disabled={aiLoading}
                  className={`flex-1 px-3 py-2 text-xs border-none rounded cursor-pointer font-medium transition-all duration-200 ${
                    aiLoading ? "bg-gray-400 cursor-not-allowed" : "bg-blue-500 hover:bg-blue-600"
                  } text-white`}
                >
                  {aiLoading
                    ? "总结中..."
                    : aiSummary
                    ? "查看总结"
                    : "生成AI总结"}
                </button>
                {aiSummary && (
                  <button
                    onClick={() => summarizeWithAI(true)}
                    disabled={aiLoading}
                    className={`px-3 py-2 text-xs border-none rounded cursor-pointer font-medium transition-all duration-200 ${
                      aiLoading ? "bg-gray-400 cursor-not-allowed" : "bg-green-500 hover:bg-green-600"
                    } text-white`}
                  >
                    重新生成
                  </button>
                )}
              </div>
              {aiError && (
                <div className="mt-2 px-3 py-2 bg-red-100 text-red-800 border border-red-200 rounded text-xs">
                  ❌ {aiError}
                </div>
              )}
            </div>

            {!aiSummary && !aiLoading && (
              <div className="text-center py-8 px-4 text-gray-600">
                <div className="mb-3 text-sm">暂无AI总结</div>
                <div className="text-xs">
                  点击上方按钮生成文章AI总结
                </div>
              </div>
            )}

            {aiLoading && (
              <div className="text-center py-8 px-4 text-gray-600">
                正在生成AI总结...
              </div>
            )}

            {aiSummary && (
              <div className="p-3 bg-green-50 border border-green-300 rounded">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="m-0 text-sm text-blue-600 font-semibold">
                    AI内容总结
                  </h4>
                  {cacheLoaded && (
                    <span className="text-xs text-green-600 bg-green-100 py-1 px-2 rounded-full border border-green-300">
                      已缓存
                    </span>
                  )}
                </div>

                <div className="mb-3">
                  <div className="text-xs text-gray-600 mb-1 font-medium">
                    概要:
                  </div>
                  <div className="text-xs leading-relaxed text-gray-800">
                    {aiSummary.summary}
                  </div>
                </div>

                {aiSummary.keyPoints.length > 0 && (
                  <div className="mb-3">
                    <div className="text-xs text-gray-600 mb-1 font-medium">
                      关键要点:
                    </div>
                    <ul className="m-0 pl-4 text-xs leading-relaxed text-gray-800">
                      {aiSummary.keyPoints.map((point, index) => (
                        <li key={index} className="mb-1">
                          {point}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {aiSummary.topics.length > 0 && (
                  <div>
                    <div className="text-xs text-gray-600 mb-1 font-medium">
                      主要话题:
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {aiSummary.topics.map((topic, index) => (
                        <span
                          key={index}
                          className="py-1 px-2 bg-blue-50 text-blue-600 text-xs rounded-full border border-blue-200"
                        >
                          {topic}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* 思维导图Tab内容 */}
        {activeTab === "mindmap" && (
          <>
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
                  onClick={openInMindElixir}
                  disabled={mindElixirLoading}
                  className="flex-1 px-3 py-2 border border-purple-600 bg-purple-600 text-white rounded cursor-pointer text-xs font-medium transition-all duration-200 hover:bg-purple-700 hover:border-purple-700 disabled:bg-gray-500 disabled:border-gray-500 disabled:cursor-not-allowed"
                >
                  {mindElixirLoading ? '正在打开...' : '在 Mind Elixir 打开'}
                </button>
              )}

              {mindmapData && showMindmap && (
                <button
                  onClick={() => {
                    fullscreen(mindElixirRef.current?.instance!)
                  }}
                  className="flex-1 py-2 px-3 m-0 text-xs bg-cyan-500 text-white border-none rounded cursor-pointer hover:bg-cyan-600"
                >
                  全屏
                </button>
              )}
            </div>

            {mindmapError && (
              <div className="px-3 py-2 bg-red-100 text-red-800 border border-red-200 rounded text-xs mb-4">
                ❌ {mindmapError}
              </div>
            )}

            {mindElixirError && (
              <div className="px-3 py-2 bg-red-100 text-red-800 border border-red-200 rounded text-xs mb-4">
                ❌ {mindElixirError}
              </div>
            )}

            {!mindmapData && !mindmapLoading && (
              <div className="text-center py-8 px-4 text-gray-600">
                <div className="mb-3 text-sm">暂无思维导图</div>
                <div className="text-xs">
                  点击上方按钮生成文章思维导图
                </div>
              </div>
            )}

            {mindmapLoading && (
              <div className="text-center py-8 px-4 text-gray-600">
                正在生成思维导图...
              </div>
            )}

            {showMindmap && mindmapData && (
              <div className="w-full h-64 border border-gray-300 rounded overflow-hidden">
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
          </>
        )}
      </div>
    </div>
  )
}


export default ArticleMindmapPanel
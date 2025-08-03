import { useRef, useState, useEffect } from "react"
import type { MindElixirData } from "mind-elixir"
import MindElixirReact, { type MindElixirReactRef } from "~components/MindElixirReact"
import { aiService, type SubtitleSummary } from "~utils/ai-service"
import { fullscreen } from "~utils/fullscreen"
import { t, formatTime as formatTimeI18n } from "~utils/i18n"
import { Storage } from "@plasmohq/storage"
import { launchMindElixir } from "@mind-elixir/open-desktop"
import { options } from "~utils/mind-elixir"
import { downloadMethodList } from "@mind-elixir/export-mindmap"

export interface SubtitleItem {
  from?: number
  to?: number
  start?: number
  dur?: number
  content?: string
  text?: string
}

export interface VideoInfo {
  bvid?: string
  cid?: number
  videoId?: string
  title: string
}

interface CachedData {
  aiSummary: SubtitleSummary | null
  mindmapData: MindElixirData | null
  timestamp: number
}

export interface SubtitlePanelProps {
  subtitles: SubtitleItem[]
  loading: boolean
  error: string | null
  videoInfo: VideoInfo | null
  onJumpToTime: (time: number) => void
  platform: 'bilibili' | 'youtube'
  // 可选的额外功能
  enableMindmap?: boolean
}

export function SubtitlePanel({
  subtitles,
  loading,
  error,
  videoInfo,
  onJumpToTime,
  platform,
  enableMindmap = false
}: SubtitlePanelProps) {
  const [aiSummary, setAiSummary] = useState<SubtitleSummary | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [mindmapData, setMindmapData] = useState<MindElixirData | null>(null)
  const [mindmapLoading, setMindmapLoading] = useState(false)
  const [mindmapError, setMindmapError] = useState<string | null>(null)
  const [mindElixirLoading, setMindElixirLoading] = useState(false)
  const [mindElixirError, setMindElixirError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<"subtitles" | "summary" | "mindmap">("subtitles")
  const [cacheLoaded, setCacheLoaded] = useState(false)
  const mindmapRef = useRef<MindElixirReactRef>(null)
  const storage = new Storage()

  // 获取缓存键
  const getCacheKey = (): string | null => {
    if (platform === 'bilibili' && videoInfo?.bvid) {
      return `video_cache_${videoInfo.bvid}`
    } else if (platform === 'youtube' && videoInfo?.videoId) {
      return `video_cache_${videoInfo.videoId}`
    }
    return null
  }

  // 保存缓存数据
  const saveCacheData = async (data: CachedData) => {
    try {
      const cacheKey = getCacheKey()
      if (cacheKey) {
        await storage.set(cacheKey, data)
      }
    } catch (error) {
      console.error("保存缓存失败:", error)
    }
  }

  // 加载缓存数据
  const loadCacheData = async (): Promise<CachedData | null> => {
    try {
      const cacheKey = getCacheKey()
      if (cacheKey) {
        const cached = await storage.get<CachedData>(cacheKey)
        return cached || null
      }
      return null
    } catch (error) {
      console.error("加载缓存失败:", error)
      return null
    }
  }

  // 格式化时间
  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  // 获取字幕时间
  const getSubtitleTime = (subtitle: SubtitleItem) => {
    if (platform === 'bilibili') {
      return {
        start: subtitle.from || 0,
        end: subtitle.to || 0
      }
    } else {
      return {
        start: subtitle.start || 0,
        end: (subtitle.start || 0) + (subtitle.dur || 0)
      }
    }
  }

  // 获取字幕内容
  const getSubtitleContent = (subtitle: SubtitleItem) => {
    return subtitle.content || subtitle.text || ''
  }

  // AI总结字幕
  const summarizeWithAI = async (forceRegenerate = false) => {
    if (subtitles.length === 0) {
      setAiError(t("noSubtitles"))
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

      const summary = await aiService.summarizeSubtitles(subtitles)

      setAiSummary(summary)
      setActiveTab("summary")

      // 保存到缓存
      await saveCacheData({
        aiSummary: summary,
        mindmapData,
        timestamp: Date.now()
      })
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
  const generateMindmap = async (forceRegenerate = false) => {
    if (subtitles.length === 0) {
      setMindmapError("没有字幕内容可以生成思维导图")
      return
    }

    // 如果不是强制重新生成且已有缓存数据，直接使用缓存
    if (!forceRegenerate && mindmapData) {
      setActiveTab("mindmap")
      return
    }

    try {
      setMindmapLoading(true)
      setMindmapError(null)

      // 格式化字幕内容
      const formattedSubtitles = subtitles
        .map((subtitle) => getSubtitleContent(subtitle))
        .join(" ")
        .replace(/\s+/g, " ")
        .trim()

      // 发送消息到background script生成思维导图
      const response = await new Promise<any>((resolve, reject) => {
        chrome.runtime.sendMessage(
          {
            action: "generateMindmap",
            subtitles: formattedSubtitles
          },
          (response) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message))
            } else {
              resolve(response)
            }
          }
        )
      })

      if (response.success) {
        setMindmapData(response.data)
        setActiveTab("mindmap")

        // 保存到缓存
        await saveCacheData({
          aiSummary,
          mindmapData: response.data,
          timestamp: Date.now()
        })
      } else {
        throw new Error(response.error || "生成思维导图失败")
      }
    } catch (error) {
      console.error("生成思维导图失败:", error)
      setMindmapError(
        error instanceof Error
          ? error.message
          : "生成思维导图失败，请检查AI配置"
      )
    } finally {
      setMindmapLoading(false)
    }
  }

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

  // 加载缓存数据
  useEffect(() => {
    const loadCache = async () => {
      if (videoInfo) {
        const cached = await loadCacheData()
        if (cached) {
          if (cached.aiSummary) {
            setAiSummary(cached.aiSummary)
          }
          if (cached.mindmapData) {
            setMindmapData(cached.mindmapData)
          }
          setCacheLoaded(true)
        }
      }
    }

    loadCache()
  }, [videoInfo])

  return (
    <div className="w-[350px] h-[600px] bg-white border border-gray-300 rounded-[8px] p-[16px] font-sans shadow-lg fixed top-[80px] right-[20px] z-[9999] overflow-hidden flex flex-col">
      <div className="mb-[12px]">
        <h3 className="m-0 mb-[8px] text-[16px] font-semibold text-gray-900">
          {platform === 'bilibili' ? t('videoAssistant') : t('youtubeSubtitle')}
        </h3>
        {videoInfo && (
          <div className="text-[12px] text-gray-600 leading-relaxed mb-[12px]">
            {videoInfo.title}
          </div>
        )}

        {/* Tab导航 */}
        <div className="flex border-b border-gray-300">
          <button
            onClick={() => setActiveTab("subtitles")}
            className={`flex-1 py-[8px] px-[12px] m-0 text-[12px] bg-transparent border-none border-b-[2px] cursor-pointer transition-all duration-200 ${activeTab === "subtitles"
              ? "text-blue-500 border-blue-500"
              : "text-gray-600 border-transparent hover:text-blue-400"
              }`}>
            {t('subtitles')}
          </button>
          <button
            onClick={() => setActiveTab("summary")}
            className={`flex-1 py-[8px] px-[12px] m-0 text-[12px] bg-transparent border-none border-b-[2px] cursor-pointer transition-all duration-200 ${activeTab === "summary"
              ? "text-blue-500 border-blue-500"
              : "text-gray-600 border-transparent hover:text-blue-400"
              }`}>
            {t('aiSummary')}
          </button>
          {enableMindmap && (
            <button
              onClick={() => {
                setActiveTab("mindmap")
                setTimeout(() => {
                  mindmapRef.current?.instance.toCenter()
                }, 200)
              }}
              className={`flex-1 py-[8px] px-[12px] m-0 text-[12px] bg-transparent border-none border-b-[2px] cursor-pointer transition-all duration-200 ${activeTab === "mindmap"
                ? "text-blue-500 border-blue-500"
                : "text-gray-600 border-transparent hover:text-blue-400"
                }`}>
              {t('mindmap')}
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {/* 字幕Tab内容 */}
        {activeTab === "subtitles" && (
          <>
            {loading && (
              <div className="text-center p-[20px] text-gray-600">
                {t('loading')}
              </div>
            )}

            {error && (
              <div className="text-center p-[20px] text-red-500">
                {error}
              </div>
            )}

            {subtitles.length > 0 && (
              <div>
                {subtitles.map((subtitle, index) => {
                  const time = getSubtitleTime(subtitle)
                  const content = getSubtitleContent(subtitle)
                  return (
                    <div
                      key={index}
                      className="py-[8px] border-b border-gray-100 cursor-pointer transition-colors duration-200 hover:bg-gray-50"
                      onClick={() => onJumpToTime(time.start)}>
                      <div className="text-[12px] text-blue-500 mb-[4px] font-medium">
                        {formatTime(time.start)} - {formatTime(time.end)}
                      </div>
                      <div className="text-[14px] text-gray-900 leading-relaxed">
                        {content}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}

        {/* AI总结Tab内容 */}
        {activeTab === "summary" && (
          <>
            {/* AI总结功能按钮 */}
            {subtitles.length > 0 && (
              <div className="p-[12px]">
                <div className="flex gap-[8px]">
                  <button
                    onClick={() => summarizeWithAI(false)}
                    disabled={aiLoading}
                    className={`flex-1 py-[8px] px-[12px] m-0 text-[12px] border-none rounded-[4px] cursor-pointer transition-colors duration-200 ${aiLoading ? "bg-gray-400 cursor-not-allowed" : "bg-blue-500 hover:bg-blue-600"
                      } text-white`}>
                    {aiLoading
                      ? t('summarizing')
                      : aiSummary
                        ? t('viewSummary')
                        : t('generateAiSummary')}
                  </button>
                  {aiSummary && (
                    <button
                      onClick={() => summarizeWithAI(true)}
                      disabled={aiLoading}
                      className={`py-[8px] px-[12px] m-0 text-[12px] border-none rounded-[4px] cursor-pointer transition-colors duration-200 ${aiLoading ? "bg-gray-400 cursor-not-allowed" : "bg-green-500 hover:bg-green-600"
                        } text-white`}>
                      {t('regenerate')}
                    </button>
                  )}
                </div>
                {aiError && (
                  <div className="mt-[8px] p-[8px] bg-red-50 border border-red-200 rounded-[4px] text-[12px] text-red-500">
                    {aiError}
                  </div>
                )}
              </div>
            )}

            {!aiSummary && !aiLoading && subtitles.length === 0 && (
              <div className="text-center py-[40px] px-[20px] text-gray-600">
                <div className="mb-[12px]">{t('noSubtitles')}</div>
                <div className="text-[12px]">
                  {t('getSubtitlesFirst')}
                </div>
              </div>
            )}

            {aiLoading && (
              <div className="text-center py-[40px] px-[20px] text-gray-600">
                {t('generatingAiSummary')}
              </div>
            )}

            {aiSummary && (
              <div className="p-[12px] bg-green-50 border border-green-300 rounded-[6px]">
                <div className="flex justify-between items-center mb-[12px]">
                  <h4 className="m-0 text-[14px] text-blue-500 font-semibold">
                    {t('aiContentSummaryTitle')}
                  </h4>
                  {cacheLoaded && (
                    <span className="text-[12px] text-green-500 bg-green-50 py-[2px] px-[6px] rounded-full border border-green-300">
                      {t('cached')}
                    </span>
                  )}
                </div>

                <div className="mb-[12px]">
                  <div className="text-[12px] text-gray-600 mb-[4px] font-medium">
                    {t('summary')}
                  </div>
                  <div className="text-[12px] leading-relaxed text-gray-800">
                    {aiSummary.summary}
                  </div>
                </div>

                {aiSummary.keyPoints.length > 0 && (
                  <div className="mb-[12px]">
                    <div className="text-[12px] text-gray-600 mb-[4px] font-medium">
                      {t('keyPoints')}
                    </div>
                    <ul className="m-0 pl-[16px] text-[12px] leading-relaxed text-gray-800">
                      {aiSummary.keyPoints.map((point, index) => (
                        <li key={index} className="mb-[2px]">
                          {point}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {aiSummary.topics.length > 0 && (
                  <div>
                    <div className="text-[12px] text-gray-600 mb-[4px] font-medium">
                      {t('mainTopics')}
                    </div>
                    <div className="flex flex-wrap gap-[4px]">
                      {aiSummary.topics.map((topic, index) => (
                        <span
                          key={index}
                          className="py-[2px] px-[6px] bg-blue-50 text-blue-500 text-[12px] rounded-full border border-blue-200">
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
        {enableMindmap && activeTab === "mindmap" && (
          <>
            {/* 思维导图功能按钮 */}
            {subtitles.length > 0 && (
              <div className="p-[12px]">
                <div className="flex gap-[8px] mb-[8px]">
                  {!mindmapData ? (
                    <button
                      onClick={() => generateMindmap(false)}
                      disabled={mindmapLoading}
                      className={`flex-1 py-[8px] px-[12px] m-0 text-[12px] border-none rounded-[4px] cursor-pointer transition-colors duration-200 ${mindmapLoading ? "bg-gray-400 cursor-not-allowed" : "bg-purple-600 hover:bg-purple-700"
                        } text-white`}>
                      {mindmapLoading ? t('generating') : t('generateMindmapBtn')}
                    </button>
                  ) : (
                    <button
                      onClick={() => generateMindmap(true)}
                      disabled={mindmapLoading}
                      className={`flex-1 py-[8px] px-[12px] m-0 text-[12px] border-none rounded-[4px] cursor-pointer transition-colors duration-200 ${mindmapLoading ? "bg-gray-400 cursor-not-allowed" : "bg-green-500 hover:bg-green-600"
                        } text-white`}>
                      {t('regenerate')}
                    </button>
                  )}
                </div>
                {mindmapData && (
                  <div className="flex gap-[8px]">
                    <button
                      onClick={openInMindElixir}
                      disabled={mindElixirLoading}
                      className={`flex-1 py-[8px] px-[12px] m-0 text-[12px] border-none rounded-[4px] ${mindElixirLoading
                        ? 'bg-gray-400 text-white cursor-not-allowed'
                        : 'bg-cyan-500 text-white cursor-pointer hover:bg-cyan-600'
                        }`}>
                      {mindElixirLoading ? t('opening') : t('openInMindElixir')}
                    </button>
                    <button
                      onClick={() => {
                        fullscreen(mindmapRef.current?.instance!)
                      }}
                      className="flex-1 py-[8px] px-[12px] m-0 text-[12px] bg-cyan-500 text-white border-none rounded-[4px] cursor-pointer hover:bg-cyan-600">
                      {t('fullscreen')}
                    </button>
                  </div>
                )}
                {mindElixirError && (
                  <div className="mt-[8px] p-[8px] bg-red-50 border border-red-200 rounded-[4px] text-[12px] text-red-500">
                    {mindElixirError}
                  </div>
                )}
                {mindmapError && (
                  <div className="mt-[8px] p-[8px] bg-red-50 border border-red-200 rounded-[4px] text-[12px] text-red-500">
                    {mindmapError}
                  </div>
                )}
              </div>
            )}

            {!mindmapData && !mindmapLoading && subtitles.length === 0 && (
              <div className="text-center py-[40px] px-[20px] text-gray-600">
                <div className="mb-[12px]">{t('noSubtitles')}</div>
                <div className="text-[12px]">
                  {t('getSubtitlesForMindmap')}
                </div>
              </div>
            )}

            {mindmapLoading && (
              <div className="text-center py-[40px] px-[20px] text-gray-600">
                {t('generatingMindmap')}
              </div>
            )}

            {mindmapData && (
              <div className="h-[calc(100%-120px)] border border-gray-300 rounded-[6px] overflow-hidden mt-[12px]">
                <MindElixirReact data={mindmapData} ref={mindmapRef}
                  options={options} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

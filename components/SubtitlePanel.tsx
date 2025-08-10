import React, { useState, useRef, useEffect } from "react"
import type { MindElixirData } from "mind-elixir"
import MindElixirReact, { type MindElixirReactRef } from "~components/MindElixirReact"
import { aiService, type SubtitleSummary } from "~utils/ai-service"
import { fullscreen } from "~utils/fullscreen"
import { t, formatTime as formatTimeI18n } from "~utils/i18n"
import { Storage } from "@plasmohq/storage"
import { launchMindElixir } from "@mind-elixir/open-desktop"
import { options } from "~utils/mind-elixir"
import { downloadMethodList } from "@mind-elixir/export-mindmap"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuTrigger,
} from "~components/ui/dropdown-menu"
import { Button } from "~components/ui/button"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "~components/ui/tabs"
import { Brain, RotateCcw, ExternalLink, Maximize, Download } from "lucide-react"
import { Toaster } from "~components/ui/sonner"
import { toast } from "sonner"
import { ScrollArea } from './ui/scroll-area'
import { SummaryDisplay } from './SummaryDisplay'

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
  onClose?: () => void
}

export function SubtitlePanel({
  subtitles,
  loading,
  error,
  videoInfo,
  onJumpToTime,
  platform,
  onClose
}: SubtitlePanelProps) {
  const [aiSummary, setAiSummary] = useState<SubtitleSummary | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [mindmapData, setMindmapData] = useState<MindElixirData | null>(null)
  const [mindmapLoading, setMindmapLoading] = useState(false)
  const [mindElixirLoading, setMindElixirLoading] = useState(false)

  const [cacheLoaded, setCacheLoaded] = useState(false)
  const mindmapRef = useRef<MindElixirReactRef>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  console.log(panelRef, 'panelRef')
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
      toast.error(t("noSubtitles"))
      return
    }

    // 如果不是强制重新生成且已有缓存数据，直接使用缓存
    if (!forceRegenerate && aiSummary) {
      return
    }

    try {
      setAiLoading(true)
      toast.loading(t('generatingAiSummary'))

      const summary = await aiService.summarizeSubtitles(subtitles)

      setAiSummary(summary)
      toast.dismiss()
      toast.success(t('aiSummaryGenerated') || 'AI总结生成成功')

      // 保存到缓存
      await saveCacheData({
        aiSummary: summary,
        mindmapData,
        timestamp: Date.now()
      })
    } catch (error) {
      console.error("AI总结失败:", error)
      toast.dismiss()
      toast.error(
        error instanceof Error ? error.message : "总结失败，请检查AI配置"
      )
    } finally {
      setAiLoading(false)
    }
  }

  // 生成思维导图
  const generateMindmap = async (forceRegenerate = false) => {
    if (subtitles.length === 0) {
      toast.error("没有字幕内容可以生成思维导图")
      return
    }

    // 如果不是强制重新生成且已有缓存数据，直接使用缓存
    if (!forceRegenerate && mindmapData) {
      return
    }

    try {
      setMindmapLoading(true)
      toast.loading(t('generatingMindmap'))

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
        toast.dismiss()
        toast.success(t('mindmapGenerated') || '思维导图生成成功')

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
      toast.dismiss()
      toast.error(
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
      toast.loading(t('opening') || '正在打开...')

      try {
        // 使用通用的 Mind Elixir 启动函数
        await launchMindElixir(mindmapData)
        toast.dismiss()
        toast.success(t('openedSuccessfully') || '打开成功')
      } catch (error) {
        console.error('打开 Mind Elixir 失败:', error)
        toast.dismiss()
        toast.error(error instanceof Error ? error.message : '打开 Mind Elixir 失败')
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
    <div ref={panelRef} className="w-[350px] h-[600px] bg-white border border-gray-300 rounded-[8px] p-[16px] font-sans shadow-lg fixed top-[80px] right-[20px] z-[9999] overflow-hidden flex flex-col">
      <div className="mb-[12px]">
        <div className="flex justify-between items-center mb-[8px]">
          <h3 className="m-0 text-[16px] font-semibold text-gray-900">
            {platform === 'bilibili' ? t('videoAssistant') : t('youtubeSubtitle')}
          </h3>
          {onClose && (
            <Button
              onClick={onClose}
              variant="ghost"
              size="sm"
              className="p-1 h-6 w-6 hover:bg-gray-100"
              title={t('close') || '关闭'}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </Button>
          )}
        </div>
        {videoInfo && (
          <div className="text-[12px] text-gray-600 leading-relaxed">
            {videoInfo.title}
          </div>
        )}

      </div>

      <Tabs defaultValue="subtitles" className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="subtitles">{t('subtitles')}</TabsTrigger>
          <TabsTrigger value="summary">{t('aiSummary')}</TabsTrigger>
          <TabsTrigger
            value="mindmap"
          >
            {t('mindmap')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="subtitles" className="flex-1 overflow-auto mt-[12px]">
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
            <ScrollArea className='h-full'>
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
            </ScrollArea>
          )}
        </TabsContent>

        <TabsContent value="summary" className="overflow-hidden mt-[12px]">
          <SummaryDisplay
            aiSummary={aiSummary}
            aiLoading={aiLoading}
            cacheLoaded={cacheLoaded}
            onGenerate={() => summarizeWithAI(!!aiSummary)}
          />
        </TabsContent>

        <TabsContent value="mindmap" className="overflow-auto mt-[12px]">
          <div className="flex-1 flex flex-col h-full">
            <div className="flex mb-[8px] gap-2 justify-between">
              <Button
                className="flex-grow"
                onClick={() => generateMindmap(!!mindmapData)}
                disabled={mindmapLoading}
                size="sm"
                title={
                  mindmapLoading
                    ? t('generating')
                    : mindmapData
                      ? t('regenerate')
                      : t('generateMindmapBtn')
                }>
                {mindmapLoading
                  ? t('generating')
                  : mindmapData
                    ? t('regenerate')
                    : t('generateMindmapBtn')}
                {mindmapData ? (
                  <RotateCcw className="w-4 h-4" />
                ) : (
                  <Brain className="w-4 h-4" />
                )}
              </Button>
              {mindmapData && (
                <>
                  <Button
                    onClick={openInMindElixir}
                    disabled={mindElixirLoading}
                    size="sm"
                    title={
                      mindElixirLoading ? t('opening') : t('openInMindElixir')
                    }>
                    <ExternalLink className="w-4 h-4" />
                  </Button>
                  <Button
                    onClick={() => {
                      fullscreen(mindmapRef.current?.instance!)
                    }}
                    size="sm"
                    title={t('fullscreen')}>
                    <Maximize className="w-4 h-4" />
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" title={t('download') || '下载'}>
                        <Download className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuPortal container={panelRef.current}>
                      <DropdownMenuContent align="end">
                        {downloadMethodList.map((method) => (
                          <DropdownMenuItem
                            key={method.type}
                            onClick={() => {
                              if (mindmapRef.current?.instance) {
                                method.download(mindmapRef.current.instance)
                              }
                            }}>
                            {method.type}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenuPortal>
                  </DropdownMenu>
                </>
              )}
            </div>

            {!mindmapData && !mindmapLoading && (
              <div className="text-center py-[40px] px-[20px] text-gray-600">
                <div className="mb-[12px]">{t('noMindmap')}</div>
                <div className="text-[12px]">
                  {t('clickToGenerateVideoMindmap')}
                </div>
              </div>
            )}

            {mindmapLoading && (
              <div className="text-center py-[40px] px-[20px] text-gray-600">
                {t('generatingMindmap')}
              </div>
            )}

            {mindmapData && (
              <div className="flex-1 border border-gray-300 rounded-[6px] overflow-hidden">
                <MindElixirReact
                  data={mindmapData}
                  ref={mindmapRef}
                  options={options}
                />
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
      <Toaster />
    </div>
  )
}

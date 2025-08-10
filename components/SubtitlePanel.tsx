import React, { useRef } from "react"

import { Button } from "~components/ui/button"
import { Toaster } from "~components/ui/sonner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~components/ui/tabs"
import { t } from "~utils/i18n"

import { MindmapDisplay, type MindmapGenerateConfig } from "./MindmapDisplay"
import { SummaryDisplay, type SummaryGenerateConfig } from "./SummaryDisplay"
import { ScrollArea } from "./ui/scroll-area"

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



export interface SubtitlePanelProps {
  subtitles: SubtitleItem[]
  loading: boolean
  error: string | null
  videoInfo: VideoInfo | null
  onJumpToTime: (time: number) => void
  platform: "bilibili" | "youtube"
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

  const panelRef = useRef<HTMLDivElement>(null)

  // 获取思维导图缓存键
  const getMindmapCacheKey = () => {
    if (platform === "bilibili" && videoInfo?.bvid) {
      return `mindmap_${videoInfo.bvid}`
    } else if (platform === "youtube" && videoInfo?.videoId) {
      return `mindmap_${videoInfo.videoId}`
    }
    return undefined
  }

  // 获取AI总结缓存键
  const getSummaryCacheKey = () => {
    if (platform === "bilibili" && videoInfo?.bvid) {
      return `summary_${videoInfo.bvid}`
    } else if (platform === "youtube" && videoInfo?.videoId) {
      return `summary_${videoInfo.videoId}`
    }
    return undefined
  }

  // 格式化时间
  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  // 获取字幕时间
  const getSubtitleTime = (subtitle: SubtitleItem) => {
    if (platform === "bilibili") {
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
    return subtitle.content || subtitle.text || ""
  }

  // AI总结生成配置
  const summaryGenerateConfig: SummaryGenerateConfig = {
    action: "summarizeSubtitles",
    getContent: () => {
      if (subtitles.length === 0) return null

      // 格式化字幕内容
      return subtitles
        .map((subtitle) => getSubtitleContent(subtitle))
        .join(" ")
        .replace(/\s+/g, " ")
        .trim()
    },
    additionalData: {}
  }

  // 思维导图生成配置
  const mindmapGenerateConfig: MindmapGenerateConfig = {
    action: "generateMindmap",
    getContent: () => {
      if (subtitles.length === 0) return null

      // 格式化字幕内容
      return subtitles
        .map((subtitle) => getSubtitleContent(subtitle))
        .join(" ")
        .replace(/\s+/g, " ")
        .trim()
    },
    additionalData: {}
  }



  return (
    <div
      ref={panelRef}
      className="w-[350px] h-[600px] bg-white border border-gray-300 rounded-[8px] p-[16px] font-sans shadow-lg fixed top-[80px] right-[20px] z-[9999] overflow-hidden flex flex-col">
      <div className="mb-[12px]">
        <div className="flex justify-between items-center mb-[8px]">
          <h3 className="m-0 text-[16px] font-semibold text-gray-900">
            {platform === "bilibili"
              ? t("videoAssistant")
              : t("youtubeSubtitle")}
          </h3>
          {onClose && (
            <Button
              onClick={onClose}
              variant="ghost"
              size="sm"
              className="p-1 h-6 w-6 hover:bg-gray-100"
              title={t("close") || "关闭"}>
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
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

      <Tabs
        defaultValue="subtitles"
        className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="subtitles">{t("subtitles")}</TabsTrigger>
          <TabsTrigger value="summary">{t("aiSummary")}</TabsTrigger>
          <TabsTrigger value="mindmap">{t("mindmap")}</TabsTrigger>
        </TabsList>

        <TabsContent
          value="subtitles"
          className="flex-1 overflow-auto mt-[12px]">
          {loading && (
            <div className="text-center p-[20px] text-gray-600">
              {t("loading")}
            </div>
          )}

          {error && (
            <div className="text-center p-[20px] text-red-500">{error}</div>
          )}

          {subtitles.length > 0 && (
            <ScrollArea className="h-full">
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
            generateConfig={summaryGenerateConfig}
            cacheKey={getSummaryCacheKey()}
          />
        </TabsContent>

        <TabsContent value="mindmap" className="overflow-hidden mt-[12px]">
          <MindmapDisplay
            panelRef={panelRef}
            generateConfig={mindmapGenerateConfig}
            cacheKey={getMindmapCacheKey()}
          />
        </TabsContent>
      </Tabs>
      <Toaster />
    </div>
  )
}

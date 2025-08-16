import React, { useEffect, useState } from "react"
import { toast } from "sonner"

import { Storage } from "@plasmohq/storage"

import { Button } from "~components/ui/button"
import { ScrollArea } from "~components/ui/scroll-area"
import { aiService, type SubtitleSummary } from "~utils/ai-service"
import { t } from "~utils/i18n"

export interface SummaryGenerateConfig {
  action: string
  getContent: () => string | null
  getTitle?: () => string
  additionalData?: Record<string, any>
}

interface SummaryDisplayProps {
  generateConfig?: SummaryGenerateConfig
  cacheKey?: string
  generateButtonText?: string
  noSummaryText?: string
  generatePromptText?: string
}

export function SummaryDisplay({
  generateConfig,
  cacheKey,
  generateButtonText,
  noSummaryText,
  generatePromptText
}: SummaryDisplayProps) {
  const [aiSummary, setAiSummary] = useState<SubtitleSummary | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [cacheLoaded, setCacheLoaded] = useState(false)
  const storage = new Storage()

  // 加载缓存数据
  const loadCacheData = async () => {
    if (!cacheKey) return

    try {
      const cached = await storage.get<{
        aiSummary: SubtitleSummary
        timestamp: number
      }>(cacheKey)
      if (cached && cached.aiSummary) {
        const isExpired = Date.now() - cached.timestamp > 24 * 60 * 60 * 1000 // 24小时过期
        if (!isExpired) {
          setAiSummary(cached.aiSummary)
          setCacheLoaded(true)
        }
      }
    } catch (error) {
      console.error("加载缓存失败:", error)
    }
  }

  // 保存缓存数据
  const saveCacheData = async (aiSummary: SubtitleSummary) => {
    if (!cacheKey) return

    try {
      const cacheData = {
        aiSummary,
        timestamp: Date.now()
      }
      await storage.set(cacheKey, cacheData)
    } catch (error) {
      console.error("保存缓存失败:", error)
    }
  }

  // 生成AI总结
  const generateSummary = async (forceRegenerate = false) => {
    if (!generateConfig) return

    // 如果不是强制重新生成且已有缓存数据，直接使用缓存
    if (!forceRegenerate && aiSummary) {
      return
    }

    const content = generateConfig.getContent()
    if (!content) {
      toast.error("没有内容可以生成总结")
      return
    }

    try {
      setAiLoading(true)
      toast.loading(t("generatingAiSummary"))

      // 构建消息数据
      const messageData: any = {
        action: generateConfig.action,
        ...generateConfig.additionalData
      }

      // 根据不同的action设置不同的内容字段
      if (generateConfig.action === "summarizeSubtitles") {
        messageData.subtitles = content
      } else {
        messageData.content = content
        if (generateConfig.getTitle) {
          messageData.title = generateConfig.getTitle()
        }
      }

      // 通过background脚本调用AI服务
      const summary = await new Promise<SubtitleSummary>((resolve, reject) => {
        chrome.runtime.sendMessage(messageData, (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message))
            return
          }

          if (response.success) {
            resolve(response.data)
          } else {
            reject(new Error(response.error))
          }
        })
      })

      setAiSummary(summary)
      setCacheLoaded(false)

      // 保存到缓存
      await saveCacheData(summary)

      toast.dismiss()
      toast.success(t("aiSummaryGenerated") || "AI总结生成成功")
    } catch (error) {
      console.error("生成AI总结失败:", error)
      toast.dismiss()
      toast.error(
        error instanceof Error ? error.message : "总结失败，请检查AI配置"
      )
    } finally {
      setAiLoading(false)
    }
  }

  // 加载缓存数据
  useEffect(() => {
    loadCacheData()
  }, [cacheKey])
  return (
    <div className="flex-1 flex flex-col h-full">
      <div className="flex mb-2 gap-2 justify-between">
        <Button
          className="flex-grow"
          onClick={() => generateSummary(!!aiSummary)}
          disabled={aiLoading}
          size="sm"
          title={
            aiLoading
              ? t("summarizing")
              : aiSummary
                ? t("regenerate")
                : generateButtonText || t("generateAiSummary")
          }>
          {aiLoading
            ? t("summarizing")
            : aiSummary
              ? t("regenerate")
              : generateButtonText || t("generateAiSummary")}
        </Button>
      </div>

      <div className="flex-1 overflow-auto">
        <ScrollArea className="h-full">
          {!aiSummary && !aiLoading && (
            <div className="text-center py-[40px] px-[20px] text-gray-600">
              <div className="mb-[12px]">
                {noSummaryText || t("noAiSummary")}
              </div>
              <div className="text-[12px]">
                {generatePromptText || t("clickToGenerateVideoSummary")}
              </div>
            </div>
          )}

          {aiLoading && (
            <div className="text-center py-[40px] px-[20px] text-gray-600">
              {t("generatingAiSummary")}
            </div>
          )}

          {aiSummary && (
            <div className="prose p-[12px] bg-blue-50 rounded-[6px]">
              <div className="flex justify-between items-center mb-[12px]">
                <h4 className="m-0 text-[14px] text-blue-500 font-semibold">
                  {t("aiContentSummaryTitle")}
                </h4>
                {cacheLoaded && (
                  <span className="text-[12px] text-blue-500 bg-blue-50 py-[2px] px-[6px] rounded-full border border-blue-300">
                    {t("cached")}
                  </span>
                )}
              </div>

              <div className="mb-[12px]">
                <div className="text-[12px] text-gray-600 mb-[4px] font-medium">
                  {t("summary")}
                </div>
                <div className="text-[12px] leading-relaxed text-gray-800">
                  {aiSummary.summary}
                </div>
              </div>

              {aiSummary.keyPoints.length > 0 && (
                <div className="mb-[12px]">
                  <div className="text-[12px] text-gray-600 mb-[4px] font-medium">
                    {t("keyPoints")}
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
                    {t("mainTopics")}
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
        </ScrollArea>
      </div>
    </div>
  )
}

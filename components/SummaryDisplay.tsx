import React from "react"
import { ScrollArea } from "~components/ui/scroll-area"
import { Button } from "~components/ui/button"
import { t } from "~utils/i18n"
import type { SubtitleSummary } from "~utils/ai-service"

interface SummaryDisplayProps {
  aiSummary: SubtitleSummary | null
  aiLoading: boolean
  cacheLoaded: boolean
  onGenerate: () => void
  generateButtonText?: string
  noSummaryText?: string
  generatePromptText?: string
}

export function SummaryDisplay({
  aiSummary,
  aiLoading,
  cacheLoaded,
  onGenerate,
  generateButtonText,
  noSummaryText,
  generatePromptText
}: SummaryDisplayProps) {
  return (
    <div className="flex-1 flex flex-col h-full">
      {/* AI总结功能按钮 - 固定在顶部 */}
      <div className="mb-[12px]">
        <Button
          onClick={onGenerate}
          disabled={aiLoading}
          size="sm"
          className="w-full">
          {aiLoading
            ? t('summarizing')
            : aiSummary
              ? t('regenerate')
              : generateButtonText || t('generateAiSummary')}
        </Button>
      </div>
      
      <div className="flex-1 overflow-auto">
        <ScrollArea className="h-full">
          {!aiSummary && !aiLoading && (
            <div className="text-center py-[40px] px-[20px] text-gray-600">
              <div className="mb-[12px]">{noSummaryText || t('noAiSummary')}</div>
              <div className="text-[12px]">
                {generatePromptText || t('clickToGenerateVideoSummary')}
              </div>
            </div>
          )}

          {aiLoading && (
            <div className="text-center py-[40px] px-[20px] text-gray-600">
              {t('generatingAiSummary')}
            </div>
          )}

          {aiSummary && (
            <div className="prose p-[12px] bg-green-50 border border-green-300 rounded-[6px]">
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
        </ScrollArea>
      </div>
    </div>
  )
}
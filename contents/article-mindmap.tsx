import { downloadMethodList } from "@mind-elixir/export-mindmap"
import { launchMindElixir } from "@mind-elixir/open-desktop"
import styleOverride from "data-text:./mind-elixir-css-override.css"
import tailwindStyles from "data-text:~style.css"
import styleText from "data-text:mind-elixir/style.css"
import sonnerStyle from "data-text:sonner/dist/styles.css"
import {
  Brain,
  Download,
  ExternalLink,
  Maximize,
  RotateCcw
} from "lucide-react"
import type { MindElixirData } from "mind-elixir"
import type { PlasmoCSConfig, PlasmoGetStyle } from "plasmo"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"

import { Storage } from "@plasmohq/storage"

import MindElixirReact, {
  type MindElixirReactRef
} from "~components/MindElixirReact"
import { Button } from "~components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuTrigger
} from "~components/ui/dropdown-menu"
import { Toaster } from "~components/ui/sonner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~components/ui/tabs"
import { detectArticle, type ArticleInfo } from "~utils/article-detector"
import { fullscreen } from "~utils/fullscreen"
import { detectAndConvertArticle } from "~utils/html-to-markdown"
import { t } from "~utils/i18n"
import { options } from "~utils/mind-elixir"
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
  style.textContent = tailwindStyles + styleText + styleOverride + sonnerStyle
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
  const [mindmapData, setMindmapData] = useState<MindElixirData | null>(null)
  const [mindmapLoading, setMindmapLoading] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const [mindElixirLoading, setMindElixirLoading] = useState(false)
  const [aiSummary, setAiSummary] = useState<SubtitleSummary | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [cacheLoaded, setCacheLoaded] = useState(false)
  const storage = new Storage()
  const mindElixirRef = useRef<MindElixirReactRef>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  // AI总结文章
  const summarizeWithAI = async (forceRegenerate = false) => {
    if (!articleInfo) {
      toast.error(t("noArticleContent"))
      return
    }

    // 如果不是强制重新生成且已有缓存数据，直接使用缓存
    if (!forceRegenerate && aiSummary) {
      return
    }

    try {
      setAiLoading(true)
      toast.loading(t("generatingAiSummary"))

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
      toast.dismiss()
      toast.success(t("aiSummaryGenerated") || "AI总结生成成功")

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
      toast.dismiss()
      toast.error(error instanceof Error ? error.message : t("summaryFailed"))
    } finally {
      setAiLoading(false)
    }
  }

  // 生成思维导图
  const generateMindmap = async (forceRegenerate = false) => {
    if (!articleInfo) {
      toast.error("没有文章内容可以生成思维导图")
      return
    }

    // 如果不是强制重新生成且已有缓存数据，直接使用缓存
    if (!forceRegenerate && mindmapData) {
      return
    }

    try {
      setMindmapLoading(true)
      toast.loading(t("generatingMindmap"))

      // 使用智能HTML到Markdown转换
      let markdownContent = detectAndConvertArticle()
      console.log("智能HTML到Markdown转换结果:", markdownContent)

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
      console.log("生成思维导图成功", response)

      setMindmapData(response)
      toast.dismiss()
      toast.success(t("mindmapGenerated") || "思维导图生成成功")

      // 缓存结果
      const cacheKey = `article_mindmap_${btoa(articleInfo.url)}`
      const cacheData: CachedData = {
        mindmapData: response,
        aiSummary,
        timestamp: Date.now()
      }
      await storage.set(cacheKey, cacheData)
    } catch (error) {
      console.error("生成思维导图失败:", error)
      toast.dismiss()
      toast.error(
        error instanceof Error ? error.message : t("generateMindmapFailed")
      )
    } finally {
      setMindmapLoading(false)
    }
  }

  // 在 Mind Elixir 中打开思维导图
  const openInMindElixir = async () => {
    if (mindmapData) {
      setMindElixirLoading(true)
      toast.loading(t("opening") || "正在打开...")

      try {
        // 使用通用的 Mind Elixir 启动函数
        await launchMindElixir(mindmapData)
        toast.dismiss()
        toast.success(t("openedSuccessfully") || "打开成功")
      } catch (error) {
        console.error("打开 Mind Elixir 失败:", error)
        toast.dismiss()
        toast.error(
          error instanceof Error ? error.message : t("openMindElixirFailed")
        )
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
      console.error(t("checkCacheFailed"), error)
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

      try {
        const detected = detectArticle()
        if (detected) {
          setArticleInfo(detected)

          // 检查缓存
          const cachedData = await checkCache(detected.url)
          if (cachedData) {
            if (cachedData.mindmapData) {
              setMindmapData(cachedData.mindmapData)
            }
            if (cachedData.aiSummary) {
              setAiSummary(cachedData.aiSummary)
            }
            setCacheLoaded(true)
          }
        }
      } catch (error) {
        console.error(t("articleDetectionFailed"), error)
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
    <div
      ref={panelRef}
      className="w-[350px] h-[600px] bg-white border border-gray-300 rounded-[8px] p-[16px] font-sans shadow-lg fixed top-[80px] right-[20px] z-[9999] overflow-hidden flex flex-col">
      <div className="mb-[12px]">
        <div className="flex justify-between items-center mb-[8px]">
          <h3 className="m-0 text-[16px] font-semibold text-gray-900">
            {t("articleAssistant")}
          </h3>
          <Button
            onClick={() => setIsVisible(false)}
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
        </div>
        {articleInfo && (
          <div className="text-[12px] text-gray-600 leading-relaxed">
            {articleInfo.title}
          </div>
        )}
      </div>

      <Tabs
        defaultValue="summary"
        className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="summary">{t("aiSummary")}</TabsTrigger>
          <TabsTrigger value="mindmap">{t("mindmap")}</TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="flex-1 overflow-auto mt-[12px]">
          {/* AI总结功能按钮 */}
          {articleInfo && (
            <>
              <div className="flex gap-[8px]">
                <Button
                  onClick={() => summarizeWithAI(false)}
                  disabled={aiLoading}
                  size="sm"
                  className={`flex-1`}>
                  {aiLoading
                    ? t("summarizing")
                    : aiSummary
                      ? t("viewSummary")
                      : t("generateAiSummary")}
                </Button>
                {aiSummary && (
                  <Button
                    onClick={() => summarizeWithAI(true)}
                    disabled={aiLoading}
                    size="sm">
                    {t("regenerate")}
                  </Button>
                )}
              </div>
            </>
          )}

          {!aiSummary && !aiLoading && !articleInfo && (
            <div className="text-center py-[40px] px-[20px] text-gray-600">
              <div className="mb-[12px]">{t("noAiSummary")}</div>
              <div className="text-[12px]">
                {t("clickToGenerateArticleSummary")}
              </div>
            </div>
          )}

          {aiLoading && (
            <div className="text-center py-[40px] px-[20px] text-gray-600">
              {t("generatingAiSummary")}
            </div>
          )}

          {aiSummary && (
            <div className="prose p-[12px] mt-[12px] bg-green-50 border border-green-300 rounded-[6px]">
              <div className="flex justify-between items-center mb-[12px]">
                <h4 className="m-0 text-[14px] text-blue-500 font-semibold">
                  {t("aiContentSummaryTitle")}
                </h4>
                {cacheLoaded && (
                  <span className="text-[12px] text-green-500 bg-green-50 py-[2px] px-[6px] rounded-full border border-green-300">
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
        </TabsContent>

        <TabsContent value="mindmap" className="flex-1 overflow-auto mt-[12px]">
          {/* 思维导图功能按钮 */}
          {articleInfo && (
            <div className="p-[0px]">
              <div className="flex gap-[8px] mb-[8px] justify-center">
                {!mindmapData ? (
                  <Button
                    onClick={() => generateMindmap(false)}
                    disabled={mindmapLoading}
                    size="sm"
                    title={
                      mindmapLoading ? t("generating") : t("generateMindmapBtn")
                    }>
                    {mindmapLoading ? t("generating") : t("generateMindmapBtn")}
                    <Brain className="w-4 h-4" />
                  </Button>
                ) : (
                  <Button
                    onClick={() => generateMindmap(true)}
                    disabled={mindmapLoading}
                    size="sm"
                    title={t("regenerate")}>
                    {t("regenerate")}
                    <RotateCcw className="w-4 h-4" />
                  </Button>
                )}
                {mindmapData && (
                  <>
                    <Button
                      onClick={openInMindElixir}
                      disabled={mindElixirLoading}
                      size="sm"
                      title={
                        mindElixirLoading ? t("opening") : t("openInMindElixir")
                      }>
                      <ExternalLink className="w-4 h-4" />
                    </Button>
                    <Button
                      onClick={() => {
                        fullscreen(mindElixirRef.current?.instance!)
                      }}
                      size="sm"
                      title={t("fullscreen")}>
                      <Maximize className="w-4 h-4" />
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="sm" title={t("download") || "下载"}>
                          <Download className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuPortal container={panelRef.current}>
                        <DropdownMenuContent align="end">
                          {downloadMethodList.map((method) => (
                            <DropdownMenuItem
                              key={method.type}
                              onClick={() => {
                                if (mindElixirRef.current?.instance) {
                                  method.download(
                                    mindElixirRef.current.instance
                                  )
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
            </div>
          )}

          {!mindmapData && !mindmapLoading && !articleInfo && (
            <div className="text-center py-[40px] px-[20px] text-gray-600">
              <div className="mb-[12px]">{t("noMindmap")}</div>
              <div className="text-[12px]">
                {t("clickToGenerateArticleMindmap")}
              </div>
            </div>
          )}

          {mindmapLoading && (
            <div className="text-center py-[40px] px-[20px] text-gray-600">
              {t("generatingMindmap")}
            </div>
          )}

          {mindmapData && (
            <div className="h-[calc(100%-120px)] border border-gray-300 rounded-[6px] overflow-hidden mt-[12px]">
              <MindElixirReact
                data={mindmapData}
                ref={mindElixirRef}
                options={options}
              />
            </div>
          )}
        </TabsContent>
      </Tabs>
      <Toaster />
    </div>
  )
}

export default ArticleMindmapPanel

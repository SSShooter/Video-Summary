import { downloadMethodList } from "@mind-elixir/export-mindmap"
import { launchMindElixir } from "@mind-elixir/open-desktop"
import {
  Brain,
  Download,
  ExternalLink,
  Maximize,
  RotateCcw
} from "lucide-react"
import type { MindElixirData } from "mind-elixir"
import React, { useEffect, useRef, useState } from "react"
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
import { ScrollArea } from "~components/ui/scroll-area"
import { fullscreen } from "~utils/fullscreen"
import { t } from "~utils/i18n"
import { options } from "~utils/mind-elixir"

export interface MindmapGenerateConfig {
  action: string
  getContent: () => string | null
  getTitle?: () => string
  additionalData?: Record<string, any>
}

interface MindmapDisplayProps {
  panelRef: React.RefObject<HTMLDivElement>
  generateButtonText?: string
  noMindmapText?: string
  // 新增的生成配置
  generateConfig?: MindmapGenerateConfig
  cacheKey?: string
}

export function MindmapDisplay({
  panelRef,
  generateButtonText,
  noMindmapText,
  generateConfig,
  cacheKey
}: MindmapDisplayProps) {
  const mindmapRef = useRef<MindElixirReactRef>(null)
  const [mindElixirLoading, setMindElixirLoading] = useState(false)
  const [mindmapLoading, setMindmapLoading] = useState(false)
  const [mindmapData, setMindmapData] = useState<MindElixirData | null>(null)
  const [cacheLoaded, setCacheLoaded] = useState(false)
  const storage = new Storage()

  // 加载缓存数据
  const loadCacheData = async () => {
    if (!cacheKey) return

    try {
      const cached = await storage.get<{
        mindmapData: MindElixirData
        timestamp: number
      }>(cacheKey)
      if (cached && cached.mindmapData) {
        const isExpired = Date.now() - cached.timestamp > 24 * 60 * 60 * 1000 // 24小时过期
        if (!isExpired) {
          setMindmapData(cached.mindmapData)
          setCacheLoaded(true)
        }
      }
    } catch (error) {
      console.error("加载缓存失败:", error)
    }
  }

  // 保存缓存数据
  const saveCacheData = async (mindmapData: MindElixirData) => {
    if (!cacheKey) return

    try {
      const cacheData = {
        mindmapData,
        timestamp: Date.now()
      }
      await storage.set(cacheKey, cacheData)
    } catch (error) {
      console.error("保存缓存失败:", error)
    }
  }

  // 内置的生成思维导图逻辑
  const internalGenerateMindmap = async (forceRegenerate = false) => {
    if (!generateConfig) {
      console.error("generateConfig is required for internal generation")
      return
    }

    // 如果不是强制重新生成且已有缓存数据，直接使用缓存
    if (!forceRegenerate && mindmapData) {
      return
    }

    const content = generateConfig.getContent()
    if (!content) {
      toast.error("没有内容可以生成思维导图")
      return
    }

    try {
      setMindmapLoading(true)
      toast.loading(t("generatingMindmap"))

      // 构建消息数据
      const messageData: any = {
        action: generateConfig.action,
        ...generateConfig.additionalData
      }

      // 根据不同的action设置不同的内容字段
      if (generateConfig.action === "generateArticleMindmap") {
        messageData.content = content
        if (generateConfig.getTitle) {
          messageData.title = generateConfig.getTitle()
        }
      } else {
        messageData.subtitles = content
      }

      // 通过background脚本调用AI服务
      const response = await new Promise<MindElixirData>((resolve, reject) => {
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

      setMindmapData(response)
      setCacheLoaded(false)

      // 保存到缓存
      await saveCacheData(response)

      toast.dismiss()
      toast.success(t("mindmapGenerated"))
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

  const openInMindElixir = async () => {
    if (mindmapData) {
      setMindElixirLoading(true)
      toast.loading(t("opening") || "正在打开...")

      try {
        await launchMindElixir(mindmapData)
        toast.dismiss()
        toast.success(t("openedSuccessfully") || "打开成功")
      } catch (error) {
        console.error("打开 Mind Elixir 失败:", error)
        toast.dismiss()
        toast.error(
          error instanceof Error ? error.message : "打开 Mind Elixir 失败"
        )
      } finally {
        setMindElixirLoading(false)
      }
    }
  }

  // 加载缓存数据
  useEffect(() => {
    loadCacheData()
  }, [cacheKey])

  // 生成思维导图
  const handleGenerate = () => {
    if (generateConfig) {
      internalGenerateMindmap(!!mindmapData)
    }
  }

  return (
    <div className="flex-1 flex flex-col h-full">
      <div className="flex mb-2 gap-2 justify-between">
        <Button
          className="flex-grow"
          onClick={handleGenerate}
          disabled={mindmapLoading}
          size="sm"
          title={
            mindmapLoading
              ? t("generating")
              : mindmapData
                ? t("regenerate")
                : generateButtonText || t("generateMindmapBtn")
          }>
          {mindmapLoading
            ? t("generating")
            : mindmapData
              ? t("regenerate")
              : generateButtonText || t("generateMindmapBtn")}
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
              title={mindElixirLoading ? t("opening") : t("openInMindElixir")}>
              <ExternalLink className="w-4 h-4" />
            </Button>
            <Button
              onClick={() => {
                fullscreen(mindmapRef.current?.instance!)
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
          <div className="mb-[12px]">{noMindmapText || t("noMindmap")}</div>
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
        <div className="flex-1 w-full border border-gray-300 rounded-[6px] overflow-hidden">
          <MindElixirReact
            data={mindmapData}
            ref={mindmapRef}
            options={options}
          />
        </div>
      )}
    </div>
  )
}

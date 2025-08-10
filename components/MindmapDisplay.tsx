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
import React, { useRef, useState } from "react"
import { toast } from "sonner"

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
import { fullscreen } from "~utils/fullscreen"
import { t } from "~utils/i18n"
import { options } from "~utils/mind-elixir"

interface MindmapDisplayProps {
  mindmapData: MindElixirData | null
  mindmapLoading: boolean
  onGenerate: () => void
  panelRef: React.RefObject<HTMLDivElement>
  generateButtonText?: string
  noMindmapText?: string
  generatePromptText?: string
}

export function MindmapDisplay({
  mindmapData,
  mindmapLoading,
  onGenerate,
  panelRef,
  generateButtonText,
  noMindmapText,
  generatePromptText
}: MindmapDisplayProps) {
  const mindmapRef = useRef<MindElixirReactRef>(null)
  const [mindElixirLoading, setMindElixirLoading] = useState(false)

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

  return (
    <div className="flex-1 flex flex-col h-full">
      <div className="flex mb-[8px] gap-2 justify-between">
        <Button
          className="flex-grow"
          onClick={onGenerate}
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
            {generatePromptText || t("clickToGenerateVideoMindmap")}
          </div>
        </div>
      )}

      {mindmapLoading && (
        <div className="text-center py-[40px] px-[20px] text-gray-600">
          {t("generatingMindmap")}
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
  )
}

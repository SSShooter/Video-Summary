import iconBase64 from "data-base64:~assets/icon.png"
import { useEffect, useState } from "react"
import { Storage } from "@plasmohq/storage"
import { Button } from "~components/ui/button"
import type { AIConfig } from "~utils/ai-service"
import { t } from "~utils/i18n"
import "~style.css"

function IndexPopup() {
  const [aiEnabled, setAiEnabled] = useState(false)
  const [loading, setLoading] = useState(true)

  const [isVideoPage, setIsVideoPage] = useState(false)
  const [isArticlePage, setIsArticlePage] = useState(false)
  const [panelTriggering, setPanelTriggering] = useState(false)
  const storage = new Storage()

  useEffect(() => {
    loadAIStatus()
    getCurrentPageInfo()
  }, [])

  const loadAIStatus = async () => {
    try {
      const config = await storage.get<AIConfig>("aiConfig")
      setAiEnabled(config?.enabled || false)
    } catch (error) {
      console.error("加载AI配置失败:", error)
    } finally {
      setLoading(false)
    }
  }

  const getCurrentPageInfo = async () => {
    try {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.url) {
          const url = tabs[0].url

          // 检测是否为视频页面
          const isVideo =
            url.includes("youtube.com/watch") ||
            url.includes("bilibili.com/video") ||
            url.includes("bilibili.com/list/watchlater")
          setIsVideoPage(isVideo)

          // 检测是否为文章页面（排除视频网站）
          const isArticle =
            !isVideo &&
            !url.includes("youtube.com") &&
            !url.includes("bilibili.com") &&
            !url.startsWith("chrome://") &&
            !url.startsWith("chrome-extension://")
          setIsArticlePage(isArticle)
        }
      })
    } catch (error) {
      console.error("获取页面信息失败:", error)
    }
  }

  const triggerPanel = async () => {
    try {
      setPanelTriggering(true)
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
          if (isVideoPage) {
            chrome.tabs.sendMessage(tabs[0].id, {
              type: "SHOW_SUBTITLE_PANEL"
            })
          }
          if (isArticlePage) {
            chrome.tabs.sendMessage(tabs[0].id, {
              type: "SHOW_ARTICLE_MINDMAP_PANEL"
            })
          }
        }
      })

      // 延迟关闭popup，让用户看到启动状态
      setTimeout(() => {
        window.close()
      }, 500)
    } catch (error) {
      console.error("显示面板失败:", error)
      setPanelTriggering(false)
    }
  }

  const openOptionsPage = () => {
    chrome.runtime.openOptionsPage()
  }

  const getPageTypeInfo = () => {
    if (isVideoPage) {
      return {
        type: t("videoPage"),
        icon: "🎥",
        description: t("videoPageDescription"),
        actionText: t("startSubtitlePanel"),
        available: true
      }
    } else if (isArticlePage) {
      return {
        type: t("articlePage"),
        icon: "📄",
        description: t("articlePageDescription"),
        actionText: t("generateMindmap"),
        available: true
      }
    } else {
      return {
        type: t("unsupportedPage"),
        icon: "❌",
        description: t("unsupportedPageDescription"),
        actionText: t("cannotUse"),
        available: false
      }
    }
  }

  const pageInfo = getPageTypeInfo()

  return (
    <div className="w-80 bg-white">
      {/* 头部区域 */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-3 text-white">
        <div className="flex items-center mb-2">
          <img
            src={iconBase64}
            alt="Video Mindmap"
            className="w-8 h-8 mr-2 rounded-lg shadow-lg"
          />
          <div>
            <h1 className="m-0 text-base font-semibold">{t("popupTitle")}</h1>
            <p className="m-0 text-xs text-blue-100">{t("popupSubtitle")}</p>
          </div>
        </div>

        {/* 页面类型指示器 */}
        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <span className="text-lg mr-2">{pageInfo.icon}</span>
              <div>
                <div className="text-xs font-medium">{pageInfo.type}</div>
                <div className="text-xs text-blue-100">
                  {pageInfo.description}
                </div>
              </div>
            </div>
            <div
              className={`w-2 h-2 rounded-full ${pageInfo.available ? "bg-green-400" : "bg-red-400"}`}></div>
          </div>
        </div>
      </div>

      {/* 主要内容区域 */}
      <div className="p-3">
        {/* AI状态卡片 */}
        <div className="bg-gray-50 rounded-lg p-3 mb-3 border border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center">
              <div className="w-6 h-6 bg-blue-100 rounded-lg flex items-center justify-center mr-2">
                <span className="text-blue-600 text-xs">🤖</span>
              </div>
              <div>
                <div className="text-xs font-medium text-gray-800">
                  {t("aiServiceStatus")}
                </div>
                <div className="text-xs text-gray-500">
                  {t("intelligentAnalysis")}
                </div>
              </div>
            </div>
            {loading ? (
              <div className="flex items-center">
                <div className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mr-1"></div>
                <span className="text-xs text-gray-600">{t("detecting")}</span>
              </div>
            ) : (
              <div
                className={`px-2 py-1 rounded-full text-xs font-medium ${
                  aiEnabled
                    ? "bg-green-100 text-green-700 border border-green-200"
                    : "bg-orange-100 text-orange-700 border border-orange-200"
                }`}>
                {aiEnabled ? t("configured") : t("notConfigured")}
              </div>
            )}
          </div>

          {!aiEnabled && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-2">
              <div className="text-xs text-orange-700">
                {t("configureAiTip")}
              </div>
            </div>
          )}
        </div>

        {/* 快速操作区域 */}
        <div className="space-y-2 mb-3">
          <Button
            onClick={triggerPanel}
            disabled={!pageInfo.available || panelTriggering}
            variant={pageInfo.available ? "default" : "secondary"}
            size="lg"
            className="w-full h-12">
            {panelTriggering ? (
              <>
                <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin mr-2"></div>
                <span>{t("starting")}</span>
              </>
            ) : (
              <>
                <span className="text-base mr-2">
                  {pageInfo.available ? "🚀" : "🚫"}
                </span>
                <span>{pageInfo.actionText}</span>
              </>
            )}
          </Button>

          <Button
            onClick={openOptionsPage}
            variant="outline"
            size="default"
            className="w-full">
            <span className="text-base mr-2">⚙️</span>
            <span>
              {aiEnabled ? t("aiConfigManagement") : t("configureAiService")}
            </span>
          </Button>
        </div>

        {/* 功能说明 */}
        <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
          <div className="text-xs font-medium text-blue-800 mb-2">
            {t("features")}
          </div>
          <div className="space-y-1 text-xs text-blue-700">
            <div className="flex items-center">
              <span className="w-1 h-1 bg-blue-400 rounded-full mr-2"></span>
              <span>{t("autoSubtitleExtraction")}</span>
            </div>
            <div className="flex items-center">
              <span className="w-1 h-1 bg-blue-400 rounded-full mr-2"></span>
              <span>{t("aiContentSummary")}</span>
            </div>
            <div className="flex items-center">
              <span className="w-1 h-1 bg-blue-400 rounded-full mr-2"></span>
              <span>{t("articleMindmap")}</span>
            </div>
            <div className="flex items-center">
              <span className="w-1 h-1 bg-blue-400 rounded-full mr-2"></span>
              <span>{t("oneClickJump")}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default IndexPopup

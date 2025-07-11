import { useState, useEffect } from "react"
import { Storage } from "@plasmohq/storage"
import type { AIConfig } from "~utils/ai-service"
import { t } from "~utils/i18n"
import iconBase64 from "data-base64:~assets/icon.png"
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
          const isVideo = url.includes('youtube.com/watch') ||
            url.includes('bilibili.com/video') ||
            url.includes('bilibili.com/list/watchlater')
          setIsVideoPage(isVideo)

          // 检测是否为文章页面（排除视频网站）
          const isArticle = !isVideo &&
            !url.includes('youtube.com') &&
            !url.includes('bilibili.com') &&
            !url.startsWith('chrome://') &&
            !url.startsWith('chrome-extension://')
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

      // 模拟操作完成
      setTimeout(() => {
        setPanelTriggering(false)
      }, 1000)
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
    <div className="w-96 bg-white">
      {/* 头部区域 */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-4 text-white">
        <div className="flex items-center mb-3">
          <img
            src={iconBase64}
            alt="Video Mindmap"
            className="w-10 h-10 mr-3 rounded-lg shadow-lg"
          />
          <div>
            <h1 className="m-0 text-lg font-semibold">{t("popupTitle")}</h1>
            <p className="m-0 text-sm text-blue-100">{t("popupSubtitle")}</p>
          </div>
        </div>

        {/* 页面类型指示器 */}
        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <span className="text-xl mr-2">{pageInfo.icon}</span>
              <div>
                <div className="text-sm font-medium">{pageInfo.type}</div>
                <div className="text-xs text-blue-100">{pageInfo.description}</div>
              </div>
            </div>
            <div className={`w-3 h-3 rounded-full ${pageInfo.available ? 'bg-green-400' : 'bg-red-400'}`}></div>
          </div>
        </div>
      </div>

      {/* 主要内容区域 */}
      <div className="p-4">
        {/* AI状态卡片 */}
        <div className="bg-gray-50 rounded-xl p-4 mb-4 border border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
                <span className="text-blue-600 text-sm">🤖</span>
              </div>
              <div>
                <div className="text-sm font-medium text-gray-800">{t("aiServiceStatus")}</div>
                <div className="text-xs text-gray-500">{t("intelligentAnalysis")}</div>
              </div>
            </div>
            {loading ? (
              <div className="flex items-center">
                <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mr-2"></div>
                <span className="text-xs text-gray-600">{t("detecting")}</span>
              </div>
            ) : (
              <div className={`px-3 py-1 rounded-full text-xs font-medium ${aiEnabled
                  ? 'bg-green-100 text-green-700 border border-green-200'
                  : 'bg-orange-100 text-orange-700 border border-orange-200'
                }`}>
                {aiEnabled ? t("configured") : t("notConfigured")}
              </div>
            )}
          </div>

          {!aiEnabled && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-3">
              <div className="text-xs text-orange-700">
                {t("configureAiTip")}
              </div>
            </div>
          )}
        </div>

        {/* 快速操作区域 */}
        <div className="space-y-3 mb-4">
          <button
            onClick={triggerPanel}
            disabled={!pageInfo.available || panelTriggering}
            className={`w-full p-4 rounded-xl border-2 transition-all duration-200 ${pageInfo.available && !panelTriggering
                ? 'border-blue-200 bg-blue-50 hover:bg-blue-100 hover:border-blue-300 text-blue-700'
                : 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'
              }`}
          >
            <div className="flex items-center justify-center">
              {panelTriggering ? (
                <>
                  <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mr-2"></div>
                  <span className="font-medium">{t("starting")}</span>
                </>
              ) : (
                <>
                  <span className="text-lg mr-2">{pageInfo.available ? '🚀' : '🚫'}</span>
                  <span className="font-medium">{pageInfo.actionText}</span>
                </>
              )}
            </div>
          </button>

          <button
            onClick={openOptionsPage}
            className="w-full p-3 bg-white border-2 border-gray-200 rounded-xl hover:border-gray-300 hover:bg-gray-50 transition-all duration-200"
          >
            <div className="flex items-center justify-center text-gray-700">
              <span className="text-lg mr-2">⚙️</span>
              <span className="font-medium">{aiEnabled ? t("aiConfigManagement") : t("configureAiService")}</span>
            </div>
          </button>
        </div>

        {/* 功能说明 */}
        <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
          <div className="text-sm font-medium text-blue-800 mb-2">{t("features")}</div>
          <div className="space-y-1 text-xs text-blue-700">
            <div className="flex items-center">
              <span className="w-1.5 h-1.5 bg-blue-400 rounded-full mr-2"></span>
              <span>{t("autoSubtitleExtraction")}</span>
            </div>
            <div className="flex items-center">
              <span className="w-1.5 h-1.5 bg-blue-400 rounded-full mr-2"></span>
              <span>{t("aiContentSummary")}</span>
            </div>
            <div className="flex items-center">
              <span className="w-1.5 h-1.5 bg-blue-400 rounded-full mr-2"></span>
              <span>{t("articleMindmap")}</span>
            </div>
            <div className="flex items-center">
              <span className="w-1.5 h-1.5 bg-blue-400 rounded-full mr-2"></span>
              <span>{t("oneClickJump")}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default IndexPopup

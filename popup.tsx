import { useState, useEffect } from "react"
import { Storage } from "@plasmohq/storage"
import type { AIConfig } from "~utils/ai-service"
import iconBase64 from "data-base64:~assets/icon.png"
import "~style.css"

function IndexPopup() {
  const [aiEnabled, setAiEnabled] = useState(false)
  const [loading, setLoading] = useState(true)
  const storage = new Storage()

  useEffect(() => {
    loadAIStatus()
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



  const triggerPanel = async () => {
    try {
      // 通知content script显示字幕面板
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
          chrome.tabs.sendMessage(tabs[0].id, {
            type: "SHOW_SUBTITLE_PANEL"
          })
          chrome.tabs.sendMessage(tabs[0].id, {
            type: "SHOW_ARTICLE_MINDMAP_PANEL"
          })
        }
      })
    } catch (error) {
      console.error("显示字幕面板失败:", error)
    }
  }


  const openOptionsPage = () => {
    chrome.runtime.openOptionsPage()
  }

  return (
    <div className="w-80 p-3">
      <div className="flex items-center mb-2">
        <img
          src={iconBase64}
          alt="Video Mindmap"
          className="w-8 h-8 mr-3"
        />
        <h2 className="m-0 text-lg text-gray-800">视频字幕助手</h2>
      </div>

      <div className="bg-gray-50 p-3 rounded-md mb-2">
        <div className="text-sm text-gray-600 mb-2">功能状态</div>

        <div className="flex justify-between items-center mb-2">
          <span className="text-xs text-gray-800">AI 配置</span>
          {loading ? (
            <span className="text-xs text-gray-600">加载中...</span>
          ) : (
            <span className={`py-0.5 px-2 text-white text-xs rounded-full ${aiEnabled ? 'bg-green-500' : 'bg-orange-500'
              }`}>{aiEnabled ? '已启用' : '未配置'}</span>
          )}
        </div>

        <div className="flex justify-between items-center mb-2">
          <span className="text-xs text-gray-800">AI 面板</span>
          <button
            onClick={triggerPanel}
            className="py-1 px-3 text-white text-xs rounded bg-blue-500 hover:bg-blue-600 transition-colors duration-200"
          >
            显示
          </button>
        </div>

      </div>

      <div className="mb-2">
        <div className="text-sm text-gray-600 mb-2">使用说明</div>
        <ul className="m-0 pl-4 text-xs text-gray-600 leading-relaxed">
          <li>访问YouTube或Bilibili视频页面</li>
          <li>字幕面板会自动显示在右侧</li>
          <li>点击字幕可跳转到对应时间</li>
          <li>配置AI后可使用智能总结功能</li>
          <li>访问文章页面可生成思维导图</li>
        </ul>
      </div>

      <button
        onClick={openOptionsPage}
        className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white border-none rounded text-sm cursor-pointer mb-3"
      >
        {aiEnabled ? 'AI配置管理' : '配置AI总结'}
      </button>

    </div>
  )
}

export default IndexPopup

import { useState, useEffect } from "react"
import { Storage } from "@plasmohq/storage"
import type { AIConfig } from "~utils/ai-service"
import iconBase64 from "data-base64:~assets/icon.png"
import "~style.css"

function IndexPopup() {
  const [aiEnabled, setAiEnabled] = useState(false)
  const [subtitleEnabled, setSubtitleEnabled] = useState(true)
  const [loading, setLoading] = useState(true)
  const storage = new Storage()

  useEffect(() => {
    loadAIStatus()
    loadSubtitleStatus()
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

  const loadSubtitleStatus = async () => {
    try {
      const enabled = await storage.get<boolean>("subtitleEnabled")
      setSubtitleEnabled(enabled !== false) // 默认为true
    } catch (error) {
      console.error("加载字幕配置失败:", error)
    }
  }

  const toggleSubtitle = async () => {
    const newStatus = !subtitleEnabled
    setSubtitleEnabled(newStatus)
    try {
      await storage.set("subtitleEnabled", newStatus)
      // 通知content script更新字幕显示状态
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
          chrome.tabs.sendMessage(tabs[0].id, {
            type: "TOGGLE_SUBTITLE",
            enabled: newStatus
          })
        }
      })
    } catch (error) {
      console.error("保存字幕配置失败:", error)
      setSubtitleEnabled(!newStatus) // 回滚状态
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
          <span className="text-xs text-gray-800">字幕显示</span>
          <label className="flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={subtitleEnabled}
              onChange={toggleSubtitle}
              className="mr-1.5 scale-110"
            />
            <span className={`py-0.5 px-2 text-white text-xs rounded-full ${
              subtitleEnabled ? 'bg-green-500' : 'bg-gray-400'
            }`}>{subtitleEnabled ? '已启用' : '已禁用'}</span>
          </label>
        </div>
        
        <div className="flex justify-between items-center">
          <span className="text-xs text-gray-800">AI总结</span>
          {loading ? (
            <span className="text-xs text-gray-600">加载中...</span>
          ) : (
            <span className={`py-0.5 px-2 text-white text-xs rounded-full ${
              aiEnabled ? 'bg-green-500' : 'bg-orange-500'
            }`}>{aiEnabled ? '已启用' : '未配置'}</span>
          )}
        </div>
      </div>
      
      <div className="mb-2">
        <div className="text-sm text-gray-600 mb-2">使用说明</div>
        <ul className="m-0 pl-4 text-xs text-gray-600 leading-relaxed">
          <li>访问YouTube或Bilibili视频页面</li>
          <li>字幕面板会自动显示在右侧</li>
          <li>点击字幕可跳转到对应时间</li>
          <li>配置AI后可使用智能总结功能</li>
        </ul>
      </div>
      
      <button
        onClick={openOptionsPage}
        className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white border-none rounded text-sm cursor-pointer mb-3"
      >
        {aiEnabled ? 'AI配置管理' : '配置AI总结'}
      </button>
      
      <div className="text-center text-xs text-gray-400">
        支持平台: YouTube • Bilibili
      </div>
    </div>
  )
}

export default IndexPopup

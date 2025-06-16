import { useState, useEffect } from "react"
import { Storage } from "@plasmohq/storage"
import type { AIConfig } from "~utils/ai-service"
import iconBase64 from "data-base64:~assets/icon.png"

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
    <div
      style={{
        width: 320,
        padding: 0,
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        marginBottom: 8
      }}>
        <img 
          src={iconBase64} 
          alt="Video Mindmap" 
          style={{ width: 32, height: 32, marginRight: 12 }}
        />
        <h2 style={{
          margin: 0,
          fontSize: 18,
          color: '#333'
        }}>视频字幕助手</h2>
      </div>
      
      <div style={{
        backgroundColor: '#f8f9fa',
        padding: 12,
        borderRadius: 6,
        marginBottom: 8
      }}>
        <div style={{
          fontSize: 14,
          color: '#666',
          marginBottom: 8
        }}>功能状态</div>
        
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 8
        }}>
          <span style={{ fontSize: 13, color: '#333' }}>字幕显示</span>
          <label style={{
            display: 'flex',
            alignItems: 'center',
            cursor: 'pointer'
          }}>
            <input
              type="checkbox"
              checked={subtitleEnabled}
              onChange={toggleSubtitle}
              style={{
                marginRight: 6,
                transform: 'scale(1.2)'
              }}
            />
            <span style={{
              padding: '2px 8px',
              backgroundColor: subtitleEnabled ? '#4caf50' : '#ccc',
              color: 'white',
              fontSize: 11,
              borderRadius: 12
            }}>{subtitleEnabled ? '已启用' : '已禁用'}</span>
          </label>
        </div>
        
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span style={{ fontSize: 13, color: '#333' }}>AI总结</span>
          {loading ? (
            <span style={{ fontSize: 11, color: '#666' }}>加载中...</span>
          ) : (
            <span style={{
              padding: '2px 8px',
              backgroundColor: aiEnabled ? '#4caf50' : '#ff9800',
              color: 'white',
              fontSize: 11,
              borderRadius: 12
            }}>{aiEnabled ? '已启用' : '未配置'}</span>
          )}
        </div>
      </div>
      
      <div style={{
        marginBottom: 8
      }}>
        <div style={{
          fontSize: 14,
          color: '#666',
          marginBottom: 8
        }}>使用说明</div>
        <ul style={{
          margin: 0,
          paddingLeft: 16,
          fontSize: 12,
          color: '#666',
          lineHeight: 1.5
        }}>
          <li>访问YouTube或Bilibili视频页面</li>
          <li>字幕面板会自动显示在右侧</li>
          <li>点击字幕可跳转到对应时间</li>
          <li>配置AI后可使用智能总结功能</li>
        </ul>
      </div>
      
      <button
        onClick={openOptionsPage}
        style={{
          width: '100%',
          padding: '10px 16px',
          backgroundColor: '#1976d2',
          color: 'white',
          border: 'none',
          borderRadius: 6,
          fontSize: 14,
          cursor: 'pointer',
          marginBottom: 12
        }}
      >
        {aiEnabled ? 'AI配置管理' : '配置AI总结'}
      </button>
      
      <div style={{
        textAlign: 'center',
        fontSize: 11,
        color: '#999'
      }}>
        支持平台: YouTube • Bilibili
      </div>
    </div>
  )
}

export default IndexPopup

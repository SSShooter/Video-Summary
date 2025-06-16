import type { PlasmoCSConfig } from "plasmo"
import { useEffect, useState } from "react"
import { createRoot } from "react-dom/client"
import { Storage } from "@plasmohq/storage"
import { aiService, type SubtitleSummary } from "../utils/ai-service"

export const config: PlasmoCSConfig = {
  matches: ["https://www.youtube.com/watch*"],
  all_frames: false
}

interface SubtitleItem {
  start: number
  dur: number
  text: string
}

interface VideoInfo {
  videoId: string
  title: string
}

function YouTubeSubtitlePanel() {
  const [subtitles, setSubtitles] = useState<SubtitleItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null)
  const [availableLanguages, setAvailableLanguages] = useState<any[]>([])
  const [selectedLanguage, setSelectedLanguage] = useState<string>('')
  const [aiSummary, setAiSummary] = useState<SubtitleSummary | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [showSummary, setShowSummary] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const storage = new Storage()

  // 从URL中提取视频ID
  const extractVideoId = (): string | null => {
    const url = window.location.href
    const match = url.match(/[?&]v=([^&]+)/)
    return match ? match[1] : null
  }

  // 获取视频标题
  const getVideoTitle = (): string => {
    const titleElement = document.querySelector('h1.ytd-watch-metadata yt-formatted-string, h1.title')
    return titleElement?.textContent || '未知标题'
  }

  // 从YouTube播放器获取字幕信息
  const getSubtitleTracksFromPlayer = (): any[] => {
    try {
      // 尝试从ytInitialPlayerResponse获取
      const scripts = document.querySelectorAll('script')
      for (const script of scripts) {
        const content = script.textContent || ''
        if (content.includes('ytInitialPlayerResponse')) {
          const match = content.match(/var ytInitialPlayerResponse = ({.+?});/)
          if (match) {
            const playerResponse = JSON.parse(match[1])
            const captions = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks
            if (captions) {
              console.log('找到字幕轨道:', captions)
              return captions
            }
          }
        }
      }

      // 尝试从window.ytInitialPlayerResponse获取
      const windowPlayerResponse = (window as any).ytInitialPlayerResponse
      if (windowPlayerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks) {
        console.log('从window对象找到字幕轨道')
        return windowPlayerResponse.captions.playerCaptionsTracklistRenderer.captionTracks
      }

      return []
    } catch (error) {
      console.error('获取字幕轨道失败:', error)
      return []
    }
  }

  // 获取字幕数据
  const fetchSubtitles = async (videoId: string) => {
    try {
      setLoading(true)
      setError(null)
      
      console.log('开始获取YouTube字幕，视频ID:', videoId)
      
      // 获取可用的字幕轨道
      const captionTracks = getSubtitleTracksFromPlayer()
      
      if (!captionTracks || captionTracks.length === 0) {
        setError('该视频暂无字幕')
        return
      }
      
      setAvailableLanguages(captionTracks)
      
      // 选择字幕语言（优先中文，然后英文，最后第一个可用的）
      let selectedTrack = captionTracks.find(track => 
        track.languageCode === 'zh' || track.languageCode === 'zh-CN' || track.languageCode === 'zh-Hans'
      )
      
      if (!selectedTrack) {
        selectedTrack = captionTracks.find(track => track.languageCode === 'en')
      }
      
      if (!selectedTrack) {
        selectedTrack = captionTracks[0]
      }
      
      setSelectedLanguage(selectedTrack.languageCode)
      
      // 获取字幕内容
      await loadSubtitleContent(selectedTrack.baseUrl)
      
    } catch (error) {
      console.error('获取YouTube字幕失败:', error)
      setError('获取字幕失败: ' + (error as Error).message)
    } finally {
      setLoading(false)
    }
  }

  // 加载字幕内容
  const loadSubtitleContent = async (subtitleUrl: string) => {
    try {
      console.log('加载字幕内容:', subtitleUrl)
      
      // 添加格式参数以获取JSON格式的字幕
      const url = new URL(subtitleUrl)
      url.searchParams.set('fmt', 'json3')
      
      const response = await fetch(url.toString())
      const data = await response.json()
      
      console.log('字幕数据:', data)
      
      if (data.events && Array.isArray(data.events)) {
        // 处理YouTube的字幕格式
        const processedSubtitles: SubtitleItem[] = []
        
        for (const event of data.events) {
          if (event.segs && Array.isArray(event.segs)) {
            for (const seg of event.segs) {
              if (seg.utf8) {
                processedSubtitles.push({
                  start: event.tStartMs / 1000,
                  dur: event.dDurationMs / 1000,
                  text: seg.utf8.replace(/\n/g, ' ').trim()
                })
              }
            }
          }
        }
        
        setSubtitles(processedSubtitles)
        console.log('字幕加载成功，共', processedSubtitles.length, '条')
      } else {
        console.error('YouTube字幕数据格式错误:', data)
        setError('字幕数据格式错误：期望包含events数组')
      }
    } catch (error) {
      console.error('加载字幕内容失败:', error)
      setError('加载字幕内容失败: ' + (error as Error).message)
    }
  }

  // 切换字幕语言
  const changeSubtitleLanguage = async (languageCode: string) => {
    const track = availableLanguages.find(t => t.languageCode === languageCode)
    if (track) {
      setSelectedLanguage(languageCode)
      setSubtitles([])
      await loadSubtitleContent(track.baseUrl)
    }
  }

  // 格式化时间
  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  // 跳转到指定时间
  const jumpToTime = (time: number) => {
    const video = document.querySelector('video') as HTMLVideoElement
    if (video) {
      video.currentTime = time
    }
  }

  // AI总结字幕
  const summarizeWithAI = async () => {
    if (subtitles.length === 0) {
      setAiError('没有字幕内容可以总结')
      return
    }

    try {
      setAiLoading(true)
      setAiError(null)
      
      const summary = await aiService.summarizeSubtitles(subtitles)
      
      setAiSummary(summary)
      setShowSummary(true)
    } catch (error) {
      console.error('AI总结失败:', error)
      setAiError(error instanceof Error ? error.message : '总结失败，请检查AI配置')
    } finally {
      setAiLoading(false)
    }
  }

  useEffect(() => {
    const videoId = extractVideoId()
    if (videoId) {
      const title = getVideoTitle()
      setVideoInfo({ videoId, title })
      
      // 延迟获取字幕，等待页面完全加载
      setTimeout(() => {
        fetchSubtitles(videoId)
      }, 2000)
    }

    // 加载字幕显示状态
    loadSubtitleVisibility()

    // 监听来自popup的消息
    const messageListener = (message: any) => {
      if (message.type === 'TOGGLE_SUBTITLE') {
        setIsVisible(message.enabled)
      }
    }

    chrome.runtime.onMessage.addListener(messageListener)

    return () => {
      chrome.runtime.onMessage.removeListener(messageListener)
    }
  }, [])

  const loadSubtitleVisibility = async () => {
    try {
      const enabled = await storage.get<boolean>("subtitleEnabled")
      setIsVisible(enabled !== false) // 默认为true
    } catch (error) {
      console.error("加载字幕显示状态失败:", error)
    }
  }

  // 监听页面变化
  useEffect(() => {
    const handleUrlChange = () => {
      const newVideoId = extractVideoId()
      if (newVideoId && newVideoId !== videoInfo?.videoId) {
        const title = getVideoTitle()
        setVideoInfo({ videoId: newVideoId, title })
        setSubtitles([])
        setError(null)
        setTimeout(() => {
          fetchSubtitles(newVideoId)
        }, 2000)
      }
    }

    // 监听pushstate和popstate事件
    const originalPushState = history.pushState
    history.pushState = function(...args) {
      originalPushState.apply(history, args)
      setTimeout(handleUrlChange, 1000)
    }

    window.addEventListener('popstate', handleUrlChange)

    return () => {
      history.pushState = originalPushState
      window.removeEventListener('popstate', handleUrlChange)
    }
  }, [videoInfo?.videoId])

  if (!isVisible) {
    return null
  }

  return (
    <div style={{
      width: '350px',
      height: '600px',
      backgroundColor: '#fff',
      border: '1px solid #e0e0e0',
      borderRadius: '8px',
      padding: '16px',
      fontSize: '14px',
      fontFamily: 'Roboto, Arial, sans-serif',
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      position: 'fixed',
      top: '80px',
      right: '20px',
      zIndex: 9999,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <div style={{
        borderBottom: '1px solid #e0e0e0',
        paddingBottom: '12px',
        marginBottom: '12px'
      }}>
        <h3 style={{
          margin: '0 0 8px 0',
          fontSize: '16px',
          fontWeight: '500',
          color: '#030303'
        }}>YouTube字幕</h3>
        {videoInfo && (
          <div style={{
            fontSize: '12px',
            color: '#606060',
            lineHeight: '1.4',
            marginBottom: '8px'
          }}>
            {videoInfo.title}
          </div>
        )}
        
        {availableLanguages.length > 0 && (
          <select 
            value={selectedLanguage}
            onChange={(e) => changeSubtitleLanguage(e.target.value)}
            style={{
              width: '100%',
              padding: '4px 8px',
              fontSize: '12px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              backgroundColor: '#fff',
              marginBottom: '8px'
            }}
          >
            {availableLanguages.map((lang) => (
              <option key={lang.languageCode} value={lang.languageCode}>
                {lang.name?.simpleText || lang.languageCode}
              </option>
            ))}
          </select>
        )}
        
        {/* AI总结按钮 */}
        {subtitles.length > 0 && (
          <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
            <button
              onClick={summarizeWithAI}
              disabled={aiLoading}
              style={{
                flex: 1,
                padding: '6px 12px',
                fontSize: '12px',
                backgroundColor: aiLoading ? '#ccc' : '#1976d2',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: aiLoading ? 'not-allowed' : 'pointer',
                transition: 'background-color 0.2s'
              }}
            >
              {aiLoading ? '总结中...' : 'AI总结'}
            </button>
            {aiSummary && (
              <button
                onClick={() => setShowSummary(!showSummary)}
                style={{
                  padding: '6px 12px',
                  fontSize: '12px',
                  backgroundColor: showSummary ? '#f44336' : '#4caf50',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                {showSummary ? '隐藏' : '显示'}
              </button>
            )}
          </div>
        )}
        
        {/* AI错误信息 */}
        {aiError && (
          <div style={{
            padding: '8px',
            backgroundColor: '#ffebee',
            border: '1px solid #f44336',
            borderRadius: '4px',
            fontSize: '12px',
            color: '#d32f2f',
            marginBottom: '8px'
          }}>
            {aiError}
          </div>
        )}
      </div>
      
      <div style={{
        flex: 1,
        overflow: 'auto'
      }}>
        {/* AI总结内容 */}
        {showSummary && aiSummary && (
          <div style={{
            marginBottom: '16px',
            padding: '12px',
            backgroundColor: '#f8f9fa',
            border: '1px solid #e0e0e0',
            borderRadius: '6px'
          }}>
            <h4 style={{
              margin: '0 0 8px 0',
              fontSize: '14px',
              color: '#1976d2',
              fontWeight: '600'
            }}>AI内容总结</h4>
            
            <div style={{
              marginBottom: '12px'
            }}>
              <div style={{
                fontSize: '12px',
                color: '#666',
                marginBottom: '4px',
                fontWeight: '500'
              }}>概要:</div>
              <div style={{
                fontSize: '13px',
                lineHeight: '1.4',
                color: '#333'
              }}>{aiSummary.summary}</div>
            </div>
            
            {aiSummary.keyPoints.length > 0 && (
              <div style={{
                marginBottom: '12px'
              }}>
                <div style={{
                  fontSize: '12px',
                  color: '#666',
                  marginBottom: '4px',
                  fontWeight: '500'
                }}>关键要点:</div>
                <ul style={{
                  margin: 0,
                  paddingLeft: '16px',
                  fontSize: '12px',
                  lineHeight: '1.4',
                  color: '#333'
                }}>
                  {aiSummary.keyPoints.map((point, index) => (
                    <li key={index} style={{ marginBottom: '2px' }}>{point}</li>
                  ))}
                </ul>
              </div>
            )}
            
            {aiSummary.topics.length > 0 && (
              <div>
                <div style={{
                  fontSize: '12px',
                  color: '#666',
                  marginBottom: '4px',
                  fontWeight: '500'
                }}>主要话题:</div>
                <div style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '4px'
                }}>
                  {aiSummary.topics.map((topic, index) => (
                    <span
                      key={index}
                      style={{
                        padding: '2px 6px',
                        backgroundColor: '#e3f2fd',
                        color: '#1976d2',
                        fontSize: '11px',
                        borderRadius: '12px',
                        border: '1px solid #bbdefb'
                      }}
                    >
                      {topic}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        {loading && (
          <div style={{
            textAlign: 'center',
            padding: '20px',
            color: '#606060'
          }}>加载中...</div>
        )}
        
        {error && (
          <div style={{
            textAlign: 'center',
            padding: '20px',
            color: '#d93025'
          }}>{error}</div>
        )}
        
        {subtitles.length > 0 && (
          <div>
            {subtitles.map((subtitle, index) => (
              <div
                key={index}
                style={{
                  padding: '8px 0',
                  borderBottom: '1px solid #f0f0f0',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f8f9fa'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent'
                }}
                onClick={() => jumpToTime(subtitle.start)}
              >
                <div style={{
                  fontSize: '12px',
                  color: '#1976d2',
                  marginBottom: '4px',
                  fontWeight: '500'
                }}>
                  {formatTime(subtitle.start)} - {formatTime(subtitle.start + subtitle.dur)}
                </div>
                <div style={{
                  color: '#030303',
                  lineHeight: '1.4'
                }}>
                  {subtitle.text}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// 注入字幕面板
function injectYouTubeSubtitlePanel() {
  // 检查是否已经注入
  if (document.getElementById('youtube-subtitle-panel')) {
    return
  }
  
  // 等待页面加载完成
  const checkAndInject = () => {
    const videoContainer = document.querySelector('#movie_player, .html5-video-player')
    if (videoContainer && window.location.href.includes('/watch')) {
      const container = document.createElement('div')
      container.id = 'youtube-subtitle-panel'
      document.body.appendChild(container)
      
      const root = createRoot(container)
      root.render(<YouTubeSubtitlePanel />)
    } else {
      // 如果还没找到视频容器，继续等待
      setTimeout(checkAndInject, 1000)
    }
  }
  
  checkAndInject()
}

// 页面加载完成后注入
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', injectYouTubeSubtitlePanel)
} else {
  injectYouTubeSubtitlePanel()
}

// 监听路由变化（YouTube是SPA应用）
let currentUrl = window.location.href
const observer = new MutationObserver(() => {
  if (window.location.href !== currentUrl) {
    currentUrl = window.location.href
    // 移除旧的面板
    const oldPanel = document.getElementById('youtube-subtitle-panel')
    if (oldPanel) {
      oldPanel.remove()
    }
    // 重新注入
    if (window.location.href.includes('/watch')) {
      setTimeout(injectYouTubeSubtitlePanel, 1000)
    }
  }
})

observer.observe(document.body, {
  childList: true,
  subtree: true
})

export default YouTubeSubtitlePanel
import type { PlasmoCSConfig, PlasmoGetStyle } from "plasmo"
import { useEffect, useState } from "react"
import { createRoot } from "react-dom/client"
import { Storage } from "@plasmohq/storage"
import { aiService, type SubtitleSummary } from "../utils/ai-service"
import tailwindStyles from "data-text:~style.css"

export const config: PlasmoCSConfig = {
  matches: ["https://www.youtube.com/watch*"],
  all_frames: false
}

export const getStyle: PlasmoGetStyle = () => {
  const style = document.createElement("style")
  style.textContent = tailwindStyles
  return style
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

    // 监听来自popup的消息
    const messageListener = (message: any) => {
      if (message.type === "SHOW_SUBTITLE_PANEL") {
        setIsVisible(true)
      }
    }

    chrome.runtime.onMessage.addListener(messageListener)

    return () => {
      chrome.runtime.onMessage.removeListener(messageListener)
    }
  }, [])



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
    <div className="w-[350px] h-[600px] bg-white border border-gray-300 rounded-lg p-4 text-sm font-sans shadow-lg fixed top-20 right-5 z-[9999] overflow-hidden flex flex-col">
      <div className="border-b border-gray-300 pb-3 mb-3">
        <h3 className="m-0 mb-2 text-base font-medium text-gray-900">YouTube字幕</h3>
        {videoInfo && (
          <div className="text-xs text-gray-600 leading-relaxed mb-2">
            {videoInfo.title}
          </div>
        )}
        
        {availableLanguages.length > 0 && (
          <select 
            value={selectedLanguage}
            onChange={(e) => changeSubtitleLanguage(e.target.value)}
            className="w-full py-1 px-2 text-xs border border-gray-400 rounded bg-white mb-2"
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
          <div className="flex gap-2 mb-2">
            <button
              onClick={summarizeWithAI}
              disabled={aiLoading}
              className={`flex-1 py-1.5 px-3 text-xs text-white border-none rounded transition-colors duration-200 ${
                aiLoading ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-700 cursor-pointer hover:bg-blue-800'
              }`}
            >
              {aiLoading ? '总结中...' : 'AI总结'}
            </button>
            {aiSummary && (
              <button
                onClick={() => setShowSummary(!showSummary)}
                className={`py-1.5 px-3 text-xs text-white border-none rounded cursor-pointer ${
                  showSummary ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'
                }`}
              >
                {showSummary ? '隐藏' : '显示'}
              </button>
            )}
          </div>
        )}
        
        {/* AI错误信息 */}
        {aiError && (
          <div className="p-2 bg-red-50 border border-red-400 rounded text-xs text-red-700 mb-2">
            {aiError}
          </div>
        )}
      </div>
      
      <div className="flex-1 overflow-auto">
        {/* AI总结内容 */}
        {showSummary && aiSummary && (
          <div className="mb-4 p-3 bg-gray-50 border border-gray-300 rounded-md">
            <h4 className="m-0 mb-2 text-sm text-blue-700 font-semibold">AI内容总结</h4>
            
            <div className="mb-3">
              <div className="text-xs text-gray-600 mb-1 font-medium">概要:</div>
              <div className="text-xs leading-relaxed text-gray-800">{aiSummary.summary}</div>
            </div>
            
            {aiSummary.keyPoints.length > 0 && (
              <div className="mb-3">
                <div className="text-xs text-gray-600 mb-1 font-medium">关键要点:</div>
                <ul className="m-0 pl-4 text-xs leading-relaxed text-gray-800">
                  {aiSummary.keyPoints.map((point, index) => (
                    <li key={index} className="mb-0.5">{point}</li>
                  ))}
                </ul>
              </div>
            )}
            
            {aiSummary.topics.length > 0 && (
              <div>
                <div className="text-xs text-gray-600 mb-1 font-medium">主要话题:</div>
                <div className="flex flex-wrap gap-1">
                  {aiSummary.topics.map((topic, index) => (
                    <span
                      key={index}
                      className="py-0.5 px-1.5 bg-blue-50 text-blue-700 text-[11px] rounded-full border border-blue-200"
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
          <div className="text-center py-5 text-gray-600">加载中...</div>
        )}
        
        {error && (
          <div className="text-center py-5 text-red-600">{error}</div>
        )}
        
        {subtitles.length > 0 && (
          <div>
            {subtitles.map((subtitle, index) => (
              <div
                key={index}
                className="py-2 border-b border-gray-200 cursor-pointer transition-colors duration-200 hover:bg-gray-50"
                onClick={() => jumpToTime(subtitle.start)}
              >
                <div className="text-xs text-blue-700 mb-1 font-medium">
                  {formatTime(subtitle.start)} - {formatTime(subtitle.start + subtitle.dur)}
                </div>
                <div className="text-gray-900 leading-relaxed">
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
import type { PlasmoCSConfig, PlasmoGetStyle } from "plasmo"
import { useEffect, useState } from "react"
import { createRoot } from "react-dom/client"
import styleText from "data-text:mind-elixir/style"
import styleOverride from "data-text:./mind-elixir-css-override.css"
import tailwindStyles from "data-text:~style.css"
import { SubtitlePanel } from "~components/SubtitlePanel"

export const config: PlasmoCSConfig = {
  matches: ["https://www.youtube.com/watch*"],
  all_frames: false
}

export const getStyle: PlasmoGetStyle = () => {
  const style = document.createElement("style")
  style.textContent = tailwindStyles + styleText + styleOverride
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
  const [isVisible, setIsVisible] = useState(false)

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

  // 自动打开CC字幕
  const autoEnableSubtitles = () => {
    try {
      // 等待页面元素加载完成
      setTimeout(() => {
        // 查找CC字幕按钮
        const ccButton = document.querySelector('.ytp-subtitles-button, .ytp-caption-button, button[aria-label*="字幕"], button[aria-label*="Subtitles"], button[aria-label*="Captions"]') as HTMLButtonElement

        if (ccButton) {
          // 检查字幕是否已经开启
          const isSubtitleEnabled = ccButton.getAttribute('aria-pressed') === 'true' ||
                                   ccButton.classList.contains('ytp-button-active') ||
                                   ccButton.classList.contains('ytp-subtitles-button-active')

          if (!isSubtitleEnabled) {
            console.log('自动开启YouTube CC字幕')
            ccButton.click()
          } else {
            console.log('YouTube CC字幕已经开启')
          }
        } else {
          console.log('未找到YouTube CC字幕按钮，可能视频没有字幕')
        }
      }, 3000) // 延迟3秒确保页面完全加载
    } catch (error) {
      console.error('自动开启字幕失败:', error)
    }
  }

  // 等待捕获字幕URL
  const waitForSubtitleUrl = async (maxWaitTime: number = 10000): Promise<string | null> => {
    const startTime = Date.now()

    while (Date.now() - startTime < maxWaitTime) {
      try {
        const response = await chrome.runtime.sendMessage({
          action: "getCapturedSubtitleUrl"
        })

        if (response.success && response.data) {
          console.log('获取到捕获的字幕URL:', response.data)
          return response.data
        }
      } catch (error) {
        console.error('获取字幕URL失败:', error)
      }

      // 等待500ms后重试
      await new Promise(resolve => setTimeout(resolve, 500))
    }

    return null
  }

  // 清除已捕获的字幕URL
  const clearCapturedSubtitleUrl = async () => {
    try {
      await chrome.runtime.sendMessage({
        action: "clearCapturedSubtitleUrl"
      })
    } catch (error) {
      console.error('清除字幕URL失败:', error)
    }
  }

  // 合并字幕片段
  const mergeSubtitleSegments = (rawSubtitles: SubtitleItem[]): SubtitleItem[] => {
    if (rawSubtitles.length === 0) return []

    const merged: SubtitleItem[] = []
    let currentGroup: SubtitleItem[] = []
    let currentGroupText = ''

    for (let i = 0; i < rawSubtitles.length; i++) {
      const current = rawSubtitles[i]
      const next = rawSubtitles[i + 1]

      currentGroup.push(current)
      currentGroupText += (currentGroupText ? ' ' : '') + current.text

      // 判断是否应该结束当前组
      const shouldEndGroup =
        // 当前文本长度已经足够（50-120字符之间比较合适）
        currentGroupText.length >= 50 ||
        // 没有下一个片段了
        !next ||
        // 下一个片段与当前片段时间间隔太大（超过2秒）
        (next.start - (current.start + current.dur)) > 2 ||
        // 当前组文本已经很长了（避免单行过长）
        currentGroupText.length >= 120 ||
        // 检测到句子结束标点
        /[。！？.!?]$/.test(current.text.trim())

      if (shouldEndGroup) {
        // 创建合并后的字幕项
        const firstItem = currentGroup[0]
        const lastItem = currentGroup[currentGroup.length - 1]

        merged.push({
          start: firstItem.start,
          dur: (lastItem.start + lastItem.dur) - firstItem.start,
          text: currentGroupText.trim()
        })

        // 重置当前组
        currentGroup = []
        currentGroupText = ''
      }
    }

    return merged
  }

  // 获取字幕数据
  const fetchSubtitles = async (videoId: string) => {
    try {
      setLoading(true)
      setError(null)

      console.log('开始获取YouTube字幕，视频ID:', videoId)

      // 清除之前捕获的字幕URL
      await clearCapturedSubtitleUrl()

      // 触发视频播放以产生字幕请求
      const video = document.querySelector('video') as HTMLVideoElement
      if (video) {
        // 暂停并重新播放一小段来触发字幕请求
        const currentTime = video.currentTime
        video.currentTime = currentTime + 0.1
        video.play()
        setTimeout(() => {
          video.currentTime = currentTime
          video.pause()
        }, 100)
      }

      // 等待捕获字幕URL
      const subtitleUrl = await waitForSubtitleUrl(15000)

      if (!subtitleUrl) {
        setError('无法获取字幕URL，请确保视频有字幕')
        return
      }

      // 获取字幕内容
      await loadSubtitleContent(subtitleUrl)

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

      // 确保URL包含JSON格式参数
      const url = new URL(subtitleUrl)
      if (!url.searchParams.has('fmt')) {
        url.searchParams.set('fmt', 'json3')
      }

      const response = await fetch(url.toString())
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      console.log('字幕数据:', data)

      if (data.events && Array.isArray(data.events)) {
        // 处理YouTube的字幕格式
        const rawSubtitles: SubtitleItem[] = []

        // 首先提取所有原始字幕片段
        for (const event of data.events) {
          if (event.segs && Array.isArray(event.segs)) {
            for (const seg of event.segs) {
              if (seg.utf8) {
                rawSubtitles.push({
                  start: event.tStartMs / 1000,
                  dur: event.dDurationMs / 1000,
                  text: seg.utf8.replace(/\n/g, ' ').trim()
                })
              }
            }
          }
        }

        // 合并短片段字幕
        const mergedSubtitles = mergeSubtitleSegments(rawSubtitles)

        setSubtitles(mergedSubtitles)
        console.log('字幕加载成功，原始片段:', rawSubtitles.length, '条，合并后:', mergedSubtitles.length, '条')
      } else {
        console.error('YouTube字幕数据格式错误:', data)
        setError('字幕数据格式错误：期望包含events数组')
      }
    } catch (error) {
      console.error('加载字幕内容失败:', error)
      setError('加载字幕内容失败: ' + (error as Error).message)
    }
  }

  // 监听来自background的字幕URL捕获消息
  useEffect(() => {
    const messageListener = (message: any) => {
      if (message.type === "SUBTITLE_URL_CAPTURED") {
        console.log('收到字幕URL捕获消息:', message.url)
        // 可以在这里直接加载字幕，但我们选择在fetchSubtitles中主动获取
      }
    }

    chrome.runtime.onMessage.addListener(messageListener)

    return () => {
      chrome.runtime.onMessage.removeListener(messageListener)
    }
  }, [])

  // 跳转到指定时间
  const jumpToTime = (time: number) => {
    const video = document.querySelector('video') as HTMLVideoElement
    if (video) {
      video.currentTime = time
    }
  }

  useEffect(() => {
    const videoId = extractVideoId()
    if (videoId) {
      const title = getVideoTitle()
      setVideoInfo({ videoId, title })

      // 自动开启CC字幕
      autoEnableSubtitles()

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

        // 自动开启CC字幕
        autoEnableSubtitles()

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
    <SubtitlePanel
      subtitles={subtitles}
      loading={loading}
      error={error}
      videoInfo={videoInfo}
      onJumpToTime={jumpToTime}
      platform="youtube"
      enableMindmap={true}
    />
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
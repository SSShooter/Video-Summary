import type { PlasmoCSConfig, PlasmoGetStyle } from "plasmo"
import { useEffect, useState } from "react"
import styleText from "data-text:mind-elixir/style.css"
import styleOverride from "data-text:./mind-elixir-css-override.css"
import sonnerStyle from 'data-text:sonner/dist/styles.css';
import tailwindStyles from "data-text:~style.css"
import { t } from "~utils/i18n"
import { SubtitlePanel } from "~components/SubtitlePanel"

export const config: PlasmoCSConfig = {
  matches: ["https://www.youtube.com/watch*"],
  all_frames: false
}

export const getStyle: PlasmoGetStyle = () => {
  const style = document.createElement("style")
  style.textContent = tailwindStyles + styleText + styleOverride + sonnerStyle
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
    return titleElement?.textContent || t('unknownTitle')
  }

  // 等待CC按钮加载并启动字幕
  const waitForCCButtonAndEnable = async (): Promise<boolean> => {
    return new Promise((resolve) => {
      const checkCCButton = () => {
        const ccButton = document.querySelector('.ytp-subtitles-button, .ytp-caption-button, button[aria-label*="字幕"], button[aria-label*="Subtitles"], button[aria-label*="Captions"]') as HTMLButtonElement

        if (ccButton) {
          // 检查字幕是否已经开启
          const isSubtitleEnabled = ccButton.getAttribute('aria-pressed') === 'true' ||
            ccButton.classList.contains('ytp-button-active') ||
            ccButton.classList.contains('ytp-subtitles-button-active')

          if (!isSubtitleEnabled) {
            console.log('启动YouTube CC字幕')
            ccButton.click()
          } else {
            console.log('YouTube CC字幕已经开启')
          }
          resolve(true)
        } else {
          // 继续等待CC按钮加载
          setTimeout(checkCCButton, 500)
        }
      }

      checkCCButton()
    })
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

  // 开始字幕逻辑：等待字幕URL并处理
  const startSubtitleLogic = async (videoId: string) => {
    try {
      setLoading(true)
      setError(null)
      console.log('开始字幕逻辑，视频ID:', videoId)

      // 开始监听字幕URL
      let isListening = true
      const urlListener = (message: any) => {
        if (message.type === "SUBTITLE_URL_CAPTURED" && isListening) {
          console.log('收到字幕URL:', message.url)
          isListening = false // 停止监听
          chrome.runtime.onMessage.removeListener(urlListener)
          loadSubtitleContent(message.url)
        }
      }
      chrome.runtime.onMessage.addListener(urlListener)

      await new Promise((resolve) => {
        setTimeout(resolve, 3000)
      })

      // 等待CC按钮加载并启动字幕
      await waitForCCButtonAndEnable()

      // 设置超时，如果15秒内没有收到URL则停止
      setTimeout(() => {
        if (isListening) {
          isListening = false
          chrome.runtime.onMessage.removeListener(urlListener)
          setError('获取字幕超时，请确保视频有字幕')
          setLoading(false)
        }
      }, 15000)

    } catch (error) {
      console.error(t('subtitleLogicFailed'), error)
      setError(t('fetchSubtitlesFailed') + ' ' + (error as Error).message)
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
        setLoading(false)
        console.log(t('youtubeSubtitleLoadedCount', [rawSubtitles.length.toString(), mergedSubtitles.length.toString()]))
      } else {
        console.error(t('youtubeSubtitleFormatError'), data)
        setError(t('expectedEventsArray'))
        setLoading(false)
      }
    } catch (error) {
      console.error(t('loadSubtitleContentFailed'), error)
      setError(t('loadSubtitleContentFailed') + ' ' + (error as Error).message)
      setLoading(false)
    }
  }



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

      // 开始字幕逻辑
      startSubtitleLogic(videoId)
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

        // 开始新的字幕逻辑
        startSubtitleLogic(newVideoId)
      }
    }

    // 监听pushstate和popstate事件
    const originalPushState = history.pushState
    history.pushState = function (...args) {
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
    />
  )
}
export default YouTubeSubtitlePanel
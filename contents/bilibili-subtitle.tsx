import styleText from "data-text:mind-elixir/style"
import styleOverride from "data-text:./mind-elixir-css-override.css"
import tailwindStyles from "data-text:~style.css"
import type { MindElixirData } from "mind-elixir"
import type { PlasmoCSConfig, PlasmoGetStyle } from "plasmo"
import { useEffect, useRef, useState } from "react"
import { createRoot } from "react-dom/client"

import { Storage } from "@plasmohq/storage"

import MindElixirReact, {
  type MindElixirReactRef
} from "~components/MindElixirReact"

import { aiService, type SubtitleSummary } from "../utils/ai-service"
import { fullscreen } from "~utils/fullscreen"

export const config: PlasmoCSConfig = {
  matches: [
    "https://www.bilibili.com/video/*",
    "https://www.bilibili.com/list/watchlater*"
  ],
  all_frames: false
}

export const getStyle: PlasmoGetStyle = () => {
  const style = document.createElement("style")
  style.textContent = tailwindStyles + styleText + styleOverride
  return style
}

interface SubtitleItem {
  from: number
  to: number
  content: string
}

interface VideoInfo {
  bvid: string
  cid: number
  title: string
}

interface CachedData {
  aiSummary: SubtitleSummary | null
  mindmapData: MindElixirData | null
  timestamp: number
}

function SubtitlePanel() {
  const [subtitles, setSubtitles] = useState<SubtitleItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null)
  const [aiSummary, setAiSummary] = useState<SubtitleSummary | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [mindmapData, setMindmapData] = useState<MindElixirData | null>(null)
  const [mindmapLoading, setMindmapLoading] = useState(false)
  const [mindmapError, setMindmapError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<
    "subtitles" | "summary" | "mindmap"
  >("subtitles")
  const [isVisible, setIsVisible] = useState(false)
  const [cacheLoaded, setCacheLoaded] = useState(false)
  const mindmapRef = useRef<MindElixirReactRef>(null)
  const storage = new Storage()

  // 从URL中提取BVID
  const extractBVID = (): string | null => {
    const url = window.location.href
    // 匹配标准视频页面 /video/BVxxxxxx
    const videoMatch = url.match(/\/video\/(BV[a-zA-Z0-9]+)/)
    if (videoMatch) {
      return videoMatch[1]
    }
    // 匹配稍后再看等页面的 bvid 参数
    const bvidMatch = url.match(/[?&]bvid=(BV[a-zA-Z0-9]+)/)
    return bvidMatch ? bvidMatch[1] : null
  }

  // 获取视频信息
  const fetchVideoInfo = async (bvid: string): Promise<VideoInfo | null> => {
    try {
      const response = await fetch(
        `https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`
      )
      const data = await response.json()

      if (data.code === 0 && data.data) {
        return {
          bvid: bvid,
          cid: data.data.cid,
          title: data.data.title
        }
      }
      return null
    } catch (error) {
      console.error("获取视频信息失败:", error)
      return null
    }
  }

  // 获取用户cookies和必要的认证信息
  const getCookies = (): string => {
    return document.cookie
  }

  // 获取CSRF token
  const getBiliJct = (): string => {
    const cookies = document.cookie.split(";")
    for (let cookie of cookies) {
      const [name, value] = cookie.trim().split("=")
      if (name === "bili_jct") {
        return value
      }
    }
    return ""
  }

  // 获取字幕数据
  const fetchSubtitles = async (bvid: string, cid: number) => {
    try {
      setLoading(true)
      setError(null)

      console.log("开始获取字幕，BVID:", bvid, "CID:", cid)

      // 构建请求头，包含用户认证信息
      const headers: HeadersInit = {
        "User-Agent": navigator.userAgent,
        Referer: window.location.href,
        Origin: "https://www.bilibili.com"
      }

      // 获取cookies
      const cookies = getCookies()
      if (cookies) {
        headers["Cookie"] = cookies
      }

      console.log("请求头:", headers)

      // 获取字幕列表 - 使用更完整的参数
      const playerUrl = `https://api.bilibili.com/x/player/wbi/v2?bvid=${bvid}&cid=${cid}&qn=64&fnver=0&fnval=4048&fourk=1`
      console.log("请求URL:", playerUrl)

      const playerResponse = await fetch(playerUrl, {
        method: "GET",
        headers: headers,
        credentials: "include"
      })

      console.log("播放器API响应状态:", playerResponse.status)
      const playerData = await playerResponse.json()
      console.log("播放器API响应数据:", playerData)

      if (playerData.code !== 0) {
        throw new Error(
          `获取播放器信息失败: ${playerData.message || playerData.code}`
        )
      }

      const subtitleList = playerData.data?.subtitle?.subtitles
      console.log("字幕列表:", subtitleList)

      if (!subtitleList || subtitleList.length === 0) {
        // 尝试其他方法获取字幕
        console.log("尝试备用方法获取字幕...")
        await tryAlternativeSubtitleMethod(bvid, cid)
        return
      }

      // 获取第一个字幕文件
      const subtitleUrl = subtitleList[0].subtitle_url
      console.log("字幕文件URL:", subtitleUrl)

      if (!subtitleUrl) {
        setError("字幕文件地址无效")
        return
      }

      // 下载字幕文件
      const fullSubtitleUrl = subtitleUrl.startsWith("http")
        ? subtitleUrl
        : `https:${subtitleUrl}`
      console.log("完整字幕URL:", fullSubtitleUrl)

      const subtitleResponse = await fetch(fullSubtitleUrl, {
        headers: {
          Referer: "https://www.bilibili.com/",
          Origin: "https://www.bilibili.com"
        }
      })

      console.log("字幕文件响应状态:", subtitleResponse.status)
      const subtitleData = await subtitleResponse.json()
      console.log("字幕数据:", subtitleData)

      if (subtitleData.body && Array.isArray(subtitleData.body)) {
        setSubtitles(subtitleData.body)
        console.log("字幕加载成功，共", subtitleData.body.length, "条")
      } else {
        console.error("字幕数据不是数组格式:", subtitleData.body)
        setError("字幕数据格式错误：期望数组格式")
      }
    } catch (error) {
      console.error("获取字幕失败:", error)
      setError("获取字幕失败: " + (error as Error).message)
    } finally {
      setLoading(false)
    }
  }

  // 备用方法：尝试从页面中获取字幕信息
  const tryAlternativeSubtitleMethod = async (bvid: string, cid: number) => {
    try {
      console.log("尝试从页面数据获取字幕...")

      // 尝试从window.__INITIAL_STATE__获取数据
      const initialState = (window as any).__INITIAL_STATE__
      if (initialState?.videoData?.subtitle?.list) {
        console.log(
          "从页面初始状态找到字幕:",
          initialState.videoData.subtitle.list
        )
        const subtitleList = initialState.videoData.subtitle.list
        if (subtitleList.length > 0) {
          const subtitleUrl = subtitleList[0].subtitle_url
          if (subtitleUrl) {
            const fullUrl = subtitleUrl.startsWith("http")
              ? subtitleUrl
              : `https:${subtitleUrl}`
            const response = await fetch(fullUrl)
            const data = await response.json()
            if (data.body && Array.isArray(data.body)) {
              setSubtitles(data.body)
              return
            } else {
              console.error("备用方法获取的字幕数据不是数组格式:", data.body)
            }
          }
        }
      }

      // 尝试从DOM中查找字幕按钮
      const subtitleButton = document.querySelector(
        ".bpx-player-ctrl-subtitle, .bilibili-player-video-btn-subtitle"
      )
      if (subtitleButton) {
        console.log("找到字幕按钮，但需要用户手动开启字幕")
        setError("请先在视频播放器中开启字幕，然后刷新页面")
      } else {
        setError("该视频可能确实没有字幕，或需要登录后才能访问")
      }
    } catch (error) {
      console.error("备用方法失败:", error)
      setError("该视频暂无字幕或需要登录访问")
    }
  }

  // 格式化时间
  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  // 跳转到指定时间
  const jumpToTime = (time: number) => {
    const video = document.querySelector("video") as HTMLVideoElement
    if (video) {
      video.currentTime = time
    }
  }

  // 保存缓存数据
  const saveCacheData = async (bvid: string, data: CachedData) => {
    try {
      await storage.set(`video_cache_${bvid}`, data)
    } catch (error) {
      console.error("保存缓存失败:", error)
    }
  }

  // 加载缓存数据
  const loadCacheData = async (bvid: string): Promise<CachedData | null> => {
    try {
      const cached = await storage.get<CachedData>(`video_cache_${bvid}`)
      return cached || null
    } catch (error) {
      console.error("加载缓存失败:", error)
      return null
    }
  }

  // AI总结字幕
  const summarizeWithAI = async (forceRegenerate = false) => {
    if (subtitles.length === 0) {
      setAiError("没有字幕内容可以总结")
      return
    }

    // 如果不是强制重新生成且已有缓存数据，直接使用缓存
    if (!forceRegenerate && aiSummary) {
      setActiveTab("summary")
      return
    }

    try {
      setAiLoading(true)
      setAiError(null)

      const summary = await aiService.summarizeSubtitles(subtitles)

      setAiSummary(summary)
      setActiveTab("summary")

      // 保存到缓存
      if (videoInfo) {
        const cacheData: CachedData = {
          aiSummary: summary,
          mindmapData,
          timestamp: Date.now()
        }
        await saveCacheData(videoInfo.bvid, cacheData)
      }
    } catch (error) {
      console.error("AI总结失败:", error)
      setAiError(
        error instanceof Error ? error.message : "总结失败，请检查AI配置"
      )
    } finally {
      setAiLoading(false)
    }
  }

  // 生成思维导图
  const generateMindmap = async (forceRegenerate = false) => {
    if (subtitles.length === 0) {
      setMindmapError("没有字幕内容可以生成思维导图")
      return
    }

    // 如果不是强制重新生成且已有缓存数据，直接使用缓存
    if (!forceRegenerate && mindmapData) {
      setActiveTab("mindmap")
      return
    }

    try {
      setMindmapLoading(true)
      setMindmapError(null)

      // 格式化字幕内容
      const formattedSubtitles = subtitles
        .map((subtitle) => subtitle.content)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim()

      // 发送消息到background script生成思维导图
      const response = await new Promise<any>((resolve, reject) => {
        chrome.runtime.sendMessage(
          {
            action: "generateMindmap",
            subtitles: formattedSubtitles
          },
          (response) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message))
            } else {
              resolve(response)
            }
          }
        )
      })

      if (response.success) {
        setMindmapData(response.data)
        setActiveTab("mindmap")

        // 保存到缓存
        if (videoInfo) {
          const cacheData: CachedData = {
            aiSummary,
            mindmapData: response.data,
            timestamp: Date.now()
          }
          await saveCacheData(videoInfo.bvid, cacheData)
        }
      } else {
        throw new Error(response.error || "生成思维导图失败")
      }
    } catch (error) {
      console.error("生成思维导图失败:", error)
      setMindmapError(
        error instanceof Error
          ? error.message
          : "生成思维导图失败，请检查AI配置"
      )
    } finally {
      setMindmapLoading(false)
    }
  }

  // 复制思维导图JSON
  const copyMindmapJSON = () => {
    if (mindmapData) {
      navigator.clipboard
        .writeText(JSON.stringify(mindmapData, null, 2))
        .then(() => {
          // 可以添加一个临时的成功提示
          console.log("思维导图JSON已复制到剪贴板")
        })
        .catch((err) => {
          console.error("复制失败:", err)
        })
    }
  }

  useEffect(() => {
    const bvid = extractBVID()
    if (bvid) {
      fetchVideoInfo(bvid).then(async (info) => {
        if (info) {
          setVideoInfo(info)
          fetchSubtitles(info.bvid, info.cid)

          // 加载缓存数据
          const cached = await loadCacheData(info.bvid)
          if (cached) {
            if (cached.aiSummary) {
              setAiSummary(cached.aiSummary)
            }
            if (cached.mindmapData) {
              setMindmapData(cached.mindmapData)
            }
          }
          setCacheLoaded(true)
        }
      })
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



  if (!isVisible) {
    return null
  }

  return (
    <div className="w-[350px] h-[600px] bg-white border border-gray-300 rounded-lg p-4 text-sm font-sans shadow-lg fixed top-20 right-5 z-[9999] overflow-hidden flex flex-col">
      <div className="mb-3">
        <h3 className="m-0 mb-2 text-base font-semibold text-gray-900">
          视频助手
        </h3>
        {videoInfo && (
          <div className="text-xs text-gray-600 leading-relaxed mb-3">
            {videoInfo.title}
          </div>
        )}

        {/* Tab导航 */}
        <div className="flex border-b border-gray-300">
          <button
            onClick={() => setActiveTab("subtitles")}
            className={`flex-1 py-2 px-3 m-0 text-xs bg-transparent border-none border-b-2 cursor-pointer transition-all duration-200 ${activeTab === "subtitles"
                ? "text-blue-500 border-blue-500"
                : "text-gray-600 border-transparent hover:text-blue-400"
              }`}>
            字幕
          </button>
          <button
            onClick={() => setActiveTab("summary")}
            className={`flex-1 py-2 px-3 m-0 text-xs bg-transparent border-none border-b-2 cursor-pointer transition-all duration-200 ${activeTab === "summary"
                ? "text-blue-500 border-blue-500"
                : "text-gray-600 border-transparent hover:text-blue-400"
              }`}>
            AI总结
          </button>
          <button
            onClick={() => {
              setActiveTab("mindmap")
              setTimeout(() => {
                mindmapRef.current?.instance.toCenter()
              }, 200)
            }}
            className={`flex-1 py-2 px-3 m-0 text-xs bg-transparent border-none border-b-2 cursor-pointer transition-all duration-200 ${activeTab === "mindmap"
                ? "text-blue-500 border-blue-500"
                : "text-gray-600 border-transparent hover:text-blue-400"
              }`}>
            思维导图
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {/* 字幕Tab内容 */}
        {activeTab === "subtitles" && (
          <>
            {loading && (
              <div className="text-center p-5 text-gray-600">
                加载中...
              </div>
            )}

            {error && (
              <div className="text-center p-5 text-red-500">
                {error}
              </div>
            )}

            {subtitles.length > 0 && (
              <div>
                {subtitles.map((subtitle, index) => (
                  <div
                    key={index}
                    className="py-2 border-b border-gray-100 cursor-pointer transition-colors duration-200 hover:bg-gray-50"
                    onClick={() => jumpToTime(subtitle.from)}>
                    <div className="text-xs text-blue-500 mb-1 font-medium">
                      {formatTime(subtitle.from)} - {formatTime(subtitle.to)}
                    </div>
                    <div className="text-gray-900 leading-relaxed">
                      {subtitle.content}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* AI总结Tab内容 */}
        {activeTab === "summary" && (
          <>
            {/* AI总结功能按钮 */}
            {subtitles.length > 0 && (
              <div className="p-3">
                <div className="flex gap-2">
                  <button
                    onClick={() => summarizeWithAI(false)}
                    disabled={aiLoading}
                    className={`flex-1 py-2 px-3 m-0 text-xs border-none rounded cursor-pointer transition-colors duration-200 ${aiLoading ? "bg-gray-400 cursor-not-allowed" : "bg-blue-500 hover:bg-blue-600"
                      } text-white`}>
                    {aiLoading
                      ? "总结中..."
                      : aiSummary
                        ? "查看总结"
                        : "生成AI总结"}
                  </button>
                  {aiSummary && (
                    <button
                      onClick={() => summarizeWithAI(true)}
                      disabled={aiLoading}
                      className={`py-2 px-3 m-0 text-xs border-none rounded cursor-pointer transition-colors duration-200 ${aiLoading ? "bg-gray-400 cursor-not-allowed" : "bg-green-500 hover:bg-green-600"
                        } text-white`}>
                      重新生成
                    </button>
                  )}
                </div>
                {aiError && (
                  <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-500">
                    {aiError}
                  </div>
                )}
              </div>
            )}

            {!aiSummary && !aiLoading && subtitles.length === 0 && (
              <div className="text-center py-10 px-5 text-gray-600">
                <div className="mb-3">暂无字幕数据</div>
                <div className="text-xs">
                  请先获取字幕后再生成AI总结
                </div>
              </div>
            )}

            {aiLoading && (
              <div className="text-center py-10 px-5 text-gray-600">
                正在生成AI总结...
              </div>
            )}

            {aiSummary && (
              <div className="p-3 bg-green-50 border border-green-300 rounded-md">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="m-0 text-sm text-blue-500 font-semibold">
                    AI内容总结
                  </h4>
                  {cacheLoaded && (
                    <span className="text-xs text-green-500 bg-green-50 py-0.5 px-1.5 rounded-full border border-green-300">
                      已缓存
                    </span>
                  )}
                </div>

                <div className="mb-3">
                  <div className="text-xs text-gray-600 mb-1 font-medium">
                    概要:
                  </div>
                  <div className="text-xs leading-relaxed text-gray-800">
                    {aiSummary.summary}
                  </div>
                </div>

                {aiSummary.keyPoints.length > 0 && (
                  <div className="mb-3">
                    <div className="text-xs text-gray-600 mb-1 font-medium">
                      关键要点:
                    </div>
                    <ul className="m-0 pl-4 text-xs leading-relaxed text-gray-800">
                      {aiSummary.keyPoints.map((point, index) => (
                        <li key={index} className="mb-0.5">
                          {point}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {aiSummary.topics.length > 0 && (
                  <div>
                    <div className="text-xs text-gray-600 mb-1 font-medium">
                      主要话题:
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {aiSummary.topics.map((topic, index) => (
                        <span
                          key={index}
                          className="py-0.5 px-1.5 bg-blue-50 text-blue-500 text-xs rounded-full border border-blue-200">
                          {topic}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* 思维导图Tab内容 */}
        {activeTab === "mindmap" && (
          <>
            {/* 思维导图功能按钮 */}
            {subtitles.length > 0 && (
              <div className="p-3">
                <div className="flex gap-2 mb-2">
                  {!mindmapData ? (
                    <button
                      onClick={() => generateMindmap(false)}
                      disabled={mindmapLoading}
                      className={`flex-1 py-2 px-3 m-0 text-xs border-none rounded cursor-pointer transition-colors duration-200 ${mindmapLoading ? "bg-gray-400 cursor-not-allowed" : "bg-purple-600 hover:bg-purple-700"
                        } text-white`}>
                      {mindmapLoading ? "生成中..." : "生成思维导图"}
                    </button>
                  ) : (
                    <button
                      onClick={() => generateMindmap(true)}
                      disabled={mindmapLoading}
                      className={`flex-1 py-2 px-3 m-0 text-xs border-none rounded cursor-pointer transition-colors duration-200 ${mindmapLoading ? "bg-gray-400 cursor-not-allowed" : "bg-green-500 hover:bg-green-600"
                        } text-white`}>
                      重新生成
                    </button>
                  )}
                </div>
                {mindmapData && (
                  <div className="flex gap-2">
                    <button
                      onClick={copyMindmapJSON}
                      className="flex-1 py-2 px-3 m-0 text-xs bg-cyan-500 text-white border-none rounded cursor-pointer hover:bg-cyan-600">
                      复制JSON
                    </button>
                    <button
                      onClick={()=>{
                        fullscreen(mindmapRef.current?.instance!)
                      }}
                      className="flex-1 py-2 px-3 m-0 text-xs bg-cyan-500 text-white border-none rounded cursor-pointer hover:bg-cyan-600">
                      全屏
                    </button>
                  </div>
                )}
                {mindmapError && (
                  <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-500">
                    {mindmapError}
                  </div>
                )}
              </div>
            )}

            {!mindmapData && !mindmapLoading && subtitles.length === 0 && (
              <div className="text-center py-10 px-5 text-gray-600">
                <div className="mb-3">暂无字幕数据</div>
                <div className="text-xs">
                  请先获取字幕后再生成思维导图
                </div>
              </div>
            )}

            {mindmapLoading && (
              <div className="text-center py-10 px-5 text-gray-600">
                正在生成思维导图...
              </div>
            )}

            {mindmapData && (
              <div className="h-[calc(100%-120px)] border border-gray-300 rounded-md overflow-hidden mt-3">
                <MindElixirReact data={mindmapData} ref={mindmapRef}
                  options={{
                    editable: false,
                    draggable: false,
                    toolBar: false,
                    mouseSelectionButton: 2
                  }} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// 注入字幕面板
function injectSubtitlePanel() {
  // 检查是否已经注入
  if (document.getElementById("bilibili-subtitle-panel")) {
    return
  }

  // 等待页面加载完成
  const checkAndInject = () => {
    const videoContainer = document.querySelector(
      ".bpx-player-container, .bilibili-player-video-wrap"
    )
    if (videoContainer) {
      const container = document.createElement("div")
      container.id = "bilibili-subtitle-panel"
      document.body.appendChild(container)

      const root = createRoot(container)
      root.render(<SubtitlePanel />)
    } else {
      // 如果还没找到视频容器，继续等待
      setTimeout(checkAndInject, 1000)
    }
  }

  checkAndInject()
}

// 页面加载完成后注入
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", injectSubtitlePanel)
} else {
  injectSubtitlePanel()
}

// 监听路由变化（B站是SPA应用）
let currentUrl = window.location.href
const observer = new MutationObserver(() => {
  if (window.location.href !== currentUrl) {
    currentUrl = window.location.href
    // 移除旧的面板
    const oldPanel = document.getElementById("bilibili-subtitle-panel")
    if (oldPanel) {
      oldPanel.remove()
    }
    // 重新注入
    setTimeout(injectSubtitlePanel, 1000)
  }
})

observer.observe(document.body, {
  childList: true,
  subtree: true
})

export default SubtitlePanel

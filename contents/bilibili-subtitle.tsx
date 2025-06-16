import type { PlasmoCSConfig } from "plasmo"
import { useEffect, useState } from "react"
import { createRoot } from "react-dom/client"
import { Storage } from "@plasmohq/storage"
import { aiService, type SubtitleSummary } from "../utils/ai-service"

export const config: PlasmoCSConfig = {
  matches: ["https://www.bilibili.com/video/*"],
  all_frames: false
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

interface NodeObj {
  topic: string
  id: string
  children?: NodeObj[]
}

interface Summary {
  id: string
  label: string
  parent: string
  start: number
  end: number
}

interface Arrow {
  id: string
  label: string
  from: string
  to: string
  delta1: {
    x: number
    y: number
  }
  delta2: {
    x: number
    y: number
  }
  bidirectional?: boolean
}

interface MindmapData {
  nodeData: NodeObj
  arrows?: Arrow[]
  summaries?: Summary[]
}

function SubtitlePanel() {
  const [subtitles, setSubtitles] = useState<SubtitleItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null)
  const [aiSummary, setAiSummary] = useState<SubtitleSummary | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [showSummary, setShowSummary] = useState(false)
  const [mindmapData, setMindmapData] = useState<MindmapData | null>(null)
  const [mindmapLoading, setMindmapLoading] = useState(false)
  const [mindmapError, setMindmapError] = useState<string | null>(null)
  const [showMindmap, setShowMindmap] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const storage = new Storage()

  // 从URL中提取BVID
  const extractBVID = (): string | null => {
    const url = window.location.href
    const match = url.match(/\/video\/(BV[a-zA-Z0-9]+)/)
    return match ? match[1] : null
  }

  // 获取视频信息
  const fetchVideoInfo = async (bvid: string): Promise<VideoInfo | null> => {
    try {
      const response = await fetch(`https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`)
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
      console.error('获取视频信息失败:', error)
      return null
    }
  }

  // 获取用户cookies和必要的认证信息
  const getCookies = (): string => {
    return document.cookie
  }

  // 获取CSRF token
  const getBiliJct = (): string => {
    const cookies = document.cookie.split(';')
    for (let cookie of cookies) {
      const [name, value] = cookie.trim().split('=')
      if (name === 'bili_jct') {
        return value
      }
    }
    return ''
  }

  // 获取字幕数据
  const fetchSubtitles = async (bvid: string, cid: number) => {
    try {
      setLoading(true)
      setError(null)
      
      console.log('开始获取字幕，BVID:', bvid, 'CID:', cid)
      
      // 构建请求头，包含用户认证信息
      const headers: HeadersInit = {
        'User-Agent': navigator.userAgent,
        'Referer': window.location.href,
        'Origin': 'https://www.bilibili.com'
      }
      
      // 获取cookies
      const cookies = getCookies()
      if (cookies) {
        headers['Cookie'] = cookies
      }
      
      console.log('请求头:', headers)
      
      // 获取字幕列表 - 使用更完整的参数
      const playerUrl = `https://api.bilibili.com/x/player/wbi/v2?bvid=${bvid}&cid=${cid}&qn=64&fnver=0&fnval=4048&fourk=1`
      console.log('请求URL:', playerUrl)
      
      const playerResponse = await fetch(playerUrl, {
        method: 'GET',
        headers: headers,
        credentials: 'include'
      })
      
      console.log('播放器API响应状态:', playerResponse.status)
      const playerData = await playerResponse.json()
      console.log('播放器API响应数据:', playerData)
      
      if (playerData.code !== 0) {
        throw new Error(`获取播放器信息失败: ${playerData.message || playerData.code}`)
      }
      
      const subtitleList = playerData.data?.subtitle?.subtitles
      console.log('字幕列表:', subtitleList)
      
      if (!subtitleList || subtitleList.length === 0) {
        // 尝试其他方法获取字幕
        console.log('尝试备用方法获取字幕...')
        await tryAlternativeSubtitleMethod(bvid, cid)
        return
      }
      
      // 获取第一个字幕文件
      const subtitleUrl = subtitleList[0].subtitle_url
      console.log('字幕文件URL:', subtitleUrl)
      
      if (!subtitleUrl) {
        setError('字幕文件地址无效')
        return
      }
      
      // 下载字幕文件
      const fullSubtitleUrl = subtitleUrl.startsWith('http') ? subtitleUrl : `https:${subtitleUrl}`
      console.log('完整字幕URL:', fullSubtitleUrl)
      
      const subtitleResponse = await fetch(fullSubtitleUrl, {
        headers: {
          'Referer': 'https://www.bilibili.com/',
          'Origin': 'https://www.bilibili.com'
        }
      })
      
      console.log('字幕文件响应状态:', subtitleResponse.status)
      const subtitleData = await subtitleResponse.json()
      console.log('字幕数据:', subtitleData)
      
      if (subtitleData.body && Array.isArray(subtitleData.body)) {
        setSubtitles(subtitleData.body)
        console.log('字幕加载成功，共', subtitleData.body.length, '条')
      } else {
        console.error('字幕数据不是数组格式:', subtitleData.body)
        setError('字幕数据格式错误：期望数组格式')
      }
    } catch (error) {
      console.error('获取字幕失败:', error)
      setError('获取字幕失败: ' + (error as Error).message)
    } finally {
      setLoading(false)
    }
  }

  // 备用方法：尝试从页面中获取字幕信息
  const tryAlternativeSubtitleMethod = async (bvid: string, cid: number) => {
    try {
      console.log('尝试从页面数据获取字幕...')
      
      // 尝试从window.__INITIAL_STATE__获取数据
      const initialState = (window as any).__INITIAL_STATE__
      if (initialState?.videoData?.subtitle?.list) {
        console.log('从页面初始状态找到字幕:', initialState.videoData.subtitle.list)
        const subtitleList = initialState.videoData.subtitle.list
        if (subtitleList.length > 0) {
          const subtitleUrl = subtitleList[0].subtitle_url
          if (subtitleUrl) {
            const fullUrl = subtitleUrl.startsWith('http') ? subtitleUrl : `https:${subtitleUrl}`
            const response = await fetch(fullUrl)
            const data = await response.json()
            if (data.body && Array.isArray(data.body)) {
              setSubtitles(data.body)
              return
            } else {
              console.error('备用方法获取的字幕数据不是数组格式:', data.body)
            }
          }
        }
      }
      
      // 尝试从DOM中查找字幕按钮
      const subtitleButton = document.querySelector('.bpx-player-ctrl-subtitle, .bilibili-player-video-btn-subtitle')
      if (subtitleButton) {
        console.log('找到字幕按钮，但需要用户手动开启字幕')
        setError('请先在视频播放器中开启字幕，然后刷新页面')
      } else {
        setError('该视频可能确实没有字幕，或需要登录后才能访问')
      }
    } catch (error) {
      console.error('备用方法失败:', error)
      setError('该视频暂无字幕或需要登录访问')
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

  // 生成思维导图
  const generateMindmap = async () => {
    if (subtitles.length === 0) {
      setMindmapError('没有字幕内容可以生成思维导图')
      return
    }

    try {
      setMindmapLoading(true)
      setMindmapError(null)
      
      // 格式化字幕内容
      const formattedSubtitles = subtitles
        .map(subtitle => subtitle.content)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim()
      
      // 发送消息到background script生成思维导图
      const response = await new Promise<any>((resolve, reject) => {
        chrome.runtime.sendMessage({
          action: 'generateMindmap',
          subtitles: formattedSubtitles
        }, (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message))
          } else {
            resolve(response)
          }
        })
      })
      
      if (response.success) {
        setMindmapData(response.data)
        setShowMindmap(true)
      } else {
        throw new Error(response.error || '生成思维导图失败')
      }
    } catch (error) {
      console.error('生成思维导图失败:', error)
      setMindmapError(error instanceof Error ? error.message : '生成思维导图失败，请检查AI配置')
    } finally {
      setMindmapLoading(false)
    }
  }

  // 复制思维导图JSON
  const copyMindmapJSON = () => {
    if (mindmapData) {
      navigator.clipboard.writeText(JSON.stringify(mindmapData, null, 2))
        .then(() => {
          // 可以添加一个临时的成功提示
          console.log('思维导图JSON已复制到剪贴板')
        })
        .catch(err => {
          console.error('复制失败:', err)
        })
    }
  }

  useEffect(() => {
    const bvid = extractBVID()
    if (bvid) {
      fetchVideoInfo(bvid).then(info => {
        if (info) {
          setVideoInfo(info)
          fetchSubtitles(info.bvid, info.cid)
        }
      })
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

  if (!isVisible) {
    return null
  }

  return (
    <div style={{
      width: '350px',
      height: '600px',
      backgroundColor: '#fff',
      border: '1px solid #e1e5e9',
      borderRadius: '8px',
      padding: '16px',
      fontSize: '14px',
      fontFamily: 'PingFang SC, HarmonyOS_Regular, Helvetica Neue, Microsoft YaHei, sans-serif',
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
        borderBottom: '1px solid #e1e5e9',
        paddingBottom: '12px',
        marginBottom: '12px'
      }}>
        <h3 style={{
          margin: '0 0 8px 0',
          fontSize: '16px',
          fontWeight: '600',
          color: '#18191c'
        }}>视频字幕</h3>
        {videoInfo && (
          <div style={{
            fontSize: '12px',
            color: '#61666d',
            lineHeight: '1.4',
            marginBottom: '8px'
          }}>
            {videoInfo.title}
          </div>
        )}
        
        {/* AI功能按钮 */}
        {subtitles.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '8px' }}>
            {/* 第一行：AI总结按钮 */}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={summarizeWithAI}
                disabled={aiLoading}
                style={{
                  flex: 1,
                  padding: '6px 12px',
                  fontSize: '12px',
                  backgroundColor: aiLoading ? '#ccc' : '#00a1d6',
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
                    backgroundColor: showSummary ? '#ff6b6b' : '#52c41a',
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
            
            {/* 第二行：思维导图按钮 */}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={generateMindmap}
                disabled={mindmapLoading}
                style={{
                  flex: 1,
                  padding: '6px 12px',
                  fontSize: '12px',
                  backgroundColor: mindmapLoading ? '#ccc' : '#722ed1',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: mindmapLoading ? 'not-allowed' : 'pointer',
                  transition: 'background-color 0.2s'
                }}
              >
                {mindmapLoading ? '生成中...' : '生成思维导图'}
              </button>
              {mindmapData && (
                <>
                  <button
                    onClick={() => setShowMindmap(!showMindmap)}
                    style={{
                      padding: '6px 12px',
                      fontSize: '12px',
                      backgroundColor: showMindmap ? '#ff6b6b' : '#52c41a',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    {showMindmap ? '隐藏' : '显示'}
                  </button>
                  <button
                    onClick={copyMindmapJSON}
                    style={{
                      padding: '6px 12px',
                      fontSize: '12px',
                      backgroundColor: '#13c2c2',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    复制JSON
                  </button>
                </>
              )}
            </div>
          </div>
        )}
        
        {/* AI错误信息 */}
        {aiError && (
          <div style={{
            padding: '8px',
            backgroundColor: '#fff2f0',
            border: '1px solid #ffccc7',
            borderRadius: '4px',
            fontSize: '12px',
            color: '#ff4d4f',
            marginBottom: '8px'
          }}>
            {aiError}
          </div>
        )}
        
        {/* 思维导图错误信息 */}
        {mindmapError && (
          <div style={{
            padding: '8px',
            backgroundColor: '#fff2f0',
            border: '1px solid #ffccc7',
            borderRadius: '4px',
            fontSize: '12px',
            color: '#ff4d4f',
            marginBottom: '8px'
          }}>
            {mindmapError}
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
            backgroundColor: '#f6ffed',
            border: '1px solid #b7eb8f',
            borderRadius: '6px'
          }}>
            <h4 style={{
              margin: '0 0 8px 0',
              fontSize: '14px',
              color: '#00a1d6',
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
                        backgroundColor: '#e6f7ff',
                        color: '#00a1d6',
                        fontSize: '11px',
                        borderRadius: '12px',
                        border: '1px solid #91d5ff'
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
        
        {/* 思维导图内容 */}
        {showMindmap && mindmapData && (
          <div style={{
            marginBottom: '16px',
            padding: '12px',
            backgroundColor: '#f9f0ff',
            border: '1px solid #d3adf7',
            borderRadius: '6px'
          }}>
            <h4 style={{
              margin: '0 0 8px 0',
              fontSize: '14px',
              color: '#722ed1',
              fontWeight: '600'
            }}>思维导图JSON</h4>
            
            <div style={{
              backgroundColor: '#fff',
              border: '1px solid #d9d9d9',
              borderRadius: '4px',
              padding: '8px',
              fontSize: '11px',
              fontFamily: 'Monaco, Consolas, "Courier New", monospace',
              maxHeight: '300px',
              overflow: 'auto',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all'
            }}>
              {JSON.stringify(mindmapData, null, 2)}
            </div>
            
            <div style={{
              marginTop: '8px',
              fontSize: '12px',
              color: '#666'
            }}>
              点击"复制JSON"按钮将数据复制到剪贴板
            </div>
          </div>
        )}
        {loading && (
          <div style={{
            textAlign: 'center',
            padding: '20px',
            color: '#61666d'
          }}>加载中...</div>
        )}
        
        {error && (
          <div style={{
            textAlign: 'center',
            padding: '20px',
            color: '#ff6b6b'
          }}>{error}</div>
        )}
        
        {subtitles.length > 0 && (
          <div>
            {subtitles.map((subtitle, index) => (
              <div
                key={index}
                style={{
                  padding: '8px 0',
                  borderBottom: '1px solid #f1f2f3',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f7f8fa'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent'
                }}
                onClick={() => jumpToTime(subtitle.from)}
              >
                <div style={{
                  fontSize: '12px',
                  color: '#00a1d6',
                  marginBottom: '4px',
                  fontWeight: '500'
                }}>
                  {formatTime(subtitle.from)} - {formatTime(subtitle.to)}
                </div>
                <div style={{
                  color: '#18191c',
                  lineHeight: '1.4'
                }}>
                  {subtitle.content}
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
function injectSubtitlePanel() {
  // 检查是否已经注入
  if (document.getElementById('bilibili-subtitle-panel')) {
    return
  }
  
  // 等待页面加载完成
  const checkAndInject = () => {
    const videoContainer = document.querySelector('.bpx-player-container, .bilibili-player-video-wrap')
    if (videoContainer) {
      const container = document.createElement('div')
      container.id = 'bilibili-subtitle-panel'
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
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', injectSubtitlePanel)
} else {
  injectSubtitlePanel()
}

// 监听路由变化（B站是SPA应用）
let currentUrl = window.location.href
const observer = new MutationObserver(() => {
  if (window.location.href !== currentUrl) {
    currentUrl = window.location.href
    // 移除旧的面板
    const oldPanel = document.getElementById('bilibili-subtitle-panel')
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
// 共享的字幕工具函数

export interface BaseSubtitleItem {
  startTime: number
  endTime: number
  text: string
}

export interface VideoInfo {
  id: string
  title: string
  platform: "bilibili" | "youtube"
}

// 格式化时间显示
export const formatTime = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }
  return `${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
}

// 跳转到视频指定时间
export const jumpToTime = (time: number): void => {
  const video = document.querySelector("video") as HTMLVideoElement
  if (video) {
    video.currentTime = time
  }
}

// 防抖函数
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout
  return (...args: Parameters<T>) => {
    clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

// 节流函数
export const throttle = <T extends (...args: any[]) => any>(
  func: T,
  limit: number
): ((...args: Parameters<T>) => void) => {
  let inThrottle: boolean
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args)
      inThrottle = true
      setTimeout(() => (inThrottle = false), limit)
    }
  }
}

// 安全的JSON解析
export const safeJsonParse = (text: string): any => {
  try {
    return JSON.parse(text)
  } catch (error) {
    console.error("JSON解析失败:", error)
    return null
  }
}

// 获取cookie值
export const getCookieValue = (name: string): string => {
  const cookies = document.cookie.split(";")
  for (let cookie of cookies) {
    const [cookieName, cookieValue] = cookie.trim().split("=")
    if (cookieName === name) {
      return cookieValue || ""
    }
  }
  return ""
}

// 创建通用的请求头
export const createRequestHeaders = (
  platform: "bilibili" | "youtube"
): HeadersInit => {
  const baseHeaders: HeadersInit = {
    "User-Agent": navigator.userAgent,
    Referer: window.location.href
  }

  if (platform === "bilibili") {
    baseHeaders["Origin"] = "https://www.bilibili.com"
    const cookies = document.cookie
    if (cookies) {
      baseHeaders["Cookie"] = cookies
    }
  } else if (platform === "youtube") {
    baseHeaders["Origin"] = "https://www.youtube.com"
  }

  return baseHeaders
}

// 错误处理包装器
export const withErrorHandling = async <T>(
  asyncFn: () => Promise<T>,
  errorMessage: string
): Promise<T | null> => {
  try {
    return await asyncFn()
  } catch (error) {
    console.error(errorMessage, error)
    return null
  }
}

// 等待元素出现
export const waitForElement = (
  selector: string,
  timeout: number = 10000
): Promise<Element | null> => {
  return new Promise((resolve) => {
    const element = document.querySelector(selector)
    if (element) {
      resolve(element)
      return
    }

    const observer = new MutationObserver(() => {
      const element = document.querySelector(selector)
      if (element) {
        observer.disconnect()
        resolve(element)
      }
    })

    observer.observe(document.body, {
      childList: true,
      subtree: true
    })

    setTimeout(() => {
      observer.disconnect()
      resolve(null)
    }, timeout)
  })
}

// 清理HTML标签
export const stripHtmlTags = (html: string): string => {
  const div = document.createElement("div")
  div.innerHTML = html
  return div.textContent || div.innerText || ""
}

// 检查是否为有效的URL
export const isValidUrl = (string: string): boolean => {
  try {
    new URL(string)
    return true
  } catch (_) {
    return false
  }
}

// 日志记录器
export class Logger {
  private prefix: string

  constructor(prefix: string) {
    this.prefix = prefix
  }

  info(message: string, ...args: any[]): void {
    console.log(`[${this.prefix}] ${message}`, ...args)
  }

  warn(message: string, ...args: any[]): void {
    console.warn(`[${this.prefix}] ${message}`, ...args)
  }

  error(message: string, ...args: any[]): void {
    console.error(`[${this.prefix}] ${message}`, ...args)
  }

  debug(message: string, ...args: any[]): void {
    if (process.env.NODE_ENV === "development") {
      console.debug(`[${this.prefix}] ${message}`, ...args)
    }
  }
}

// 存储管理器
export class StorageManager {
  private prefix: string

  constructor(prefix: string) {
    this.prefix = prefix
  }

  set(key: string, value: any): void {
    try {
      localStorage.setItem(`${this.prefix}_${key}`, JSON.stringify(value))
    } catch (error) {
      console.error("存储数据失败:", error)
    }
  }

  get<T>(key: string, defaultValue?: T): T | null {
    try {
      const item = localStorage.getItem(`${this.prefix}_${key}`)
      return item ? JSON.parse(item) : defaultValue || null
    } catch (error) {
      console.error("读取数据失败:", error)
      return defaultValue || null
    }
  }

  remove(key: string): void {
    try {
      localStorage.removeItem(`${this.prefix}_${key}`)
    } catch (error) {
      console.error("删除数据失败:", error)
    }
  }

  clear(): void {
    try {
      const keys = Object.keys(localStorage)
      keys.forEach((key) => {
        if (key.startsWith(`${this.prefix}_`)) {
          localStorage.removeItem(key)
        }
      })
    } catch (error) {
      console.error("清空数据失败:", error)
    }
  }
}

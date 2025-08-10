// 平台配置文件

export interface PlatformConfig {
  name: string
  baseUrl: string
  videoUrlPattern: RegExp
  apiEndpoints: {
    [key: string]: string
  }
  selectors: {
    videoContainer: string[]
    videoElement: string
    titleElement: string[]
  }
  features: {
    hasLanguageSelection: boolean
    hasAutoSubtitle: boolean
    requiresAuth: boolean
  }
}

export const PLATFORMS: Record<string, PlatformConfig> = {
  bilibili: {
    name: "Bilibili",
    baseUrl: "https://www.bilibili.com",
    videoUrlPattern: /\/video\/(BV[a-zA-Z0-9]+)/,
    apiEndpoints: {
      videoInfo: "https://api.bilibili.com/x/web-interface/view",
      playerInfo: "https://api.bilibili.com/x/player/wbi/v2"
    },
    selectors: {
      videoContainer: [".bpx-player-container", ".bilibili-player-video-wrap"],
      videoElement: "video",
      titleElement: ["h1[title]", ".video-title", ".media-title"]
    },
    features: {
      hasLanguageSelection: false,
      hasAutoSubtitle: false,
      requiresAuth: true
    }
  },
  youtube: {
    name: "YouTube",
    baseUrl: "https://www.youtube.com",
    videoUrlPattern: /[?&]v=([^&]+)/,
    apiEndpoints: {
      // YouTube使用内嵌的播放器数据，不需要外部API
    },
    selectors: {
      videoContainer: ["#movie_player", ".html5-video-player"],
      videoElement: "video",
      titleElement: ["h1.ytd-watch-metadata yt-formatted-string", "h1.title"]
    },
    features: {
      hasLanguageSelection: true,
      hasAutoSubtitle: true,
      requiresAuth: false
    }
  }
}

// 错误消息配置
export const ERROR_MESSAGES = {
  NO_SUBTITLES: "该视频暂无字幕",
  LOAD_FAILED: "字幕加载失败",
  NETWORK_ERROR: "网络请求失败",
  PARSE_ERROR: "数据解析失败",
  AUTH_REQUIRED: "需要登录后才能访问",
  INVALID_VIDEO: "无效的视频ID",
  SUBTITLE_FORMAT_ERROR: "字幕格式错误"
}

// 默认设置
export const DEFAULT_SETTINGS = {
  autoLoad: true,
  preferredLanguage: "zh",
  fallbackLanguage: "en",
  panelPosition: "right",
  panelWidth: 350,
  panelHeight: 600,
  fontSize: 14,
  maxRetries: 3,
  retryDelay: 1000,
  debugMode: false
}

// 样式主题
export const THEMES = {
  bilibili: {
    primary: "#00a1d6",
    background: "#fff",
    border: "#e1e5e9",
    text: "#18191c",
    secondary: "#61666d",
    hover: "#f7f8fa",
    fontFamily:
      "PingFang SC, HarmonyOS_Regular, Helvetica Neue, Microsoft YaHei, sans-serif"
  },
  youtube: {
    primary: "#1976d2",
    background: "#fff",
    border: "#e0e0e0",
    text: "#030303",
    secondary: "#606060",
    hover: "#f8f9fa",
    fontFamily: "Roboto, Arial, sans-serif"
  },
  dark: {
    primary: "#4fc3f7",
    background: "#1e1e1e",
    border: "#333",
    text: "#fff",
    secondary: "#aaa",
    hover: "#333",
    fontFamily: "system-ui, -apple-system, sans-serif"
  }
}

// 语言代码映射
export const LANGUAGE_CODES = {
  zh: ["zh", "zh-CN", "zh-Hans", "zh-TW", "zh-Hant"],
  en: ["en", "en-US", "en-GB"],
  ja: ["ja", "ja-JP"],
  ko: ["ko", "ko-KR"],
  es: ["es", "es-ES", "es-MX"],
  fr: ["fr", "fr-FR"],
  de: ["de", "de-DE"],
  ru: ["ru", "ru-RU"],
  pt: ["pt", "pt-BR", "pt-PT"],
  it: ["it", "it-IT"],
  ar: ["ar", "ar-SA"],
  hi: ["hi", "hi-IN"]
}

// 获取平台配置
export const getPlatformConfig = (url: string): PlatformConfig | null => {
  for (const [key, config] of Object.entries(PLATFORMS)) {
    if (url.includes(config.baseUrl)) {
      return config
    }
  }
  return null
}

// 提取视频ID
export const extractVideoId = (
  url: string,
  platform: string
): string | null => {
  const config = PLATFORMS[platform]
  if (!config) return null

  const match = url.match(config.videoUrlPattern)
  return match ? match[1] : null
}

// 获取首选语言
export const getPreferredLanguage = (
  availableLanguages: string[],
  preferred: string = "zh"
): string => {
  const preferredCodes = LANGUAGE_CODES[preferred] || [preferred]

  for (const code of preferredCodes) {
    if (availableLanguages.includes(code)) {
      return code
    }
  }

  // 如果没有找到首选语言，返回第一个可用的
  return availableLanguages[0] || ""
}

// 验证URL是否为支持的平台
export const isSupportedPlatform = (url: string): boolean => {
  return Object.values(PLATFORMS).some((config) => url.includes(config.baseUrl))
}

// 获取当前平台名称
export const getCurrentPlatform = (url: string): string | null => {
  for (const [key, config] of Object.entries(PLATFORMS)) {
    if (url.includes(config.baseUrl)) {
      return key
    }
  }
  return null
}

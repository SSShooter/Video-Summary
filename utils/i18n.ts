/**
 * 国际化工具函数
 * 简化chrome.i18n.getMessage的使用
 */

/**
 * 获取本地化消息
 * @param key 消息键名
 * @param substitutions 替换参数
 * @returns 本地化后的消息
 */
export function t(key: string, substitutions?: string | string[]): string {
  return chrome.i18n.getMessage(key, substitutions) || key
}

/**
 * 获取当前语言
 * @returns 当前语言代码
 */
export function getCurrentLanguage(): string {
  return chrome.i18n.getUILanguage()
}

/**
 * 检查是否为中文环境
 * @returns 是否为中文
 */
export function isChinese(): boolean {
  const lang = getCurrentLanguage().toLowerCase()
  return lang.includes('zh') || lang.includes('cn')
}

/**
 * 检查是否为英文环境
 * @returns 是否为英文
 */
export function isEnglish(): boolean {
  const lang = getCurrentLanguage().toLowerCase()
  return lang.includes('en')
}

/**
 * 格式化时间显示
 * @param seconds 秒数
 * @returns 格式化后的时间字符串
 */
export function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  } else {
    return `${minutes}:${secs.toString().padStart(2, '0')}`
  }
}

/**
 * 获取相对时间描述
 * @param seconds 秒数
 * @returns 相对时间描述
 */
export function getRelativeTimeDescription(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)

  if (hours > 0) {
    return `${hours}${t('hours')}${minutes}${t('minutes')}${secs}${t('seconds')}`
  } else if (minutes > 0) {
    return `${minutes}${t('minutes')}${secs}${t('seconds')}`
  } else {
    return `${secs}${t('seconds')}`
  }
}

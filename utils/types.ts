/**
 * 共享的类型定义
 */

export interface SubtitleSummary {
  summary: string
  keyPoints: string[]
  topics: string[]
}

export interface MindmapData {
  nodeData: {
    id: string
    topic: string
    [key: string]: any
  }
  [key: string]: any
}

/**
 * 解析器验证函数类型
 */
export type ValidatorFunction<T> = (obj: any) => obj is T

/**
 * 解析选项配置
 */
export interface ParseOptions {
  /** 是否启用文本解析备用方案 */
  enableTextFallback?: boolean
  /** 最大内容长度限制 */
  maxContentLength?: number
  /** 是否记录解析过程的警告信息 */
  logWarnings?: boolean
}

/**
 * 解析结果
 */
export interface ParseResult<T> {
  /** 解析成功的数据 */
  data: T
  /** 使用的解析方法 */
  method: 'direct' | 'codeblock' | 'bracket' | 'text-fallback'
  /** 是否有警告信息 */
  hasWarnings: boolean
  /** 警告信息列表 */
  warnings: string[]
}

/**
 * HTML到Markdown转换工具
 * 提供更准确的HTML到Markdown转换功能
 */

export interface ConversionOptions {
  preserveWhitespace?: boolean
  maxLength?: number
  includeImages?: boolean
  includeLinks?: boolean
}

export class HtmlToMarkdownConverter {
  private options: ConversionOptions

  constructor(options: ConversionOptions = {}) {
    this.options = {
      preserveWhitespace: false,
      maxLength: 10000,
      includeImages: true,
      includeLinks: true,
      ...options
    }
  }

  /**
   * 将HTML元素转换为Markdown
   */
  convert(element: Element): string {
    const markdown = this.processNode(element)
    return this.cleanupMarkdown(markdown)
  }

  /**
   * 处理DOM节点
   */
  private processNode(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || ''
      return this.options.preserveWhitespace ? text : text.trim()
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as Element
      return this.processElement(element)
    }

    return ''
  }

  /**
   * 处理HTML元素
   */
  private processElement(element: Element): string {
    const tagName = element.tagName.toLowerCase()
    const children = Array.from(element.childNodes)
      .map(child => this.processNode(child))
      .join('')

    // 跳过不需要的元素
    if (this.shouldSkipElement(element)) {
      return ''
    }

    switch (tagName) {
      case 'h1':
        return `\n# ${children.trim()}\n\n`
      case 'h2':
        return `\n## ${children.trim()}\n\n`
      case 'h3':
        return `\n### ${children.trim()}\n\n`
      case 'h4':
        return `\n#### ${children.trim()}\n\n`
      case 'h5':
        return `\n##### ${children.trim()}\n\n`
      case 'h6':
        return `\n###### ${children.trim()}\n\n`
      
      case 'p':
        return `\n${children.trim()}\n\n`
      
      case 'br':
        return '\n'
      
      case 'strong':
      case 'b':
        return `**${children.trim()}**`
      
      case 'em':
      case 'i':
        return `*${children.trim()}*`
      
      case 'code':
        return `\`${children.trim()}\``
      
      case 'pre':
        return `\n\`\`\`\n${children.trim()}\n\`\`\`\n\n`
      
      case 'blockquote':
        const quotedLines = children.trim().split('\n')
          .map(line => `> ${line}`)
          .join('\n')
        return `\n${quotedLines}\n\n`
      
      case 'ul':
        return `\n${children}\n`
      
      case 'ol':
        return `\n${this.processOrderedList(element)}\n`
      
      case 'li':
        const listContent = children.trim()
        const parent = element.parentElement
        if (parent && parent.tagName.toLowerCase() === 'ol') {
          const index = Array.from(parent.children).indexOf(element) + 1
          return `${index}. ${listContent}\n`
        }
        return `- ${listContent}\n`
      
      case 'a':
        if (!this.options.includeLinks) {
          return children
        }
        const href = element.getAttribute('href')
        if (href && href.startsWith('http')) {
          return `[${children.trim()}](${href})`
        }
        return children
      
      case 'img':
        if (!this.options.includeImages) {
          return ''
        }
        const src = element.getAttribute('src')
        const alt = element.getAttribute('alt') || '图片'
        if (src) {
          return `![${alt}](${src})`
        }
        return ''
      
      case 'table':
        return this.processTable(element)
      
      case 'hr':
        return '\n---\n\n'
      
      case 'div':
      case 'section':
      case 'article':
      case 'main':
      case 'span':
        return children
      
      default:
        return children
    }
  }

  /**
   * 处理有序列表
   */
  private processOrderedList(element: Element): string {
    const items = Array.from(element.children)
      .filter(child => child.tagName.toLowerCase() === 'li')
      .map((li, index) => {
        const content = this.processNode(li).trim()
        return `${index + 1}. ${content}`
      })
    return items.join('\n')
  }

  /**
   * 处理表格
   */
  private processTable(element: Element): string {
    const rows = Array.from(element.querySelectorAll('tr'))
    if (rows.length === 0) return ''

    const tableRows = rows.map(row => {
      const cells = Array.from(row.querySelectorAll('td, th'))
      return '| ' + cells.map(cell => this.processNode(cell).trim()).join(' | ') + ' |'
    })

    // 添加表头分隔符
    if (tableRows.length > 0) {
      const headerRow = tableRows[0]
      const cellCount = (headerRow.match(/\|/g) || []).length - 1
      const separator = '|' + ' --- |'.repeat(cellCount)
      tableRows.splice(1, 0, separator)
    }

    return '\n' + tableRows.join('\n') + '\n\n'
  }

  /**
   * 判断是否应该跳过某个元素
   */
  private shouldSkipElement(element: Element): boolean {
    const tagName = element.tagName.toLowerCase()
    const skipTags = ['script', 'style', 'nav', 'header', 'footer', 'aside', 'noscript']
    
    if (skipTags.includes(tagName)) {
      return true
    }

    // 跳过隐藏元素
    const style = window.getComputedStyle(element)
    if (style.display === 'none' || style.visibility === 'hidden') {
      return true
    }

    // 跳过广告和导航相关的类名
    const className = element.className
    if (className && typeof className === 'string') {
      const lowerClassName = className.toLowerCase()
      const skipClasses = ['ad', 'advertisement', 'nav', 'menu', 'sidebar', 'footer', 'header']
      if (skipClasses.some(cls => lowerClassName.includes(cls))) {
        return true
      }
    } else if (className && typeof className === 'object' && className.toString) {
      // 处理DOMTokenList情况
      const classString = className.toString().toLowerCase()
      const skipClasses = ['ad', 'advertisement', 'nav', 'menu', 'sidebar', 'footer', 'header']
      if (skipClasses.some(cls => classString.includes(cls))) {
        return true
      }
    }

    return false
  }

  /**
   * 清理和优化Markdown文本
   */
  private cleanupMarkdown(markdown: string): string {
    let cleaned = markdown
      // 移除多余的空行
      .replace(/\n{3,}/g, '\n\n')
      // 移除行首行尾的空格
      .replace(/^\s+|\s+$/gm, '')
      // 移除空的标题
      .replace(/^#{1,6}\s*$/gm, '')
      // 移除空的列表项
      .replace(/^[-*+]\s*$/gm, '')
      // 移除空的引用
      .replace(/^>\s*$/gm, '')
      .trim()

    // 限制长度
    if (this.options.maxLength && cleaned.length > this.options.maxLength) {
      cleaned = cleaned.substring(0, this.options.maxLength)
      // 尝试在句号处截断
      const lastPeriod = cleaned.lastIndexOf('。')
      const lastNewline = cleaned.lastIndexOf('\n')
      const cutPoint = Math.max(lastPeriod, lastNewline)
      if (cutPoint > this.options.maxLength * 0.8) {
        cleaned = cleaned.substring(0, cutPoint + 1)
      }
      cleaned += '\n\n[内容已截断...]'
    }

    return cleaned
  }
}

/**
 * 便捷函数：将HTML元素转换为Markdown
 */
export function htmlToMarkdown(element: Element, options?: ConversionOptions): string {
  const converter = new HtmlToMarkdownConverter(options)
  return converter.convert(element)
}

/**
 * 便捷函数：从选择器获取元素并转换为Markdown
 */
export function selectorToMarkdown(selector: string, options?: ConversionOptions): string | null {
  const element = document.querySelector(selector)
  if (!element) return null
  
  return htmlToMarkdown(element, options)
}

/**
 * 智能检测并转换页面主要内容为Markdown
 */
export function detectAndConvertArticle(options?: ConversionOptions): string | null {
  // 常见的文章容器选择器，按优先级排序
  const selectors = [
    'article',
    '[role="main"] article',
    '.post-content',
    '.article-content',
    '.entry-content',
    '.content',
    '.post-body',
    '.article-body',
    'main',
    '.markdown-body',
    '.prose',
    '[role="main"]'
  ]

  // 尝试每个选择器
  for (const selector of selectors) {
    const element = document.querySelector(selector)
    if (element) {
      const textContent = element.textContent || ''
      // 确保内容足够长才认为是文章
      if (textContent.trim().length > 500) {
        return htmlToMarkdown(element, options)
      }
    }
  }

  // 如果没找到明确的文章容器，尝试智能检测
  const allElements = document.querySelectorAll('div, section, main')
  for (const element of allElements) {
    const textContent = element.textContent || ''
    const childElements = element.children.length
    
    // 判断是否为文章：文本长度 > 1000 且子元素不太多（避免选中整个页面）
    if (textContent.trim().length > 1000 && childElements < 50) {
      // 进一步验证：检查是否包含段落结构
      const paragraphs = element.querySelectorAll('p')
      if (paragraphs.length >= 3) {
        return htmlToMarkdown(element, options)
      }
    }
  }

  return null
}
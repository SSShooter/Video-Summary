import TurndownService from 'turndown'

/**
 * 检测并转换文章内容为Markdown格式
 * 使用turndown库将HTML内容转换为Markdown
 * @returns {string} 转换后的Markdown文本
 */
export function detectAndConvertArticle(): string {
  try {
    // 创建turndown实例
    const turndownService = new TurndownService({
      headingStyle: 'atx', // 使用 # 风格的标题
      hr: '---', // 水平线样式
      bulletListMarker: '-', // 无序列表标记
      codeBlockStyle: 'fenced', // 代码块样式
      fence: '```', // 代码块围栏
      emDelimiter: '*', // 斜体分隔符
      strongDelimiter: '**', // 粗体分隔符
      linkStyle: 'inlined', // 链接样式
      linkReferenceStyle: 'full' // 链接引用样式
    })

    // 添加自定义规则，处理特殊元素
    turndownService.addRule('removeScript', {
      filter: ['script', 'style', 'noscript'],
      replacement: () => ''
    })

    // 处理图片，保留alt和src属性
    turndownService.addRule('images', {
      filter: 'img',
      replacement: (content, node) => {
        const alt = (node as HTMLElement).getAttribute('alt') || ''
        const src = (node as HTMLElement).getAttribute('src') || ''
        return src ? `![${alt}](${src})` : ''
      }
    })

    // 处理代码块
    turndownService.addRule('codeBlocks', {
      filter: 'pre',
      replacement: (content, node) => {
        const code = node.textContent || ''
        const language = node.querySelector('code')?.className?.match(/language-(\w+)/)?.[1] || ''
        return `\n\`\`\`${language}\n${code}\n\`\`\`\n`
      }
    })

    // 获取页面主要内容区域
    const contentSelectors = [
      'article',
      '[role="main"]',
      '.article-content',
      '.post-content',
      '.entry-content',
      '.content',
      'main',
      '#content',
      '.main-content'
    ]

    let contentElement: Element | null = null
    
    // 尝试找到主要内容区域
    for (const selector of contentSelectors) {
      contentElement = document.querySelector(selector)
      if (contentElement) break
    }

    // 如果没有找到特定的内容区域，使用body
    if (!contentElement) {
      contentElement = document.body
    }

    // 克隆元素以避免修改原始DOM
    const clonedElement = contentElement.cloneNode(true) as Element

    // 移除不需要的元素
    const unwantedSelectors = [
      'nav', 'header', 'footer', 'aside',
      '.navigation', '.sidebar', '.menu',
      '.advertisement', '.ads', '.social-share',
      '.comments', '.comment-section',
      'script', 'style', 'noscript'
    ]

    unwantedSelectors.forEach(selector => {
      const elements = clonedElement.querySelectorAll(selector)
      elements.forEach(el => el.remove())
    })

    // 转换为Markdown
    const markdown = turndownService.turndown(clonedElement as HTMLElement)

    // 清理多余的空行
    const cleanedMarkdown = markdown
      .replace(/\n\s*\n\s*\n/g, '\n\n') // 将多个空行替换为两个换行
      .replace(/^\s+|\s+$/g, '') // 去除首尾空白
      .trim()

    return cleanedMarkdown

  } catch (error) {
    console.error('HTML到Markdown转换失败:', error)
    return ''
  }
}

/**
 * 将指定的HTML元素转换为Markdown
 * @param element HTML元素
 * @returns {string} 转换后的Markdown文本
 */
export function htmlElementToMarkdown(element: Element): string {
  try {
    const turndownService = new TurndownService({
      headingStyle: 'atx',
      hr: '---',
      bulletListMarker: '-',
      codeBlockStyle: 'fenced',
      fence: '```',
      emDelimiter: '*',
      strongDelimiter: '**',
      linkStyle: 'inlined'
    })

    return turndownService.turndown(element as HTMLElement)
  } catch (error) {
    console.error('元素转换为Markdown失败:', error)
    return element.textContent || ''
  }
}

/**
 * 将HTML字符串转换为Markdown
 * @param html HTML字符串
 * @returns {string} 转换后的Markdown文本
 */
export function htmlStringToMarkdown(html: string): string {
  try {
    const turndownService = new TurndownService({
      headingStyle: 'atx',
      hr: '---',
      bulletListMarker: '-',
      codeBlockStyle: 'fenced',
      fence: '```',
      emDelimiter: '*',
      strongDelimiter: '**',
      linkStyle: 'inlined'
    })

    return turndownService.turndown(html)
  } catch (error) {
    console.error('HTML字符串转换为Markdown失败:', error)
    return html.replace(/<[^>]*>/g, '') // 简单去除HTML标签
  }
}
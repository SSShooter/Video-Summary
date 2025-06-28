export interface ArticleInfo {
  title: string
  content: string
  url: string
}

/**
 * 检测页面是否包含文章内容
 * @returns ArticleInfo | null - 如果检测到文章内容则返回文章信息，否则返回null
 */
export const detectArticle = (): ArticleInfo | null => {
  // 常见的文章容器选择器
  const articleSelectors = [
    'article',
    '[role="main"]',
    '.post-content',
    '.article-content',
    '.entry-content',
    '.content',
    '.post-body',
    '.article-body',
    'main',
    '.markdown-body',
    '.prose'
  ]


  let articleElement: Element | null = null

  // 查找文章容器
  for (const selector of articleSelectors) {
    const element = document.querySelector(selector)
    if (element && element.textContent && element.textContent.trim().length > 500) {
      articleElement = element
      break
    }
  }

  // 如果没找到明确的文章容器，尝试查找包含大量文本的元素
  if (!articleElement) {
    const allElements = document.querySelectorAll('div, section, main')
    for (const element of allElements) {
      const textContent = element.textContent || ''
      const childElements = element.children.length
      // 判断是否为文章：文本长度 > 1000 且子元素不太多（避免选中整个页面）
      if (textContent.trim().length > 1000 && childElements < 50) {
        articleElement = element
        break
      }
    }
  }

  if (!articleElement) {
    return null
  }

  const title = document.title || '未知标题'
  const content = articleElement.textContent?.trim() || ''

  // 最终验证：确保内容足够长
  if (content.length < 500) {
    return null
  }

  return {
    title,
    content,
    url: window.location.href
  }
}
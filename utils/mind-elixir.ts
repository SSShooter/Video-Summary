export function openAppWithFallback(url: string) {
    return new Promise((resolve, reject) => {
        const now = Date.now();

        // 1. 尝试打开协议
        const iframe = document.createElement("iframe");
        iframe.style.display = "none";
        iframe.src = url;
        document.body.appendChild(iframe);

        // 2. 设置 fallback 超时（可视浏览器行为调整）
        setTimeout(() => {
            const delta = Date.now() - now;
            if (delta < 1500) {
                // 协议打开成功
                window.open('https://desktop.mind-elixir.com/', '_blank')
                reject("未安装 Mind Elixir Desktop")
            }
            else {
                // 用户已离开页面，认为已安装
                resolve(true);
            }
        }, 1000);
    })
}

/**
 * 等待服务可用
 * @param url 服务URL
 * @param timeout 超时时间（毫秒）
 */
export const waitForService = (url: string, timeout: number = 10000): Promise<void> => {
  return new Promise((resolve, reject) => {
    const startTime = Date.now()

    const checkService = async () => {
      try {
        const response = await fetch(url)
        if (response.ok) {
          resolve()
          return
        }
      } catch (error) {
        // 服务还未启动，继续等待
      }

      // 检查是否超时
      if (Date.now() - startTime > timeout) {
        reject(new Error('服务启动超时'))
        return
      }

      // 100ms后再次检查
      setTimeout(checkService, 100)
    }

    checkService()
  })
}

/**
 * Mind Elixir 思维导图数据接口
 */
export interface MindmapData {
  [key: string]: any
}

/**
 * 启动 Mind Elixir 并发送思维导图数据
 * @param mindmapData 思维导图数据
 * @param source 数据来源URL
 * @param options 配置选项
 */
export const launchMindElixir = async (
  mindmapData: MindmapData,
  source?: string,
  options: {
    appUrl?: string
    serviceUrl?: string
    pingUrl?: string
    timeout?: number
  } = {}
): Promise<void> => {
  const {
    appUrl = 'mind-elixird://open',
    serviceUrl = 'http://127.0.0.1:6595/create-mindmap',
    pingUrl = 'http://127.0.0.1:6595/ping',
    timeout = 10000
  } = options

  // 打开 Mind Elixir 应用
  await openAppWithFallback(appUrl)

  // 等待服务可用
  await waitForService(pingUrl, timeout)

  // 发送思维导图数据
  const response = await fetch(serviceUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      mindmap: JSON.stringify(mindmapData),
      source: source || window.location.href.split('?')[0]
    })
  })

  if (!response.ok) {
    throw new Error('发送思维导图数据失败')
  }

  console.log('思维导图已成功发送到 Mind Elixir')
}
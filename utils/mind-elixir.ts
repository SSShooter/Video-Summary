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
                window.open('https://your-app.com/download', '_blank')
                reject("未安装 Mind Elixir Desktop")
            }
            else {
                // 用户已离开页面，认为已安装
                resolve(true);
            }
        }, 1000);
    })
}
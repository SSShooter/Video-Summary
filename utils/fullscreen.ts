import type { MindElixirInstance } from "mind-elixir/dist/types"

export const fullscreen = (mei: MindElixirInstance) => {
  const el = mei.el!
  el.requestFullscreen()
  setTimeout(() => {
    console.log(mei)
    mei.scaleFit()
    mei.toCenter()
    el.addEventListener('fullscreenchange', () => {
      console.log('fullscreenchange');
      if (!document.fullscreenElement) {
        console.log('元素已退出全屏');
        mei.scale(0.5)
        mei.toCenter()
      }
    }, {
      once: true
    });
  }, 100)
}
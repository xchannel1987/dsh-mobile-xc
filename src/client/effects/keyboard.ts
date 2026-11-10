/**
 * keyboard-inset — 软键盘适配（v0.6.8）。
 *
 * 症状（iPhone 14 Pro 真机）：键盘弹起后 composer 与键盘之间空出一大块；键盘收起后页面
 * 停在半空（内容整体上移、下方一片空白），怎么都回不到顶部。
 *
 * 根因：iOS 不会因键盘缩小布局视口（`innerHeight` / `100dvh` 纹丝不动，键盘只是盖住下半屏）。
 * composer 贴在帧底（= 823/852），正好被键盘盖住；WebKit 为露出光标就自己把页面/视觉视口
 * 往上推（推多少不由我们控制，于是「空隙过大」），键盘收起后又不会把这笔滚动还回去
 * （于是「关掉键盘页面没恢复」）。
 *
 * 做法：以 `visualViewport` 为准算出键盘占位，键盘在场时把 AppFrame 的高度直接改成
 * 「可视区底边」（frame 顶边恒在文档 0 点，且键盘期间强制 scrollY=0），composer 就精确落在
 * 键盘上沿，WebKit 也不再需要自己推页面。键盘占位小于 80px（收起工具条这类几十像素的变化）
 * 完全不动，交回原生的 dvh。
 */
const KEYBOARD_MIN = 80
const FRAME_MIN = 120

export function installKeyboardInset(): () => void {
  const vv = typeof window === 'undefined' ? null : window.visualViewport
  if (vv === null || vv === undefined) return () => {}
  const root = document.documentElement
  let raf = 0
  let alive = true

  const setFrame = (px: number | null, top = 0): void => {
    if (px === null) {
      root.style.removeProperty('--dsh-xc-frame-h')
      root.style.removeProperty('--dsh-xc-frame-top')
    } else {
      root.style.setProperty('--dsh-xc-frame-h', Math.max(FRAME_MIN, Math.round(px)) + 'px')
      root.style.setProperty('--dsh-xc-frame-top', Math.round(top) + 'px')
    }
  }

  const apply = (): void => {
    if (!alive) return
    try {
      // 键盘占位恒等于「布局视口高 - 可视视口高」——**不能减 offsetTop**：
      // iOS 为把光标露出来会先把可视视口往下滚（offsetTop > 0），减掉它会让键盘高度算成 0，
      // 于是"大部分时候不生效、输入框留在键盘下面"（0.6.10 及以前的实际症状）。
      const keyboard = Math.round(window.innerHeight - vv.height)
      if (keyboard >= KEYBOARD_MIN) {
        // 帧高 = 可视视口高，帧顶下移 offsetTop：帧底边恒等于可视区底边（= 键盘上沿）
        setFrame(vv.height, vv.offsetTop)
        // 供 CSS 判断键盘状态（底部安全区此时被键盘盖住，不需要再留白）
        if (root.dataset.xcKb !== '1') root.dataset.xcKb = '1'
        // 键盘期间清掉 WebKit 为露光标自己加的那笔滚动（这正是「关掉键盘回不去」的残留）
        if (window.scrollY !== 0) window.scrollTo(0, 0)
      } else {
        setFrame(null)
        if (root.dataset.xcKb !== undefined) delete root.dataset.xcKb
        if (window.scrollY !== 0) window.scrollTo(0, 0)
      }
    } catch {
      /* 任何异常都不允许影响页面 */
    }
  }

  const schedule = (): void => {
    if (raf !== 0 || !alive) return
    raf = requestAnimationFrame(() => {
      raf = 0
      apply()
    })
  }

  // 键盘收起时 iOS 的收尾事件常常晚于 focusout，补两拍兜底还原
  const afterBlur = (): void => {
    if (!alive) return
    const a = setTimeout(apply, 250)
    const b = setTimeout(apply, 650)
    timers.push(a, b)
  }

  const timers: ReturnType<typeof setTimeout>[] = []
  vv.addEventListener('resize', schedule)
  vv.addEventListener('scroll', schedule)
  document.addEventListener('focusout', afterBlur, true)
  window.addEventListener('orientationchange', afterBlur)
  apply()

  return () => {
    alive = false
    if (raf !== 0) cancelAnimationFrame(raf)
    for (const t of timers) clearTimeout(t)
    vv.removeEventListener('resize', schedule)
    vv.removeEventListener('scroll', schedule)
    document.removeEventListener('focusout', afterBlur, true)
    window.removeEventListener('orientationchange', afterBlur)
    root.style.removeProperty('--dsh-xc-frame-h')
    delete root.dataset.xcKb
  }
}
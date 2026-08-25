/**
 * focus-guard — 键盘防弹起（对治：会话切换后 vendor 自动聚焦 composer -> 手机键盘弹出）。
 * 策略：只有用户亲手点进 composer（pointerdown 落在 composer 内）才放行聚焦；
 * 其余任何进入 composer 的焦点（含导航副作用、程序自动聚焦）一律 blur。
 * 窄屏范围内生效（由 installMobileEffect 装配）。
 */

const NOOP = (): void => {}

const COMPOSER_SEL = '[data-slot^="conversation.composer"], [data-composer-seat]'

const isComposerEl = (el: Element): boolean => el.closest(COMPOSER_SEL) !== null

export function installFocusGuard(): () => void {
  if (typeof document === 'undefined') return NOOP
  let allowFocus = false
  const onPointerDown = (event: PointerEvent): void => {
    allowFocus = event.target instanceof Element && isComposerEl(event.target)
  }
  const onFocusIn = (event: FocusEvent): void => {
    if (allowFocus) return
    const target = event.target
    if (target instanceof HTMLElement && isComposerEl(target)) target.blur()
  }
  document.addEventListener('pointerdown', onPointerDown)
  document.addEventListener('focusin', onFocusIn)
  return () => {
    document.removeEventListener('pointerdown', onPointerDown)
    document.removeEventListener('focusin', onFocusIn)
  }
}

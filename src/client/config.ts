/**
 * config — 通用与兼容开关（未来接入设置 UI 后逐项可配；当前默认值即行为）。
 */
export interface CompatOptions {
  /** dshmarket >=1.20 在 <=560px 隐藏设置 nav 的死路反制（镜像媒体查询）。 */
  readonly dshmarketNavFix: boolean
  /** 与 dsh-better-sidebar 和平共存（决策 1）：不隐藏其 toggle、不占用其 panel-host。 */
  readonly betterSidebarCoexist: boolean
  /** dsh-token-usage 徽标排布兼容（当前无冲突规则，仅登记对账）。 */
  readonly tokenUsageGlue: boolean
}

export const COMPAT: CompatOptions = {
  dshmarketNavFix: true,
  betterSidebarCoexist: true,
  tokenUsageGlue: true,
}

export interface GestureOptions {
  /** 跟手拖拽（决策 2：实现但默认关）。false = 一次性 swipe 触发（默认）。 */
  readonly dragEnabled: boolean
  /** 触发阈值（px）。 */
  readonly swipeThresholdPx: number
}

export const GESTURE: GestureOptions = {
  dragEnabled: false,
  swipeThresholdPx: 64,
}

/**
 * selector-map — 哈希类选择器登记制 + canary 失配自检（TecFancy 思想）。
 *
 * 政策：
 *  - 优先 data-* 语义属性锚 / 结构性选择器；
 *  - 只有两者都不可用时才允许哈希类，且必须在此登记
 *    { selector, dshVersion, usedBy, reason, fallback }；
 *  - 选择器用带完整哈希前缀的类名（等价 [class*="<hash>_<local>"]，哈希前缀由
 *    CSS Modules 生成、模块内唯一，无前缀重叠误伤；漂移由 canary 兜底）；
 *  - M2 已登记 composer/header 条目（dsh 0.1.1-rc.2 验证）。
 */

export interface SelectorEntry {
  /** 哈希类选择器（带完整前缀），如 '.uV2eYG_card'。 */
  selector: string
  /** 校验通过的 DSH 版本。 */
  dshVersion: string
  /** 使用方（里程碑/功能）。 */
  usedBy: string
  /** 为何 data-slot/结构锚不够用。 */
  reason: string
  /** 漂移时的兜底行为（必须可执行）。 */
  fallback: string
}

export const SELECTOR_MAP: SelectorEntry[] = [
  {
    selector: '.uV2eYG_card',
    dshVersion: '0.1.1-rc.2',
    usedBy: 'M2 composer 玻璃卡片（compat.css.ts）',
    reason: 'composer.bar slot 之下无更细语义锚；卡片本体即玻璃拟态作用面',
    fallback: '结构定位 [data-slot="conversation.composer.bar"] 的卡片性祖先或丢弃样式规则（功能不受影响）',
  },
  {
    selector: '.uV2eYG_mirror',
    dshVersion: '0.1.1-rc.2',
    usedBy: 'M2 输入区高度（min-height 24/60）',
    reason: '镜像文本是卡片高度的排版驱动；无语义锚',
    fallback: '按 [data-slot="conversation.composer.bar"] 内部 textarea 镜像定位',
  },
  {
    selector: '.uV2eYG_row',
    dshVersion: '0.1.1-rc.2',
    usedBy: 'M2 一行契约（flex-wrap: nowrap）',
    reason: '工具栏行无语义锚；行内固定控件重叠风险由几何断言守护',
    fallback: '结构定位 row = 第 4 个 flex 子元素；不变式：add/send 不重叠',
  },
  {
    selector: '.uV2eYG_tools',
    dshVersion: '0.1.1-rc.2',
    usedBy: 'M2 工具栏间距（gap 6）',
    reason: '无更细语义锚',
    fallback: '结构定位 row 首个子元素；不变式：图标控件 28px 不被压缩',
  },
  {
    selector: '.uV2eYG_trailing',
    dshVersion: '0.1.1-rc.2',
    usedBy: 'M2 右侧车道（flex 1 + justify-end）',
    reason: 'model/send 所在车道无语义锚',
    fallback: '结构定位 row 末个子元素；不变式：send 贴右缘且不与 model 重叠',
  },
  {
    selector: '.uV2eYG_add',
    dshVersion: '0.1.1-rc.2',
    usedBy: 'M2 固定控件豁免 + 44px 热区',
    reason: 'add 28x28 图标按钮；无语义锚',
    fallback: '结构定位 row 首按钮；不变式：28px 不被压缩',
  },
  {
    selector: '.uV2eYG_primary',
    dshVersion: '0.1.1-rc.2',
    usedBy: 'M2 发送键钉死 34px + 44px 热区',
    reason: '发送键无语义锚',
    fallback: '结构定位 trailing 末按钮；不变式：34px + 贴右缘',
  },
  {
    selector: '.uV2eYG_root',
    dshVersion: '0.1.1-rc.2',
    usedBy: 'M2 底部 safe-area',
    reason: 'composer 根容器无独立锚',
    fallback: '结构定位 composer.bar 祖链第一个 flex 列',
  },
  {
    selector: '._7KE1Ra_trigger',
    dshVersion: '0.1.1-rc.2',
    usedBy: 'M2 模型选择器收缩（max-width/min-width:0）',
    reason: '选择器按钮无语义锚；一行下必须可收缩',
    fallback: '结构定位 trailing 首按钮；不变式：不重叠 send',
  },
  {
    selector: '._7KE1Ra_triggerLabel',
    dshVersion: '0.1.1-rc.2',
    usedBy: 'M2 模型名 ellipsis',
    reason: 'label 无语义锚；需 min-width:0 + ellipsis',
    fallback: '结构定位 trigger 首 span；不变式：溢出省略而非换行',
  },
  {
    selector: '.wSkVaW_titleRow',
    dshVersion: '0.1.1-rc.2',
    usedBy: 'M2 汉堡避让（padding-left 52px）',
    reason: '标题行无语义锚；汉堡固定于 frame 左上',
    fallback: '结构定位 header 下 title 行；不变式：标题不被汉堡遮挡',
  },
  {
    selector: '.wSkVaW_tabs',
    dshVersion: '0.1.1-rc.2',
    usedBy: 'M5 汉堡避让：标签行（对话/轨迹）margin-left 52px',
    reason: '标签行无语义锚；汉堡固定于 frame 左上',
    fallback: '结构定位 header 下 tabs 行；不变式：标签不被汉堡遮挡',
  },
  {
    selector: '.VOzbGW_panel',
    dshVersion: '0.1.1-rc.2',
    usedBy: 'M3 设置面板全屏（misc.css.ts）',
    reason: '对话框 portal 进侧栏 DOM；面板本身无语义锚',
    fallback: '结构定位 [role="dialog"][aria-modal] 面板性后代；不变式：全屏可用',
  },
  {
    selector: '.VOzbGW_nav',
    dshVersion: '0.1.1-rc.2',
    usedBy: 'M3 设置导航横向滚动条（nav 修复）',
    reason: '导航无语义锚；flex-basis:0 压零 bug 需定向修复',
    fallback: '结构定位 dialog 首个 nav 子元素；不变式：标签可见可点',
  },
  {
    selector: '.cubgiG_item',
    dshVersion: '0.1.1-rc.2',
    usedBy: 'M3 agent-preset 底部弹层（:has 圈定）',
    reason: 'body portal [role=menu] 需精确圈定防误伤其他菜单',
    fallback: '若漂移：改按菜单 position:fixed + bottom:12px 的几何特征或删除该规则',
  },
  {
    selector: '[class*="_scrollBody"]',
    dshVersion: '0.1.1-rc.2',
    usedBy: 'M3 消息滚动条毛刺修复',
    reason: 'data-phase 下滚动体无语义锚；子串匹配已加 :not(_scroll) 守卫',
    fallback: '不变式：移动端滚动条不可见；漂移则删除样式（视觉毛刺可接受）',
  },
  {
    selector: '[class*="_actions"]',
    dshVersion: '0.1.1-rc.2',
    usedBy: 'M3 消息操作行溢出保护',
    reason: '操作行容器无语义锚；_[action]/_actions 族已用完整子串防误伤',
    fallback: '不变式：操作行不出右缘；漂移则删除',
  },
  {
    selector: '[class*="_timeEnd"]',
    dshVersion: '0.1.1-rc.2',
    usedBy: 'M3 时间徽标 ellipsis',
    reason: '徽标无语义锚',
    fallback: '不变式：徽标不换行不溢出；漂移则删除',
  },
  {
    selector: '.nArs4W_panel',
    dshVersion: '0.1.1-rc.2',
    usedBy: 'M5 better-sidebar 右抽屉打开时隐藏汉堡',
    reason: '外部插件（dsh-better-sidebar 0.15.2）面板类，无 data-* 语义锚',
    fallback: '若漂移：删除该规则（汉堡不隐藏，功能不受影响）',
  },
  {
    selector: '.nArs4W_panelHidden',
    dshVersion: '0.1.1-rc.2',
    usedBy: 'M5 better-sidebar 面板可见性判定（:not 排除）',
    reason: '面板隐藏态类，无语义锚',
    fallback: '若漂移：删除该规则（保守处理）',
  },
]

export interface StructuralAnchors {
  /** vendor shell 覆盖层锚（抽屉/frame 定位依赖）。 */
  shellOverlay: boolean
  /** composer 语义锚（vendor data-slot 契约）。 */
  composerSlot: boolean
  /** frame 子结构形状：至少 3 个直系子元素（侧栏/聊天/details）。 */
  frameShape: boolean
}

export interface HashedCheck {
  /** 命中的登记条目数。 */
  hits: number
  /** 登记条目总数。 */
  declared: number
  /** 未命中的条目（警告来源）。 */
  missing: SelectorEntry[]
}

export function checkStructuralAnchors(doc: Document): StructuralAnchors {
  const overlay = doc.querySelector('[data-shell-overlay]')
  const frame = overlay === null ? null : overlay.parentElement
  return {
    shellOverlay: overlay !== null,
    composerSlot: doc.querySelector('[data-slot="conversation.composer.bar"]') !== null,
    frameShape: frame !== null && frame.children.length >= 3,
  }
}

export function checkHashedSelectors(root: ParentNode = document): HashedCheck {
  const missing: SelectorEntry[] = []
  let hits = 0
  for (const entry of SELECTOR_MAP) {
    let found = false
    try {
      found = root.querySelector(entry.selector) !== null
    } catch {
      found = false
    }
    if (found) hits++
    else missing.push(entry)
  }
  return { hits, declared: SELECTOR_MAP.length, missing }
}

/** 生成 canary 告警文案；一切正常返回 null（不打扰）。 */
export function formatCanaryReport(
  structural: StructuralAnchors,
  hashed: HashedCheck,
): string | null {
  const notes: string[] = []
  if (!structural.shellOverlay) notes.push('缺少 [data-shell-overlay]（shell 结构可能是新版）')
  if (!structural.composerSlot) notes.push('缺少 composer data-slot（composer 可能是新版）')
  if (!structural.frameShape) notes.push('frame 直系子结构异常（抽屉定位可能失效）')
  if (hashed.missing.length > 0 && hashed.hits === 0) {
    // 一条都没命中：真正的结构失配，逐条列出
    for (const entry of hashed.missing) {
      notes.push(
        entry.selector +
          ' 未命中（登记于 dsh ' +
          entry.dshVersion +
          '，兜底：' +
          entry.fallback +
          '）',
      )
    }
  } else if (hashed.missing.length > 0 && hashed.hits > 0) {
    // 部分命中：多为「当前页面状态未渲染该组件」（如无会话时的 composer 简化态），不算失配
    notes.push(
      '部分登记选择器未渲染（命中 ' +
        hashed.hits +
        '/' +
        hashed.declared +
        '），可能仅因当前页面状态未挂载该组件，已生效能力不受影响',
    )
  }
  if (notes.length === 0) return null
  return (
    'canary：检测到 ' +
    notes.length +
    ' 处与本版 DSH 可能失配，已按兜底降级（最坏=桌面原状）：\n  - ' +
    notes.join('\n  - ')
  )
}
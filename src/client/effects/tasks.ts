/**
 * tasks — 任务装配：把各里程碑 reconciler 任务注册进 core。
 * 返回 disposer（同环境插件重载时可重建）。
 */
import type { ReconcilerCore } from '../core/reconciler-core.ts'
import { createFrameMarkerTask, createDrawerChromeTask } from './drawer.ts'
import { createComposerHeightTask } from './composer.ts'
import { createMarketNavTask } from './compat.ts'
import { createHideAddWorkspaceTask } from './workspace-compat.ts'

export function registerDrawerTasks(core: ReconcilerCore, toggleSidebar: () => void): () => void {
  const removeMarker = core.register(createFrameMarkerTask())
  const removeChrome = core.register(createDrawerChromeTask(toggleSidebar))
  return () => {
    removeMarker()
    removeChrome()
  }
}

export function registerComposerTasks(core: ReconcilerCore): () => void {
  return core.register(createComposerHeightTask())
}

export function registerCompatTasks(core: ReconcilerCore): () => void {
  const removeMarket = core.register(createMarketNavTask())
  const removeHideAdd = core.register(createHideAddWorkspaceTask())
  return () => {
    removeMarket()
    removeHideAdd()
  }
}
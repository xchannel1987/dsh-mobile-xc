# dsh-mobile-xc

DSH Web 移动端 UI 适配「集大成」插件：整合 dsh-mobile-glass / dsh-mobile-nav /
dsh-mobile(TecFancy) / dsh-mobile-webui / dsh-web-mobile-fix 的最优设计。

- 断点：<=1023px 激活移动适配（与 vendor SIDEBAR_AUTO_COLLAPSE=1024 对齐），>=1024px 桌面零影响。
- 核心能力（随里程碑逐步落地）：overlay 抽屉、safe-area 全覆盖、canary 失配自检
  （软告警 + 兜底降级）、reconciler 单观察者调度、PWA（官方黑鲸鱼图标）。
- 详细需求与方案：D:/workspace/requirements/dsh-mobile-xc/

## 状态（里程碑进度）

| 里程碑 | 内容 | 状态 |
|---|---|---|
| M0 | 骨架：reconciler-core / selector-map / breakpoints / 构建 / CI | ✅ 完成 |
| M1 | 抽屉与布局：overlay 左抽屉 + scrim + 右侧 details 浮层、safe-area 基线、Escape/aria-modal/pointerup 关闭、focus-guard、CDP 门禁 | ✅ 完成 |
| M2 | composer 与键盘：玻璃卡片、一行契约、FLIP 状态切换、44px 热区、键盘 dvh、reduced-motion | ✅ 完成 |
| M3 | 设置 / 弹层 / 内容 + 第三方兼容开关（dshmarket/better-sidebar/token-usage） | ✅ 完成 |
| M4 | 手势（swipe 默认 + 跟手默认关）+ 真机清单 | ✅ 完成 |
| M5 | PWA（官方黑鲸鱼图标）+ 发布（本地安装实测） | ✅ 完成 |

## 开发

    pnpm install
    pnpm verify        # tsc --noEmit + lib 漂移检查
    pnpm test          # node --test tests/（reconciler-core 单测）
    pnpm build         # esbuild 双端构建 + 刷新 lib/

修改后必须 pnpm build 刷新 lib/（提交产物，消费端免构建）。

## 兼容矩阵

| 项 | 验证版本 | 状态 |
|---|---|---|
| DSH（vendor 哈希） | dsh 0.1.1-rc.2 | ✅ selector-map 18 条登记 + canary 失配自检（软告警+兜底降级） |
| dshmarket | 1.20.x（profile） | ✅ nav 死路反制（html[data-xc-market-fix]，COMPAT 开关） |
| dsh-better-sidebar | 0.15.2（profile） | ✅ 和平共存（决策 1），零冲突规则 |
| dsh-token-usage | 0.2.16（profile） | ✅ COMPAT.tokenUsageGlue 登记 |

## PWA

- 图标：DSH 官方黑鲸鱼（vendor favicon.svg 栅格化为 192/512/180 + maskable，深底白鲸；
  scripts/rasterize-icons.mjs 可重新生成），不使用任何第三方自制图标。
- 缓存：SW 收敛版——仅预缓存 boot 关键资源，其余内容寻址资源 cache-first 增量自愈；
  /api/* 与 /plugins/events 完全旁路；导航 network-first，失败回退内置离线页。
- 关闭：localStorage 'dsh-mobile-xc.pwa' = 'off' 时跳过注册并卸载 SW
  （exports.disablePwa 预留设置项）；或 DevTools → Application → Service Workers → Unregister。

## 安装（已在本机 profile 实测，dsh 0.1.1-rc.2）

    cd D:/workspace/dsh-mobile-xc && npm pack
    dsh plugin --profile web add file:D:/workspace/dsh-mobile-xc/dsh-mobile-xc-0.1.0.tgz
    # 重启 dsh web 生效（Android/浏览器可用 PWA 添加到主屏幕）

> 注意：Windows 下 pnpm 的 link:<绝对路径> 有解析缺陷，请使用 file:<tgz> 方式（与 dsh-token-usage / dsh-lan-proxy 一致）。

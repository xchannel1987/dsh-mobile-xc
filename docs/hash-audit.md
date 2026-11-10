# 哈希对账清单（hash audit）

每次 DSH 升级后核对；与本插件 selector-map.ts 登记条目同步。

| 前缀 | 组件包 | 本插件使用点 | 上次核对版本 | 状态 |
|---|---|---|---|---|
| uV2eYG_ | dsh-client-ui-conversation | M2 已登记：card/mirror/row/tools/trailing/add/primary/root（compat.css.ts） | dsh 0.1.1-rc.2 | ✅ M2 登记（11 条） |
| wSkVaW_ | dsh-client-ui-conversation | M2 已登记：titleRow（汉堡避让） | dsh 0.1.1-rc.2 | ✅ M2 登记 |
| OMoRSG_ | dsh-client-ui-open-in-app | M9 已登记：split（移动端隐藏「在文件资源管理器/应用中打开」按钮组；0.2.2 起由 CAgGvG_ 改名） | dsh 0.2.2-rc.1 | ✅ M9 登记 |
| pI_x6G_ | dsh-client-ui-layout | M9 已登记：centerCol/rightbarCol（列钉位，仅 vendor 非原生抽屉模式）、sidebarCol（抽屉本体锚）、drawerMask（排除项，optional） | dsh 0.2.2-rc.1 | ✅ M9 登记 |
| eGxaPq_ | dsh-client-ui-chat | M7 已登记：slot（轮次导航 rail 移动端显示反制） | dsh 0.1.5-rc.2 | ✅ M7 登记 |
| VOzbGW_ | dsh-client-ui-settings-general | M3 已登记：panel/nav（全屏纵向 + 导航横滚） | dsh 0.1.1-rc.2 | ✅ M3 登记 |
| hHd-Xa_ | dsh-client-ui-sidebar | sidebar toggle | dsh 0.1.1-rc.2 | 未使用（M0） |
| _7KE1Ra_ | dsh-client-ui-model-selection | M2 已登记：trigger/triggerLabel | dsh 0.1.1-rc.2 | ✅ M2 登记 |
| nArs4W_ | dsh-better-sidebar（profile） | M3 和平共存（COMPAT.betterSidebarCoexist）：零冲突规则 | 0.15.2 | ✅ M3 登记 |
| eGUBIq_ / data-dsh-market-root | dshmarket（profile） | M3 已实现：nav 死路反制（html[data-xc-market-fix]，COMPAT 开关） | 1.20.x | ✅ M3 登记 |

> 注意：dsh-mobile-glass 的 nL4_yW_sessionLogButton / W-zNGW_toggleCluster 已确认失配（死规则），
> 本插件不会沿用这两条。
| dsh-token-usage（profile） | —— | M3 兼容登记（COMPAT.tokenUsageGlue=true，无冲突规则） | 0.2.16 | ✅ M3 登记 |
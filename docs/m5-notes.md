# M5 里程碑记录（PWA + 发布）

日期：2026-08；分支：feat_mobileXc

## 交付内容

| 文件 | 职责 |
|---|---|
| src/pwa.ts | SW 收敛版（boot 预缓存 + 内容寻址 cache-first 增量 + 导航 network-first 回退离线页 + API/SSE 旁路）、动态 manifest（去 orientation 硬锁、theme_color 对齐默认深色主题）、离线页、注册脚本（localStorage 关闭钩子）、HEAD_EXTRA |
| src/index.ts（host） | webServer 精确路由：/sw.js（no-cache）、/manifest.webmanifest（遮蔽 dist 版）、/pwa/icon-{192,512,180}.png（immutable）、tapIndex 幂等注入（data-dsh-xc-pwa） |
| scripts/rasterize-icons.mjs | 官方黑鲸鱼（vendor favicon.svg）→ PWA PNG（192/180 any + 512 maskable 安全区缩放），sharp 可选解析 |
| assets/pwa/icon-{192,512,180}.png | 已生成（深底 #0f172a + 白鲸，官方鲸鱼路径） |
| src/client/index.ts | 全功能整合重写（补齐 M4 gesture 接线）+ exports.disablePwa（设置项一键关闭，localStorage 标记 + 卸载 SW） |
| package.json | dsh.bundle.patch 元数据（此前缺失导致只装成普通依赖）+ files 加 assets |

## 安装实测（本机 web profile，dsh 0.1.1-rc.2）

坑与解：
1. pnpm Windows 下 link:<绝对路径> 会把 target 拼成 profiles/web/D:/workspace/...（junction 指向不存在的路径，package.json 不可读）。
   解：与 dsh-token-usage / dsh-lan-proxy 一致，用 npm pack → file:D:/workspace/dsh-mobile-xc/dsh-mobile-xc-0.1.0.tgz 安装。
2. 首装时缺 dsh.bundle 元数据被当作普通依赖（非 profile 层）；补上 dsh.bundle.patch 并经 tgz 重装后 dump-config 出现：
   # == dsh-mobile-xc  /  - id: mobile-xc  /  name: dsh-mobile-xc

## 待用户操作（发布/实测收口）

- [ ] 重启 dsh web（用户手动，电源按钮）使 dsh-mobile-xc 生效
- [ ] 重启后：node scripts/cdp-probe.mjs --expect=plugin（全断言：抽屉/scrim/汉堡/桌面零影响/composer 几何）
- [ ] 真机清单 docs/device-checklist.md 过一遍
- [ ] 无问题后按需 git commit + 发布 npm（用户确认后可执行）

## 验证

- pnpm build / verify / test（16/16）全绿；SW_SOURCE new Function 编译通过；manifest JSON 合法且无 orientation 硬锁。
- npm pack：28 文件 63.5kB。
- 安装后 dump-config：mobile-xc 层已注册。

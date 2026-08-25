# 真机验证清单（device checklist）

适用：M4 打磨 / M5 发布前。执行环境：iPhone（灵动岛）+ 主流 Android（挖孔）+ iPad 竖屏模拟 768px。

## 1. 系统栏与安全区

- [ ] 汉堡/标题不被状态栏、灵动岛、挖孔遮挡（env(safe-area-inset-top) 生效）
- [ ] 设置面板/目录选择器底部按钮不被 home indicator 遮挡（env(safe-area-inset-bottom)）
- [ ] 状态栏颜色与浅/深主题一致（theme-color 跟随 body 背景）

## 2. 抽屉与手势

- [ ] 一次性 swipe：聊天区右滑开抽屉、左滑关抽屉、同向不误触发；垂直滚动不受影响
- [ ] 宽表格/代码块横向滑动不受抽屉手势干扰（横滚豁免）
- [ ] 左边缘 16px 区域交给系统返回手势
- [ ] 跟手模式（GESTURE.dragEnabled=true 时）：拖拽全程不掉 pointer、无抖动、松手按速度/位移吸附
- [ ] 汉堡 / scrim 点击单次开合（无双触发）
- [ ] Escape 关抽屉且不干扰 [aria-modal] 对话框
- [ ] 触屏点会话树条目后抽屉自动关（pointerup 平行路径）

## 3. 键盘

- [ ] iOS 聚焦 composer 不自动弹键盘（focus-guard 生效）；点击后才弹出
- [ ] 键盘弹起/收起后 composer 可见可点（dvh + interactive-widget）
- [ ] 输入 ≥16px 不触发 iOS 自动缩放（maximum-scale 锁保留）

## 4. 旋转与断点

- [ ] 360/390/768/1023 四档宽度布局正确；旋转 180° 无错位
- [ ] >=1024 桌面与未安装插件时一致（截图对比）

## 5. 主题与动效

- [ ] 浅色/深色主题下卡片、抽屉、汉堡对比度正常
- [ ] prefers-reduced-motion 开启时所有动效关闭（无位移/过渡）

## 6. 性能（长会话流式）

- [ ] 开关插件对比：流式回答期间无可见卡顿（帧率采样 drop < 阈值）
- [ ] 注入节点 <= 8 个；composer 打字即时无逐键动画

## 7. 第三方并存（本机 profile）

- [ ] dshmarket 打开设置不改 nav（<=560px 反制生效）
- [ ] dsh-better-sidebar 双入口互不遮挡（决策 1 和平共存）
- [ ] dsh-token-usage 徽标排布无冲突

## 8. 卸载还原

- [ ] 停用/卸载插件后：viewport meta 原文还原、注入节点/监听器/观察者清空、无残留标记

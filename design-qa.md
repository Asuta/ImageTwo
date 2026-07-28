# Canvas 设计校验

## 视觉真值与实现证据

- 参考页面：`https://wuli.art/canvas/detail?canvasUuid=01kt8qffkewwvk58k2z0pm9p6n`
- 参考截图：`C:/Users/fun/AppData/Local/Temp/happyimage-canvas-detail-qa/wuli-selected.png`
- 本地实现截图：`C:/Users/fun/AppData/Local/Temp/happyimage-canvas-detail-qa/happyimage-selected.png`
- 本地新增菜单截图：`C:/Users/fun/AppData/Local/Temp/happyimage-canvas-detail-qa/happyimage-add-menu.png`
- 同尺寸对照图：`C:/Users/fun/AppData/Local/Temp/happyimage-canvas-detail-qa/wuli-vs-happyimage-selected-final.png`
- 参考视口：1490 × 738；本地视口：1863 × 930。
- 对照图把两个有效视口归一化为 1490 × 738 后上下拼接，用于检查组件比例、层级、间距和视觉密度。
- 对照状态：画布存在多节点和连线，选中一个图片节点，显示节点操作条和贴附式生成面板；新增节点菜单另行验证。

## 对照结果

- 全局构图：白色点阵无限画布、左上项目入口、右上额度与分享、底部居中工具栏、右下导航控件的位置和层级已对齐。
- 节点选中态：工具条采用 40px 白色胶囊容器、细边框和轻阴影；按钮顺序、32px 点击区、悬停和按压反馈按参考页重做。
- 生成面板：648 × 274px，距离选中节点 12px，采用 12px 圆角和三层轻阴影；参考区、输入区、组合设置与黑色生成按钮的结构一致。
- 动效：工具条、生成面板、新增菜单和导航地图使用短时淡入、缩放与位移动效；拖拽和平移期间关闭画布过渡，避免交互拖沓。
- 连接关系：普通连线降低对比度，选中连线使用 1.6px 紫色描边；连接命中区独立扩大，不改变视觉粗细。
- 新增菜单：宽度 166px、8px 圆角、29px 行高，从底部工具栏向上展开；保留图像、文本和上传，不包含视频。

## 功能与回归

- 已验证：节点选中、多选、八方向缩放、复制/粘贴/克隆、手动连线与删除、拖出分支、`@` 引用、标注、导航地图和新增菜单。
- 已切回经典模式检查生成历史与导航，再返回画布；经典模式正常，画布布局和 17 个节点可恢复。
- 校验过程未提交生成请求，未消耗额度。

## 比较历史

- P0：无。
- P1：初版的工具条、生成面板和底部控件尺寸偏大，新增菜单及默认导航地图与参考页不一致；本轮已修正。
- P2：不同项目数据会导致节点内容、节点长宽比和画布疏密不同；这些属于内容差异，不是组件视觉偏差。

## 分支拖拽补充校验

- 交互参考：`C:/Users/fun/AppData/Local/Temp/codex-clipboard-f4c9aebf-5514-4500-a889-a10b54098f26.png`
- 本地选中态：`C:/Users/fun/AppData/Local/Temp/happyimage-canvas-branch-qa/happyimage-selected-handle.jpg`
- 本地拖拽中：`C:/Users/fun/AppData/Local/Temp/happyimage-canvas-branch-qa/happyimage-mid-drag.jpg`
- 本地吸附态：`C:/Users/fun/AppData/Local/Temp/happyimage-canvas-branch-qa/happyimage-snap-feedback.jpg`
- 同尺寸对照：`C:/Users/fun/AppData/Local/Temp/happyimage-canvas-branch-qa/reference-vs-happyimage-handle.png`
- 节点左右连接球均为 24px 圆形浅灰控件，位于节点边缘外 26px，并通过 14px 紫色短线连接节点。
- 已验证拖拽期间跟随鼠标的小球和实线连接预览同时出现；进入目标节点 34px 屏幕吸附范围后，小球准确吸附到目标输入球并切换为紫色高亮。
- 已验证在空白处松手后创建新图像节点、自动建立 `parentIds` 关系，而且新节点左侧吸附球中心与松手位置重合。
- 验证完成后已通过两次撤销清除临时测试节点，未调用生成接口。

上一轮结果：passed

## 分支输入继承逻辑校验

- 原版运行态：`https://wuli.art/canvas/detail?canvasUuid=01kt8qffkewwvk58k2z0pm9p6n`
- 原版截图：`C:/Users/fun/Desktop/projecg/HappyImage/tmp/canvas-branch-audit/01-reference-start.png`
- 本地实现截图：`C:/Users/fun/Desktop/projecg/HappyImage/tmp/canvas-branch-audit/04-local-inherited-reference.png`
- 合并对照图：`C:/Users/fun/Desktop/projecg/HappyImage/tmp/canvas-branch-audit/05-reference-vs-local-branch-input.png`
- 原版截图像素：1490 × 691；CSS 视口：1490 × 691；设备像素比：1.25。
- 本地截图像素：1655 × 820；CSS 视口：1655 × 820；合并对照时等比归一化到 1490px 宽，没有拉伸或裁切。
- 对照状态：上半部分为原版已选中图片生成节点及其入边引用卡片；下半部分为本地已选中分支空图像节点及其自动继承的根节点图片卡片。两边项目内容不同，因此本轮只校验“入边引用出现在生成输入区”的结构与交互，不对节点内容、画布缩放和项目密度做伪精确比较。
- 全景对照：生成输入面板仍保持贴附在所选节点附近，继承引用位于输入区首行；本轮没有修改字体、颜色、圆角、阴影、图像裁切或工具栏布局，没有新增 P0/P1/P2 视觉偏差。
- 聚焦对照：本地引用卡片显示根节点实际缩略图；图片清晰、比例未拉伸，卡片的移除入口与原有设计一致。无需额外局部裁图，合并图中的输入区已经能清楚判断缩略图、输入框和控制行。
- 字体与排版：沿用现有画布字体、字重、字号和行高，没有新增文本样式。
- 间距与布局：引用卡片继续复用 `wuli-reference-strip` / `wuli-reference-card`，没有引入新的间距或尺寸分支。
- 色彩与视觉令牌：沿用现有背景、边框、选中紫色和按钮令牌。
- 图像与素材：直接复用根节点原图 Blob/URL 作为缩略图和生成参考，没有占位图、二次压缩或代码绘制替代。
- 文案与内容：未新增面向用户的临时调试文案；README 和 AGENTS.md 已说明“入边即输入”的稳定行为。

### 逻辑确认与修复历史

- [P1] 修复前，分支空图像节点虽然保存了 `parentIds` 并显示连线，但生成输入只读取当前选中节点，导致根节点图片没有进入参考图列表。
- 原版确认：呜哩生成节点以入边作为 `nodeInput` 的引用来源；从图片节点拖出生成节点后，来源节点通过入边成为默认参考，断开入边即移除引用。
- 修复：新增统一的 `generationInputNodes` 解析；空图像节点会把直接 `parentIds` 展开为输入，上游图片进入参考图，上游文本进入提示词上下文。选中节点自身仍作为生成结果的落位父节点，避免破坏现有分支层级。
- 同链路修复：手动连入空图像节点、`@` 引用空图像节点和多选空图像节点都复用相同解析；从输入区移除继承引用会同步删除对应 `parentIds`，因此连线、卡片和真实请求上下文保持一致。
- 修复后证据：本地选中已有分支节点后检测到 1 张根节点图片卡片；移除卡片后引用数从 1 变为 0、连线数从 14 变为 13；撤销后引用数恢复为 1、连线数恢复为 14。

### 交互与回归

- 已验证：分支节点自动继承图片参考、移除引用同步断线、撤销同步恢复引用与连线。
- 已验证：经典模式可正常进入，历史、参考图缩略图和生成控制正常显示；随后可正常返回画布。
- 未提交真实生成请求，未消耗额度。
- 浏览器控制台 `error` / `warn`：0。
- `pnpm run build`：通过。

## 分支节点原地生成校验

- 根因：生成逻辑始终把任务图片追加到 `generationNodes` 后方，因此拖出的空图像节点既作为编辑输入保留，又成为新任务节点的父节点，形成“来源图 → 空节点 → 结果图”三段链路。
- 修复：单选空图像节点生成时，首张任务图片使用相同坐标原地替换空节点，并直接继承空节点的上游 `parentIds`；多图生成时只有第二张及后续结果继续新增。
- 连线兼容：若已有其他节点引用被替换的空节点，其 `parentIds` 会同步改写为首张结果节点 ID，避免形成悬空连线。
- 恢复兼容：任务 `canvasContext.replacedNodeId` 会记录被替换节点；刷新或 IndexedDB 保存窗口发生竞态时，历史对账会移除旧占位节点，只恢复正式任务节点。
- 隔离浏览器验证：生成前节点数为 2；临时拦截 `/api/generate` 后点击生成，任务失败态仍在原节点位置显示，生成后节点数仍为 2，没有出现第三个节点。
- 测试未请求上游生成接口、未消耗额度；验证产生的失败历史记录已删除，临时网络拦截已恢复。
- `pnpm run build`：通过。

final result: passed

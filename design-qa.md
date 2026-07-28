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

final result: passed

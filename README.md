# Image2 Web Generator

一个可部署的网页版生图中转工具。用户通过邮箱验证码登录，Node 服务校验账号额度后调用配置的图片生成接口，生成结果返回浏览器并保存在 IndexedDB 本地历史中。

## 功能

- 邮箱验证码登录：不使用密码，验证码通过后写入 HttpOnly session cookie。
- 账号额度：新账号默认获得 5 点；每生成一张图片默认扣除 0.05 点。用户余额固定显示两位小数，其他额度数值最多保留两位小数；经典模式与 Canvas 的生成按钮会按当前数量显示本次预计消耗。初始额度和单张成本可分别通过 `IMAGE2_SIGNUP_CREDITS`、`IMAGE2_GENERATION_COST_CREDITS` 调整。
- 礼品卡兑换：管理员批量生成 `gift_...` 礼品卡，用户登录后输入 Key 兑换额度。
- 卡密管理：管理员访问 `/admin` 并输入 `IMAGE2_ADMIN_KEY` 后进入独立后台，支持批次创建、状态查询、复制新卡密、作废、启用、撤销已兑换卡和审计日志。
- 供应商配置：后台可配置不同图片服务商和接口格式，包括 Responses、图片编辑、Compilation、Right Code Draw 以及 AI Pixel Images。
- 本地历史：图片、生成中的请求、扣点和余额快照保存在当前浏览器 IndexedDB。生成中刷新后可继续获取结果；相同客户端任务/图片 ID 的恢复请求不会再次扣费。后台同时保留受容量限制的图片归档，用于管理员查看和任务结果恢复。
- 历史清理：自动保留最近 300 张未被画布引用的图片；所有 Canvas 项目引用的图片额外保留，不计入这 300 张。图片暂时不可用或被主动删除时，画布保留节点位置和连线，并显示素材缺失提示。
- 服务重启：已归档图片可以继续下载；重启中断且没有可恢复结果的任务会被标记失败，预扣额度自动返还，重复重启不会重复退款。
- 精简主页：左侧栏只保留带模式说明的“经典 / 画布”创作模式切换；无独立业务价值的“新建生成”以及未实现的侧栏入口、历史筛选/视图切换、通知、示例操作和高级开关不再作为可点击占位控件出现。
- 经典模式手机竖屏：宽度不超过 720px 的竖屏设备使用独立紧凑布局，底部默认只显示上传、提示词和生成入口；聚焦提示词或展开参考图时打开完整创作设置抽屉，提交生成后自动收起并定位到最新任务。无模式参数的首页始终默认进入经典模式；Canvas 入口仍可正常进入，Canvas 项目页在手机端保留返回经典模式的导航，但 Canvas 工作区本身不做手机竖屏适配。
- 多项目轻量画布：侧栏可在经典模式与 Canvas 项目页之间切换，两种主页共用同一套背景、玻璃面板配色和 240px 全高侧栏，切换模式时页面框架不会再发生宽度或色调跳变；点击“新建项目”只会在当前项目页新增一个空 Canvas 卡片，点击指定卡片后才进入对应画布。项目页支持纵向滚动浏览长列表，以及搜索、重命名和删除多个独立 Canvas，原有单画布数据会自动迁移为一个项目。每个画布采用独立保存的全屏创作工作区，支持滚轮二维平移、`Ctrl/⌘ + 滚轮` 指针锚点缩放、左键选择/框选、中键或右键拖动空白区平移、右键节点操作菜单、图片上传、空图像节点、可编辑文本节点（默认整块可拖，单击只选择，双击进入编辑，编辑时只能从边框拖动；键盘输入期间会暂时隐藏正文上的鼠标指针，鼠标一移动或按下便立即恢复，并可通过八方向缩放调整文本框）、按适合画布的标准尺寸显示且不可拉伸或缩放的图片节点、复制/粘贴/快速克隆（普通粘贴以鼠标当前位置为复制内容中心，快速克隆仍在原位偏移）、手动创建/选择/断开连线；从左侧吸附球拖出可添加前置输入，前置节点的文字或图片内容会显示在当前节点的参考内容区并参与生成，当前选中的图片只作为结果/目标节点，不会把自身重复列为参考素材；从右侧吸附球拖出可添加后续输出，在空白处松开可选择图像、文本或上传节点并保持落点锚点对齐，类型菜单打开期间待定连线会停留在松手位置，选择后转为真实连线，取消菜单时才清除；历史生成图片面板会拦截其覆盖区域内的滚轮并滚动自身列表，不会穿透操作后方画布，点击面板外的画布区域可直接关闭面板；提交生成后会保持用户当前的缩放和平移视口，不再自动适应全部内容；还支持在分支输入节点原地生成首张结果、`@` 引用图片或文本节点、图片标注与局部修改、导航地图、网格/连线显隐、快捷键提示、上下文生成面板、撤销/重做、生成结果自动落位和本地恢复。上下文生成面板的“添加参考”区分“画布选择”和“上传”：画布选择会连接已有节点，直接上传只新增当前节点的参考卡片，不会在画布上创建素材节点。画布不提供视频生成或视频节点。
- Canvas 网页导航：Canvas 项目页与具体画布编辑页会写入独立的浏览器历史记录；进入画布后可使用浏览器后退返回此前页面，并可使用前进重新进入画布，刷新或直接打开带 `canvas` 参数的链接也会恢复对应层级。
- 双模式同步：画布生成继续使用原有任务、额度和历史链路；生成结果会同时出现在经典历史中。保存标注并点击“使用标注图”时，提示词会显式引用该节点，使标注图作为参考图提交；移除对应引用即可取消。
- 生成上下文恢复：在 Canvas 中单独选中一张生成图片时，会恢复该次生成时输入框中的提示词；参考文本节点仍作为独立上下文展示和拼接，不会重复写入输入框。
- 提示词复用：历史卡片支持重新编辑、再次生成、复制提示词、删除。
- 多图生成：可以设置一次生成的图片数量，前端会并行提交多次生成请求。
- 多图参考：底部上传入口支持同时添加多张本地图片，参考图编辑模式会把它们作为多个 `image_url` 内容块传给接口。
- 图片比例：支持智能比例以及 `9:21`、`9:16`、`2:3`、`3:4`、`1:1`、`4:3`、`3:2`、`16:9`、`21:9`。智能比例不会传入比例文本；其他比例会写入 prompt，不再发送分辨率参数。
- 亮色界面：经典模式和画布统一使用亮色主题，不提供颜色模式切换；两种界面均不会叠加遮挡内容的底部渐变装饰层。

## 运行

使用 Node.js 20.19+（20.x）或 22.12+ 和 pnpm 9.15.2；图片处理依赖 sharp 0.35.4+。更新依赖后需重启后端服务。

先配置环境变量。推荐把共享密钥放在用户目录的全局文件里，这样新建工作区或重新 clone 项目时不用反复复制项目根目录 `.env`。

Windows 默认读取：

```text
C:\Users\<你的用户名>\.image2.env
```

macOS / Linux 默认读取：

```text
~/.image2.env
```

文件内容示例：

```text
IMAGE2_API_URL=https://ai-pixel.online
IMAGE2_API_KEY=your_api_key_here
IMAGE2_MODEL=gpt-image-2.5-flare
IMAGE2_ADMIN_KEY=change_this_admin_key
IMAGE2_DATA_DIR=./data
IMAGE2_SIGNUP_CREDITS=5
IMAGE2_GENERATION_COST_CREDITS=0.05
IMAGE2_SECURE_COOKIES=false
IMAGE2_MAIL_PROVIDER=auto
TENCENT_SES_SECRET_ID=
TENCENT_SES_SECRET_KEY=
TENCENT_SES_REGION=ap-guangzhou
TENCENT_SES_FROM=noreply@www.happyimage.art
TENCENT_SES_CONTENT_MODE=simple
TENCENT_SES_TEMPLATE_ID=
TENCENT_SES_TEMPLATE_DATA_KEY=code
SENDCLOUD_API_USER=
SENDCLOUD_API_KEY=
MAIL_FROM=
HOST=0.0.0.0
PORT=5173
```

也可以继续使用项目根目录的 `.env`。服务启动时会先读全局文件，再读项目根目录 `.env`；已经存在的系统环境变量优先级最高。如果想指定其他共享文件位置，可以设置 `IMAGE2_ENV_FILE`。供应商列表和当前启用项保存在共享文件的 `IMAGE2_PROVIDERS_JSON`、`IMAGE2_ACTIVE_PROVIDER_ID` 中，各 Git worktree 启动时都会读取最新共享配置；新工作区初始化和普通业务数据写入不会覆盖共享供应商。

```powershell
pnpm start
```

打开：

```text
http://localhost:5173
```

首次使用直接在网页中输入邮箱，点击“发送验证码”。生产环境推荐配置腾讯云邮件推送：

- `IMAGE2_MAIL_PROVIDER=auto` 会优先使用腾讯云邮件推送；如果未配置腾讯云但配置了 SendCloud，则继续使用 SendCloud。
- 腾讯云邮件推送需要配置 `TENCENT_SES_SECRET_ID`、`TENCENT_SES_SECRET_KEY`、`TENCENT_SES_REGION` 和 `TENCENT_SES_FROM`。
- `TENCENT_SES_CONTENT_MODE=simple` 时，服务会直接使用项目里的验证码 HTML/纯文本内容发信，不需要腾讯云模板 ID。
- 如果腾讯云账号不支持 Simple 内容模式，可改用 `TENCENT_SES_CONTENT_MODE=template` 并配置 `TENCENT_SES_TEMPLATE_ID`；模板中建议放一个验证码变量，例如 `{{code}}`，默认 `TENCENT_SES_TEMPLATE_DATA_KEY=code` 会把验证码传给这个变量。
- `TENCENT_SES_REGION` 使用腾讯云邮件推送支持的地域，例如 `ap-guangzhou` 或 `ap-hongkong`。

如果没有配置任何生产发信平台，本地开发模式会把验证码返回到页面提示并打印到服务器日志。兼容旧配置时也可以继续使用 SendCloud：配置 `SENDCLOUD_API_USER`、`SENDCLOUD_API_KEY` 和 `MAIL_FROM`。

创建礼品卡：

```powershell
$headers = @{ Authorization = "Bearer change_this_admin_key"; "Content-Type" = "application/json" }
$body = @{ label = "test-batch"; credits = 10; count = 5; expiresAt = "2026-06-30T23:59:59+08:00"; note = "渠道备注" } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri http://localhost:5173/api/admin/gift-cards -Headers $headers -Body $body
```

把返回的 `gift_...` 发给用户，用户登录后在网页里输入礼品卡 Key 兑换额度。礼品卡明文只在创建时返回一次，长期数据只保存 hash 和预览尾号。

查看礼品卡和批次：

```powershell
$headers = @{ Authorization = "Bearer change_this_admin_key" }
Invoke-RestMethod -Method Get -Uri http://localhost:5173/api/admin/gift-cards -Headers $headers
Invoke-RestMethod -Method Get -Uri http://localhost:5173/api/admin/gift-card-batches -Headers $headers
```

作废、启用、撤销：

```powershell
$headers = @{ Authorization = "Bearer change_this_admin_key" }
Invoke-RestMethod -Method Post -Uri http://localhost:5173/api/admin/gift-cards/<card-id>/disable -Headers $headers
Invoke-RestMethod -Method Post -Uri http://localhost:5173/api/admin/gift-cards/<card-id>/enable -Headers $headers
Invoke-RestMethod -Method Post -Uri http://localhost:5173/api/admin/gift-cards/<card-id>/revoke -Headers $headers
```

查看用户：

```powershell
$headers = @{ Authorization = "Bearer change_this_admin_key" }
Invoke-RestMethod -Method Get -Uri http://localhost:5173/api/admin/users -Headers $headers
```

手动调整某个用户额度：

```powershell
$headers = @{ Authorization = "Bearer change_this_admin_key"; "Content-Type" = "application/json" }
$body = @{ delta = 20; note = "manual top-up" } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri http://localhost:5173/api/admin/users/<user-id>/credits -Headers $headers -Body $body
```

## 说明

- 可选模型：`gpt-image-2.5-flare`（默认）和 `gpt-image-2.5-sunburst`。经典模式和 Canvas 的生成面板都提供模型选择，文生图和参考图编辑使用同一所选模型。
- 经典模式记住最近选择；Canvas 按项目保存模型，选回生成节点时恢复该任务的模型。历史“重新编辑 / 再次生成”沿用记录中的可用模型，旧模型记录重新生成时默认使用 Flare，历史原始信息保持不变。
- Canvas 发起的生成结果只自动加入所属画布；其他项目仍可从历史抽屉手动拖入该图片。
- 用户选择的模型随每次 `/api/generate` 请求传入，优先于供应商默认模型，不修改共享供应商配置。旧配置 `gpt-image-2` / `gpt-image-2-codex` 在读取时兼容为 Flare。两个模型继续使用 `IMAGE2_GENERATION_COST_CREDITS` 定义的站内单张成本。
- 默认图片接口：`https://ai-pixel.online`（AI Pixel Images 格式）
- 浏览器会把生成结果保存到当前浏览器的 IndexedDB；服务器归档默认最多占用 3 GiB，通过 `IMAGE2_HISTORY_MAX_BYTES` 调整。归档清理后，浏览器已保存图片仍可使用，但无法再从服务器恢复该结果。
- API key 从系统环境变量、全局共享 env 文件或项目根目录 `.env` 读取，`.env` 不会提交到 Git。
- 用户、session、礼品卡和额度数据默认保存在 `IMAGE2_DATA_DIR` 下的 `image2-data.json`。
- 如果修改了 `server.js`，需要重启 `pnpm start` 才会生效。
- 请求格式细节见 `docs/request-format.md`。
- Ubuntu 公网部署和商业中转改造计划见 `docs/ubuntu-commercial-proxy-plan.md`。

## 回归验证

- `pnpm test`：启动隔离开发 API 和本地图片接口，检查并发归档、额度更新、任务归属、请求去重、重启退款与结果恢复、错误请求、礼品卡和双模型。
- `pnpm run test:browser`：启动 Vite 与隔离开发 API，用真实浏览器检查验证码登录、刷新/响应丢失恢复、多图账务、Canvas 标注和历史保留。Windows 默认使用已安装的 Edge；其他系统默认使用 Playwright Chromium，可通过 `IMAGE2_TEST_BROWSER` 指定浏览器 channel，缺少 Chromium 时运行 `pnpm exec playwright install chromium`。
- `pnpm run build`：验证生产构建。

测试只使用开发验证码、临时数据目录及本地模拟供应商；数据输出在忽略的 `tmp/regression-tests/` 中，不调用真实邮件或付费生图接口。

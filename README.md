# Image2 Web Generator

一个可部署的网页版生图中转工具。用户通过邮箱验证码登录，Node 服务校验账号额度后调用配置的图片生成接口，生成结果返回浏览器并保存在 IndexedDB 本地历史中。

## 功能

- 邮箱验证码登录：不使用密码，验证码通过后写入 HttpOnly session cookie。
- 账号额度：新账号默认获得 100 点；当前临时免费生成，默认不扣额度。可通过 `IMAGE2_GENERATION_COST_CREDITS` 恢复或调整单张成本。
- 礼品卡兑换：管理员批量生成 `gift_...` 礼品卡，用户登录后输入 Key 兑换额度。
- 卡密管理：管理员访问 `/admin` 并输入 `IMAGE2_ADMIN_KEY` 后进入独立后台，支持批次创建、状态查询、复制新卡密、作废、启用、撤销已兑换卡和审计日志。
- 供应商配置：后台可配置不同图片服务商和接口格式，包括 Responses、图片编辑、Compilation、Right Code Draw 以及 AI Pixel Images。
- 本地历史：生成图片仅保存在当前浏览器 IndexedDB，不会长期保存在服务器。
- 精简主页：主页只展示已经接入真实业务逻辑的导航和操作，未实现的侧栏入口、历史筛选/视图切换、通知、示例操作及高级开关不再作为可点击占位控件出现。
- 多项目轻量画布：侧栏可在经典模式与 Canvas 项目页之间切换，两种主页共用同一套背景、玻璃面板配色和 240px 全高侧栏，切换模式时页面框架不会再发生宽度或色调跳变；点击“新建项目”只会在当前项目页新增一个空 Canvas 卡片，点击指定卡片后才进入对应画布；提示词“创建并开始”仍会直接进入带初始提示词的新画布。项目页支持纵向滚动浏览长列表，以及搜索、重命名和删除多个独立 Canvas，原有单画布数据会自动迁移为一个项目。每个画布采用独立保存的全屏创作工作区，支持滚轮二维平移、`Ctrl/⌘ + 滚轮` 指针锚点缩放、左键选择/框选、中键或右键拖动空白区平移、右键节点操作菜单、图片上传、空图像节点、可编辑文本节点（默认整块可拖，单击只选择，双击进入编辑，编辑时只能从边框拖动；键盘输入期间会暂时隐藏正文上的鼠标指针，鼠标一移动或按下便立即恢复）、八方向缩放、复制/粘贴/快速克隆（普通粘贴以鼠标当前位置为复制内容中心，快速克隆仍在原位偏移）、手动创建/选择/断开连线；从左侧吸附球拖出可添加前置输入，前置节点的文字或图片内容会显示在当前节点的参考内容区并参与生成，当前选中的图片只作为结果/目标节点，不会把自身重复列为参考素材；从右侧吸附球拖出可添加后续输出，在空白处松开可选择图像、文本或上传节点并保持落点锚点对齐，类型菜单打开期间待定连线会停留在松手位置，选择后转为真实连线，取消菜单时才清除；历史生成图片面板会拦截其覆盖区域内的滚轮并滚动自身列表，不会穿透操作后方画布，点击面板外的画布区域可直接关闭面板；提交生成后会保持用户当前的缩放和平移视口，不再自动适应全部内容；还支持在分支输入节点原地生成首张结果、`@` 引用图片或文本节点、图片标注与局部修改、导航地图、网格/连线显隐、快捷键提示、上下文生成面板、AI 创作助手抽屉、撤销/重做、生成结果自动落位和本地恢复。上下文生成面板的“添加参考”区分“画布选择”和“上传”：画布选择会连接已有节点，直接上传只新增当前节点的参考卡片，不会在画布上创建素材节点。画布不提供视频生成或视频节点。
- 双模式同步：画布生成继续使用原有任务、额度和历史链路；生成结果会同时出现在经典历史中，删除经典历史后对应画布节点也会自动清理。
- 提示词复用：历史卡片支持重新编辑、再次生成、复制提示词、删除。
- 多图生成：可以设置一次生成的图片数量，前端会并行提交多次生成请求。
- 多图参考：底部上传入口支持同时添加多张本地图片，参考图编辑模式会把它们作为多个 `image_url` 内容块传给接口。
- 图片比例：支持智能比例以及 `9:21`、`9:16`、`2:3`、`3:4`、`1:1`、`4:3`、`3:2`、`16:9`、`21:9`。智能比例不会传入比例文本；其他比例会写入 prompt，不再发送分辨率参数。
- 深色模式：右上角支持浅色 / 深色主题切换，并会保存在本地浏览器；经典界面和画布均不会叠加遮挡内容的底部渐变装饰层。

## 运行

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
IMAGE2_MODEL=gpt-image-2
IMAGE2_ADMIN_KEY=change_this_admin_key
IMAGE2_DATA_DIR=./data
IMAGE2_SIGNUP_CREDITS=100
IMAGE2_GENERATION_COST_CREDITS=0
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

- 模型：`gpt-image-2`
- 默认图片接口：`https://ai-pixel.online`（AI Pixel Images 格式）
- 图片不会长期保存在服务器；浏览器会把生成结果保存到当前浏览器的 IndexedDB。
- API key 从系统环境变量、全局共享 env 文件或项目根目录 `.env` 读取，`.env` 不会提交到 Git。
- 用户、session、礼品卡和额度数据默认保存在 `IMAGE2_DATA_DIR` 下的 `image2-data.json`。
- 如果修改了 `server.js`，需要重启 `pnpm start` 才会生效。
- 请求格式细节见 `docs/request-format.md`。
- Ubuntu 公网部署和商业中转改造计划见 `docs/ubuntu-commercial-proxy-plan.md`。

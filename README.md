# Image2 Web Generator

一个可部署的网页版生图中转工具。用户通过邮箱验证码登录，Node 服务校验账号额度后调用配置的图片生成接口，生成结果返回浏览器并保存在 IndexedDB 本地历史中。

## 功能

- 邮箱验证码登录：不使用密码，验证码通过后写入 HttpOnly session cookie。
- 账号额度：新账号默认获得 100 点，生成 1 张图片扣 1 点，上游失败时返还额度。
- 礼品卡兑换：管理员批量生成 `gift_...` 礼品卡，用户登录后输入 Key 兑换额度。
- 卡密管理：管理员访问 `/admin` 并输入 `IMAGE2_ADMIN_KEY` 后进入独立后台，支持批次创建、状态查询、复制新卡密、作废、启用、撤销已兑换卡和审计日志。
- 本地历史：生成图片仅保存在当前浏览器 IndexedDB，不会长期保存在服务器。
- 提示词复用：历史卡片支持重新编辑、再次生成、复制提示词、删除。
- 多图生成：可以设置一次生成的图片数量，前端会并行提交多次生成请求。
- 多图参考：底部上传入口支持同时添加多张本地图片，参考图编辑模式会把它们作为多个 `image_url` 内容块传给接口。
- 图片比例：支持智能比例以及 `9:21`、`9:16`、`2:3`、`3:4`、`1:1`、`4:3`、`3:2`、`16:9`、`21:9`。智能比例不会传入比例文本；其他比例会写入 prompt，不再发送分辨率参数。
- 深色模式：右上角支持浅色 / 深色主题切换，并会保存在本地浏览器。

## 运行

先在本地 `.env` 里配置：

```text
IMAGE2_API_URL=https://api.bltcy.ai/v1/chat/completions
IMAGE2_API_KEY=your_api_key_here
IMAGE2_MODEL=gpt-image-2
IMAGE2_ADMIN_KEY=change_this_admin_key
IMAGE2_DATA_DIR=./data
IMAGE2_SIGNUP_CREDITS=100
IMAGE2_SECURE_COOKIES=false
RESEND_API_KEY=
MAIL_FROM=
HOST=0.0.0.0
PORT=5173
```

```powershell
npm start
```

打开：

```text
http://localhost:5173
```

首次使用直接在网页中输入邮箱，点击“发送验证码”。如果没有配置 `RESEND_API_KEY` 和 `MAIL_FROM`，本地开发模式会把验证码返回到页面提示并打印到服务器日志；生产环境建议配置 Resend 发信。

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
- 图片接口：`https://api.bltcy.ai/v1/chat/completions`
- 图片不会长期保存在服务器；浏览器会把生成结果保存到当前浏览器的 IndexedDB。
- API key 从本地 `.env` 或环境变量 `IMAGE2_API_KEY` 读取，`.env` 不会提交到 Git。
- 用户、session、礼品卡和额度数据默认保存在 `IMAGE2_DATA_DIR` 下的 `image2-data.json`。
- 如果修改了 `server.js`，需要重启 `npm start` 才会生效。
- 请求格式细节见 `docs/request-format.md`。
- Ubuntu 公网部署和商业中转改造计划见 `docs/ubuntu-commercial-proxy-plan.md`。

# Image2 Web Generator

一个可部署的网页版生图中转工具。网页输入提示词，Node 服务校验 Image2 用户 Key 与额度后调用 `https://nowcoding.ai/v1/responses`，生成结果返回浏览器并保存在 IndexedDB 本地历史中。

## 功能

- 用户 Key：前端使用 Image2 自己发放的用户 Key，不暴露真实供应商 API Key。
- 额度校验：服务端会在生成前检查和扣减用户额度，上游失败时返还额度。
- 本地历史：生成图片仅保存在当前浏览器 IndexedDB，不会长期保存在服务器。
- 提示词复用：历史卡片支持重新编辑、再次生成、复制提示词、删除。
- 多图生成：可以设置一次生成的图片数量，前端会并行提交多次生成请求。
- 多图参考：底部上传入口支持同时添加多张本地图片，参考图编辑模式会把它们作为多个 `input_image` 传给接口。
- 图片比例：支持智能比例以及 `9:21`、`9:16`、`2:3`、`3:4`、`1:1`、`4:3`、`3:2`、`16:9`、`21:9`。智能比例不会传入比例文本；其他比例会写入 prompt，不再发送分辨率参数。
- 深色模式：右上角支持浅色 / 深色主题切换，并会保存在本地浏览器。

## 运行

先在本地 `.env` 里配置：

```text
NOWCODING_API_KEY=your_api_key_here
IMAGE2_ADMIN_KEY=change_this_admin_key
IMAGE2_DATA_DIR=./data
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

首次使用需要先创建一个 Image2 用户 Key：

```powershell
$headers = @{ Authorization = "Bearer change_this_admin_key"; "Content-Type" = "application/json" }
$body = @{ label = "local-user"; initialCredits = 100 } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri http://localhost:5173/api/admin/keys -Headers $headers -Body $body
```

把返回的 `img2_...` 填入网页里的 `Image2 Key` 输入框后再生成。

## 说明

- 模型：`gpt-5.4-mini`
- 图片接口：`https://nowcoding.ai/v1/responses`
- 图片不会长期保存在服务器；浏览器会把生成结果保存到当前浏览器的 IndexedDB。
- API key 从本地 `.env` 或环境变量 `NOWCODING_API_KEY` 读取，`.env` 不会提交到 Git。
- 用户 Key 和额度数据默认保存在 `IMAGE2_DATA_DIR` 下的 `image2-data.json`。
- 如果修改了 `server.js`，需要重启 `npm start` 才会生效。
- 请求格式细节见 `docs/request-format.md`。
- Ubuntu 公网部署和商业中转改造计划见 `docs/ubuntu-commercial-proxy-plan.md`。

# Image2 生成请求格式说明

这份文档说明用户每次点击“生成”时，Image2 实际发送的请求格式，以及后端如何组装上游 `https://nowcoding.ai/v1/responses` 请求。

## 1. 请求链路

一次点击“生成”后，链路分两层：

```text
浏览器前端 -> 本地/公网 Image2 服务 POST /api/generate
Image2 服务 -> nowcoding Responses API POST https://nowcoding.ai/v1/responses
```

如果生成数量是 `N`，前端会并行发送 `N` 次 `POST /api/generate`。每一次本地请求都会触发一次独立的上游 `POST /v1/responses`，并单独扣减额度。

## 2. 前端发送给 Image2 服务

请求地址：

```http
POST /api/generate
Content-Type: application/json
```

身份认证不再使用 `Authorization: Bearer img2_...`。用户需要先通过邮箱验证码登录，浏览器会自动携带 `image2_session` HttpOnly cookie。

请求体：

```json
{
  "prompt": "用户输入的提示词",
  "aspectRatio": "auto",
  "quality": "medium",
  "mode": "generate",
  "referenceImages": []
}
```

字段说明：

- `prompt`：用户输入的提示词，不能为空。
- `aspectRatio`：图片比例。可选值为 `auto`、`9:21`、`9:16`、`2:3`、`3:4`、`1:1`、`4:3`、`3:2`、`16:9`、`21:9`。
- `quality`：图片质量。可选值为 `low`、`medium`、`high`。
- `mode`：`generate` 表示普通文生图，`edit` 表示参考图编辑。
- `referenceImages`：参考图数组。普通文生图为空数组；参考图编辑时可以包含多张图。

参考图格式：

```json
{
  "id": "浏览器端生成的 uuid",
  "name": "example.png",
  "type": "image/png",
  "dataUrl": "data:image/png;base64,..."
}
```

注意：前端的“生成数量”不传给单次 `/api/generate`。它只用于决定前端并行发送多少次请求。

## 3. 额度校验

Image2 服务收到 `/api/generate` 后会先读取 `image2_session` cookie，并找到当前登录账号。

额度规则：

```text
每生成 1 张图片 = 1 点
```

扣费流程：

```text
1. 校验登录 session
2. 检查账号余额是否足够
3. 预扣额度并记录 usage log
4. 调用上游供应商
5. 成功则确认消耗
6. 失败则返还预扣额度
```

如果用户一次生成多张图，前端仍会并行发送多次 `/api/generate`，每个请求扣 1 点。

### 3.1 登录与礼品卡兑换

请求邮箱验证码：

```http
POST /api/auth/request-code
Content-Type: application/json
```

```json
{
  "email": "user@example.com"
}
```

验证登录：

```http
POST /api/auth/verify-code
Content-Type: application/json
```

```json
{
  "email": "user@example.com",
  "code": "123456"
}
```

登录成功后，服务端写入 `image2_session` cookie。新账号默认获得 100 点额度，具体值可通过 `IMAGE2_SIGNUP_CREDITS` 配置。

查询当前账号：

```http
GET /api/auth/me
```

兑换礼品卡：

```http
POST /api/redeem
Content-Type: application/json
```

```json
{
  "key": "gift_xxx"
}
```

兑换成功会返回增加额度、当前用户和礼品卡状态：

```json
{
  "creditsAdded": 10,
  "giftCard": {
    "id": "uuid",
    "keyPreview": "gift_xxx...abcd",
    "status": "redeemed"
  },
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "credits": 110
  }
}
```

## 4. 后端默认上下文

Image2 服务会把用户提示词包装成 `imagePrompt`。

普通文生图：

```text
请直接调用图片生成工具生成一张图片，不要只回复文字。

用户提示词：
用户输入的提示词
```

参考图编辑，且上传了多张参考图：

```text
请参考用户上传的 3 张图片并调用图片生成工具生成一张新图片，不要只回复文字。

用户提示词：
用户输入的提示词
```

如果选择了具体图片比例，例如 `9:16`，后端会把比例写进提示词：

```text
请直接调用图片生成工具生成一张图片，不要只回复文字。
图片比例：9:16

用户提示词：
用户输入的提示词
```

如果选择 `智能比例`，前端传的是：

```json
{
  "aspectRatio": "auto"
}
```

后端不会追加 `图片比例：...`，也不会发送 `size` 或分辨率字段。

## 5. 后端发送给上游 API

请求地址：

```http
POST https://nowcoding.ai/v1/responses
Authorization: Bearer <NOWCODING_API_KEY>
Content-Type: application/json
```

普通文生图请求体：

```json
{
  "model": "gpt-5.4-mini",
  "input": "请直接调用图片生成工具生成一张图片，不要只回复文字。\n图片比例：9:16\n\n用户提示词：\n用户输入的提示词",
  "tools": [
    {
      "type": "image_generation",
      "quality": "medium"
    }
  ]
}
```

参考图编辑请求体：

```json
{
  "model": "gpt-5.4-mini",
  "input": [
    {
      "role": "user",
      "content": [
        {
          "type": "input_text",
          "text": "请参考用户上传的 2 张图片并调用图片生成工具生成一张新图片，不要只回复文字。\n图片比例：1:1\n\n用户提示词：\n把这两张图的主体融合到同一张图里"
        },
        {
          "type": "input_image",
          "image_url": "data:image/png;base64,..."
        },
        {
          "type": "input_image",
          "image_url": "data:image/jpeg;base64,..."
        }
      ]
    }
  ],
  "tools": [
    {
      "type": "image_generation",
      "quality": "medium"
    }
  ]
}
```

当前不会发送：

```json
{
  "size": "1024x1024"
}
```

图片比例只通过 prompt 文本表达。

## 6. 上游响应格式

上游返回的是 Responses API 风格对象。Image2 关心的是 `output` 数组里的 `image_generation_call`。

典型响应结构：

```json
{
  "id": "resp_xxx",
  "model": "gpt-5.4-mini-2026-03-17",
  "output": [
    {
      "type": "image_generation_call",
      "status": "completed",
      "output_format": "png",
      "result": "iVBORw0KGgoAAAANSUhE..."
    }
  ]
}
```

关键字段：

- `id`：上游响应 ID。
- `model`：实际使用的模型名。
- `output[].type === "image_generation_call"`：表示图片生成结果。
- `output[].result`：图片文件的 base64 内容。
- `output[].output_format`：一般是 `png`。

后端处理逻辑：

```js
const imageCall = payload.output.find(
  item => item.type === "image_generation_call"
);

const base64 = imageCall.result;
```

## 7. Image2 服务返回给前端

Image2 服务不会把图片长期写入服务器磁盘，而是把图片 base64 和元信息直接返回给浏览器：

```json
{
  "id": "resp_xxx",
  "requestId": "image2_req_xxx",
  "model": "gpt-5.4-mini-2026-03-17",
  "status": "completed",
  "outputFormat": "png",
  "mimeType": "image/png",
  "imageBase64": "iVBORw0KGgoAAAANSUhE...",
  "costCredits": 1,
  "remainingCredits": 99
}
```

前端收到后会执行：

```text
imageBase64 -> Blob -> IndexedDB -> URL.createObjectURL -> 页面展示
```

因此刷新页面后，历史图片来自当前浏览器 IndexedDB，而不是服务器文件。

## 8. 管理接口

管理员页面使用独立入口：

```http
GET /admin
```

未登录后台时返回管理员登录页；输入 `IMAGE2_ADMIN_KEY` 后，服务端写入 HttpOnly 的 `image2_admin` cookie，再返回卡密管理页面。普通用户首页不会展示后台入口，也不会加载后台管理脚本。

管理接口可以使用后台 cookie，也可以继续使用 `IMAGE2_ADMIN_KEY` 的 Bearer 方式：

```http
Authorization: Bearer <IMAGE2_ADMIN_KEY>
```

查询用户：

```http
GET /api/admin/users
```

调整账号额度：

```http
POST /api/admin/users/<user-id>/credits
Content-Type: application/json
```

```json
{
  "delta": 50,
  "note": "manual top-up"
}
```

创建礼品卡：

```http
POST /api/admin/gift-cards
Content-Type: application/json
```

```json
{
  "label": "batch-a",
  "credits": 10,
  "count": 5,
  "expiresAt": "2026-06-30T15:59:59.000Z",
  "note": "渠道备注"
}
```

响应会返回本批次创建的明文 `gift_...`，供你发到第三方发卡平台。礼品卡明文只在创建时返回，长期数据只保存 `keyHash` 和 `keyPreview`。

查询礼品卡：

```http
GET /api/admin/gift-cards
```

可选查询参数：

```http
GET /api/admin/gift-cards?status=active&q=abcd
```

查询批次：

```http
GET /api/admin/gift-card-batches
```

卡密状态操作：

```http
POST /api/admin/gift-cards/<card-id>/disable
POST /api/admin/gift-cards/<card-id>/enable
POST /api/admin/gift-cards/<card-id>/revoke
POST /api/admin/gift-card-batches/<batch-id>/disable
```

- `disable`：作废未兑换的 active 卡。
- `enable`：重新启用 disabled 卡。
- `revoke`：撤销已兑换卡，并从用户账号扣回对应额度，最低扣到 0。
- 批次 `disable`：批量作废该批次里仍为 active 的卡。

查询审计日志：

```http
GET /api/admin/audit-logs
```

## 9. 错误响应

用户未输入提示词：

```json
{
  "error": "请输入提示词。"
}
```

用户未登录：

```json
{
  "error": "请先使用邮箱验证码登录。"
}
```

额度不足：

```json
{
  "error": "额度不足，请兑换礼品卡后再生成。",
  "costCredits": 1,
  "remainingCredits": 2
}
```

本地没有配置供应商 API key：

```json
{
  "error": "缺少 NOWCODING_API_KEY，请在本地 .env 中配置。"
}
```

上游请求失败：

```json
{
  "error": "图片接口返回错误。",
  "detail": "上游返回的错误信息"
}
```

上游返回成功但没有图片：

```json
{
  "error": "接口返回成功，但没有找到图片结果。",
  "detail": {}
}
```

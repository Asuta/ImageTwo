# Image2 Ubuntu 公网部署与商业中转改造计划

## 1. 目标

把 Image2 从“本地单人图片生成工具”改造成可以部署在一台 Linux Ubuntu 公网服务器上的网页应用。

目标形态：

- 前端通过公网访问，例如 `http://服务器IP` 或后续绑定域名。
- 真实供应商 API Key 只保存在服务器环境变量中，绝不出现在前端代码里。
- 用户使用 Image2 自己发放的用户 Key 调用服务。
- 服务端负责用户 Key 校验、额度判断、请求转发、失败返还额度。
- 服务端不长期保存生成图片，不提供云端图库。
- 图片生成结果返回给浏览器后，由前端用 IndexedDB 保存本地历史。
- 页面明确提示：生成图片仅保存在当前浏览器本地，不会云端保存，请及时下载重要图片。

非目标：

- 第一阶段不做登录系统。
- 第一阶段不做在线支付闭环。
- 第一阶段不做跨设备云端历史同步。
- 第一阶段不做服务器图片长期存储。

## 2. 目标架构

```text
用户浏览器
  -> 输入用户 Key、提示词、参考图
  -> POST /api/generate

Ubuntu 服务器上的 Image2 服务
  -> 校验用户 Key
  -> 检查额度
  -> 预扣额度
  -> 使用 NOWCODING_API_KEY 调用供应商 API
  -> 供应商失败则返还额度
  -> 供应商成功则返回图片数据给浏览器

用户浏览器
  -> 接收图片
  -> 保存到 IndexedDB
  -> 在本地历史中展示
```

数据流量说明：

- 用户上传提示词和参考图时，数据会经过 Image2 服务器。
- Image2 服务器转发给供应商时，数据会从 Image2 服务器出站。
- 供应商返回图片时，图片会进入 Image2 服务器。
- Image2 服务器返回图片给用户时，图片会从 Image2 服务器出站。
- 服务器只做请求生命周期内的处理，不把图片长期写入磁盘。

## 3. 后端改造计划

### 3.1 服务端运行方式

当前项目使用 Node 原生 HTTP 服务，可以继续保留，不强制引入 Express。

需要调整：

- 服务监听地址支持公网部署：默认监听 `0.0.0.0`。
- 端口通过环境变量 `PORT` 控制，默认仍可使用 `5173`。
- 移除对 Windows 本地路径展示的依赖，不再返回 `D:/Project/Image2/generated/...`。
- 保留静态文件托管能力，用于直接部署前端页面。

建议环境变量：

```text
PORT=5173
HOST=0.0.0.0
NOWCODING_API_KEY=真实供应商_key
IMAGE2_ADMIN_KEY=管理端操作_key
IMAGE2_DATA_DIR=/var/lib/image2
```

### 3.2 用户 Key 与额度

新增一套 Image2 自己的用户 Key，不使用供应商原始 Key。

推荐第一阶段用 SQLite 存储，文件放在：

```text
/var/lib/image2/image2.db
```

原因：

- 单机 Ubuntu 部署简单。
- 不需要额外数据库服务。
- 额度扣减可以使用事务，避免并发超扣。
- 后续可以迁移到 PostgreSQL。

建议数据表：

```text
api_keys
- id
- key_hash
- label
- status: active / disabled
- remaining_credits
- created_at
- updated_at

usage_logs
- id
- key_id
- request_id
- prompt_preview
- mode
- quality
- image_count
- cost_credits
- status: reserved / succeeded / failed / refunded
- error_message
- created_at
- updated_at
```

安全要求：

- 服务端数据库不保存用户 Key 明文，只保存 hash。
- 用户 Key 只在创建时显示一次。
- 前端请求使用：

```http
Authorization: Bearer img2_xxx
```

### 3.3 额度扣减规则

第一阶段采用简单规则：

```text
low = 1 点 / 张
medium = 2 点 / 张
high = 4 点 / 张
```

参考图编辑第一阶段不额外加价，只按图片质量和张数计费。

扣费流程：

```text
1. 接收请求
2. 校验用户 Key
3. 计算本次请求所需额度
4. 数据库事务内检查余额并预扣
5. 调用供应商
6. 成功：记录 succeeded
7. 失败：返还预扣额度并记录 failed/refunded
```

如果用户一次生成多张图，前端现在是并行发多次请求。第一阶段可以沿用该行为，每次请求单独扣费。

### 3.4 图片返回方式

当前服务端会把供应商返回的 base64 写入 `generated/`，再返回本地 URL。

目标改为：

- 不写入 `generated/`。
- 服务端解析供应商返回的 `image_generation_call.result`。
- 服务端直接向前端返回图片数据和元信息。

建议响应格式：

```json
{
  "id": "resp_xxx",
  "requestId": "image2_req_xxx",
  "model": "gpt-5.4-mini-xxx",
  "status": "completed",
  "outputFormat": "png",
  "mimeType": "image/png",
  "imageBase64": "iVBORw0KGgo...",
  "costCredits": 2,
  "remainingCredits": 98
}
```

说明：

- 第一阶段可以返回 base64，方便与当前供应商响应格式衔接。
- 这不是长期存储，只是一次 HTTP 响应的数据。
- 如果后续供应商支持二进制图片或流式响应，再优化为流式转发。

### 3.5 管理接口

第一阶段不做完整后台页面，只提供少量管理 API，使用 `IMAGE2_ADMIN_KEY` 保护。

建议接口：

```text
POST /api/admin/keys
创建用户 Key，并设置初始额度

GET /api/admin/keys
查看用户 Key 列表和余额

POST /api/admin/keys/:id/credits
增加或减少额度

POST /api/admin/keys/:id/disable
禁用用户 Key
```

这些接口只返回用户 Key 的部分信息，不返回完整明文 Key，创建时除外。

## 4. 前端改造计划

### 4.1 用户 Key 输入

在页面中新增用户 Key 设置入口。

行为：

- 用户输入自己的 Image2 Key。
- 前端保存到 `localStorage`。
- 每次调用 `/api/generate` 时放入 `Authorization` header。
- Key 无效时提示用户检查 Key。
- 额度不足时提示用户联系服务提供方充值。

不允许：

- 前端出现 `NOWCODING_API_KEY`。
- 前端内置任何供应商 Key。

### 4.2 IndexedDB 本地历史

当前历史使用 `sessionStorage`，并依赖 `/generated/xxx.png`。

目标改为 IndexedDB：

```text
image2-local-history

tasks
- id
- prompt
- aspectRatio
- quality
- mode
- createdAt
- costCredits
- remainingCreditsSnapshot

images
- id
- taskId
- blob
- mimeType
- outputFormat
- createdAt
```

前端收到 `imageBase64` 后：

```text
base64 -> Blob -> IndexedDB
Blob -> URL.createObjectURL -> 页面展示
```

刷新页面后：

```text
IndexedDB -> Blob -> URL.createObjectURL -> 恢复历史展示
```

### 4.3 本地历史限制

为了避免浏览器本地数据库无限增长，第一阶段设置软限制：

```text
最多保留 300 张图片
```

当超过限制时：

- 自动删除最旧图片和对应历史记录。
- 保留手动删除单条历史功能。
- 增加“清空本地历史”功能。

后续可以增加存储占用提示，但第一阶段不强制实现。

### 4.4 用户提示文案

页面需要明确告诉用户：

```text
生成图片仅保存在当前浏览器本地，不会云端保存。清除浏览器数据、更换设备或更换浏览器后历史可能丢失，请及时下载重要图片。
```

避免使用：

```text
云端保存中
已同步
服务器存储
永久保存
```

## 5. Ubuntu 部署目标

### 5.1 服务器基础

目标服务器：

- Ubuntu 22.04 或 24.04 LTS。
- 有公网 IPv4。
- 安装 Node.js 20 LTS 或更新 LTS。
- 使用 systemd 或 PM2 管理进程。
- 使用 Nginx 做反向代理。

推荐目录：

```text
/opt/image2              项目代码
/var/lib/image2          SQLite 数据库和运行数据
/etc/image2/image2.env   环境变量文件
```

### 5.2 Nginx

Nginx 负责：

- 对外监听 80 端口。
- 后续绑定域名后负责 HTTPS。
- 转发到本机 Node 服务，例如 `127.0.0.1:5173`。
- 设置请求体大小限制，允许参考图上传。

建议第一阶段请求体限制：

```nginx
client_max_body_size 80m;
```

### 5.3 systemd

使用 systemd 后，服务可以开机自启、崩溃重启。

目标服务行为：

- `WorkingDirectory=/opt/image2`
- `EnvironmentFile=/etc/image2/image2.env`
- `ExecStart=/usr/bin/node server.js`
- `Restart=always`

### 5.4 防火墙

公网只开放：

```text
22/tcp  SSH
80/tcp  HTTP
443/tcp HTTPS，绑定域名后启用
```

Node 服务端口 `5173` 不直接暴露公网，只允许本机 Nginx 访问。

## 6. 实施阶段

### 阶段 1：去除服务器图片持久化

- 修改 `/api/generate`，不再写入 `generated/`。
- 返回 `imageBase64`、`mimeType`、`costCredits` 等字段。
- 前端改为用返回结果直接展示图片。
- 删除界面中的本机绝对路径展示。

验收：

- 生成图片成功显示。
- 服务器项目目录不出现新的生成图片文件。
- 响应中不再包含 Windows 本地路径。

### 阶段 2：IndexedDB 历史

- 用 IndexedDB 替换 `sessionStorage`。
- 图片 Blob 保存到浏览器本地。
- 刷新页面后历史图片仍可显示。
- 增加删除历史、清空历史、最多 300 张限制。

验收：

- 刷新页面后生成历史不丢失。
- 关闭再打开同一浏览器后历史仍存在。
- 清空浏览器数据后历史消失，符合预期。

### 阶段 3：用户 Key 和额度

- 新增用户 Key 校验。
- 新增 SQLite 数据库。
- 新增额度预扣、成功确认、失败返还。
- 前端请求带 `Authorization: Bearer ...`。
- 前端显示 Key 无效和额度不足。

验收：

- 无 Key 请求被拒绝。
- 错误 Key 请求被拒绝。
- 额度不足请求被拒绝。
- 成功生成后额度减少。
- 上游失败时额度返还。

### 阶段 4：管理接口

- 新增管理 API 创建用户 Key。
- 支持查询余额、调整额度、禁用 Key。
- 使用 `IMAGE2_ADMIN_KEY` 保护管理接口。

验收：

- 可以创建新用户 Key。
- 可以给 Key 增加额度。
- 禁用后该 Key 不能继续生成图片。

### 阶段 5：Ubuntu 部署文档与上线

- 补充 Ubuntu 安装 Node、拉取代码、配置环境变量、启动服务的步骤。
- 补充 Nginx 反代配置。
- 补充 systemd 服务文件。
- 在公网 IP 上完成访问测试。

验收：

- 通过公网 IP 可以打开页面。
- 通过公网 IP 可以完成图片生成。
- 真实供应商 Key 不出现在前端源码和浏览器请求里。
- 重启服务器后服务自动恢复。

## 7. 主要风险与约束

- 只要供应商不支持临时授权，上传和下载流量都必须经过 Image2 服务器。
- 如果供应商只返回 JSON base64，服务端无法做到严格意义上的纯二进制流式转发。
- IndexedDB 容量取决于用户浏览器和设备，不能承诺永久保存几百张图片。
- 用户清理浏览器数据、切换浏览器、切换设备后，本地历史无法恢复。
- 单机 SQLite 适合第一阶段，用户量变大后需要迁移到 PostgreSQL。
- 公网部署必须避免把 Node 端口直接暴露给公网，建议统一走 Nginx。

## 8. 第一版完成标准

第一版完成后，项目应该满足：

- 能部署在 Ubuntu 公网服务器上。
- 用户访问网页时不需要本地 Node 环境。
- 用户使用 Image2 自己的 Key，而不是供应商 Key。
- 服务器能做额度校验和扣减。
- 服务器不长期保存图片。
- 图片历史保存在用户当前浏览器的 IndexedDB。
- 页面明确提示本地保存限制。
- 生成、刷新、再次打开页面的基本流程可用。

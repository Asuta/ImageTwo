# Image2 Web Generator

一个本地网页版生图小工具，网页输入提示词，Node 服务调用 `https://nowcoding.ai/v1/responses`，并把生成的 PNG 保存到 `D:/Project/Image2/generated`。

## 功能

- 历史记录：当前浏览器会话内会保留每次生成的提示词、参数和图片结果。
- 提示词复用：历史卡片支持重新编辑、再次生成、复制提示词、删除。
- 多图生成：可以设置一次生成的图片数量，前端会并行提交多次生成请求。
- 多图参考：底部上传入口支持同时添加多张本地图片，参考图编辑模式会把它们作为多个 `input_image` 传给接口。
- 图片比例：支持智能比例以及 `9:21`、`9:16`、`2:3`、`3:4`、`1:1`、`4:3`、`3:2`、`16:9`、`21:9`。智能比例不会传入比例文本；其他比例会写入 prompt，不再发送分辨率参数。
- 本地路径展示：每张生成图都会显示 `D:/Project/Image2/generated/...png` 形式的绝对路径。

## 运行

先在本地 `.env` 里配置：

```text
NOWCODING_API_KEY=your_api_key_here
```

```powershell
npm start
```

打开：

```text
http://localhost:5173
```

## 说明

- 模型：`gpt-5.4-mini`
- 图片接口：`https://nowcoding.ai/v1/responses`
- 图片保存目录：`D:/Project/Image2/generated`
- API key 从本地 `.env` 或环境变量 `NOWCODING_API_KEY` 读取，`.env` 不会提交到 Git。
- 如果修改了 `server.js`，需要重启 `npm start` 才会生效。

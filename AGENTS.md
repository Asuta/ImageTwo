# AGENTS.md

## 项目概览

- 这是一个可部署的 Image2 网页生图中转工具：React/Vite 前端负责登录、提示词、参考图、本地历史、经典生成界面和轻量无限画布；Node `server.js` 负责邮箱验证码登录、额度、礼品卡、管理员后台和上游图片接口转发。
- 项目主要面向中文使用场景；新增项目文档和 agent 说明默认用中文，代码标识符、命令和路径保持原文。
- 包管理器使用 `pnpm`，`package.json` 指定 `pnpm@9.15.2` 和 Node `>=18`。

## 项目地图

- 前端入口：`src/main.jsx`、`src/App.jsx`。
- 前端样式：`src/styles.css`、`src/concept-fidelity.css`；轻量画布样式为 `src/canvas-mode.css`。
- 轻量画布：`src/components/canvas/CanvasWorkspace.jsx` 负责全屏画布、图片/文本节点、框选、复制克隆、八方向缩放、可编辑连线、`@` 节点引用、导航辅助、上下文生成面板和 AI 助手抽屉等交互；`src/components/canvas/AnnotationEditor.jsx` 负责非破坏式图片标注，`src/lib/canvas-db.js` 负责独立 IndexedDB 布局、上传素材和标注图持久化。画布不包含视频生成或视频节点。
- shadcn/Radix UI 组件：`src/components/ui/`，配置在 `components.json`，图标库为 `lucide`。
- 前端工具函数：`src/lib/utils.js`，`@/*` 别名指向 `src/*`。
- Vite 配置：`vite.config.js`。开发时 `/api` 代理到 `http://127.0.0.1:5180`，并为 `/admin` 提供本地页面 fallback。
- 后端服务：`server.js`。包含 API 路由、认证、额度、礼品卡、管理员接口、静态资源服务和生产监听逻辑。
- 本地开发 API 启动脚本：`scripts/dev-api.mjs`，默认设置 `PORT=5180`、`HOST=127.0.0.1`、`IMAGE2_MAIL_PROVIDER=dev`，并禁用真实邮件发送。
- 静态后台页面：`public/admin*.html`、`public/admin*.js`。
- 文档：`README.md`、`docs/request-format.md`、`docs/ubuntu-commercial-proxy-plan.md`。
- 构建输出和运行数据：`dist/`、`data/`、`generated/`、`output/`、`tmp/` 均不应作为源代码修改目标。

## 常用命令

- 安装依赖：`pnpm install`。
- 启动前端开发服务器：`pnpm run dev`，默认监听 `127.0.0.1:5176`。
- 启动本地 API 服务：`pnpm run dev:api`，默认监听 `127.0.0.1:5180`，并在本地返回/打印验证码。
- 本地完整开发：同时运行 `pnpm run dev` 和 `pnpm run dev:api`，这样登录、验证码、额度和 `/api` 流程才能正常测试。
- 构建前端：`pnpm run build`。
- 生产式本地启动：`pnpm start`，会先执行 `vite build`，再运行 `server.js`。
- 预览构建产物：`pnpm run preview`。

## 环境与数据

- 运行配置优先级：系统环境变量优先，其次是 `IMAGE2_ENV_FILE` 指定文件或用户目录 `.image2.env`，最后是项目根目录 `.env`。
- 不要提交 `.env`、`.env.*`、`data/`、生成图片、日志或临时调试输出；这些已在 `.gitignore` 中排除。
- `IMAGE2_API_KEY` / `NOWCODING_API_KEY`、`IMAGE2_ADMIN_KEY`、腾讯云邮件推送 Secret、SendCloud 凭证等都属于敏感信息，不要写入文档、测试输出或提交内容。
- 验证码邮件发信平台由 `IMAGE2_MAIL_PROVIDER` 控制；`auto` 会优先使用腾讯云邮件推送配置，再回退到 SendCloud，未配置时走开发验证码输出。
- 腾讯云邮件推送需要 `TENCENT_SES_SECRET_ID`、`TENCENT_SES_SECRET_KEY`、`TENCENT_SES_REGION`、`TENCENT_SES_FROM`；默认 `TENCENT_SES_CONTENT_MODE=simple` 会直接发送项目内验证码 HTML/纯文本内容。如腾讯云账号不支持 Simple 模式，可切到 `template` 并配置 `TENCENT_SES_TEMPLATE_ID`，模板变量默认使用 `{{code}}`，可通过 `TENCENT_SES_TEMPLATE_DATA_KEY` 调整。
- 用户、session、礼品卡、额度和生成历史默认写入 `IMAGE2_DATA_DIR` 下的数据文件。修改数据结构时，要兼容已有本地数据或写清迁移方式。
- 经典历史保存在浏览器 `image2-local-history` IndexedDB；画布布局、本地上传素材和画布标注结果保存在独立的 `image2-canvas-workspace` IndexedDB。为覆盖刷新前的保存窗口，画布还会把不含 Blob 的布局、视口和设置写入 `localStorage` 兜底；生成图片节点只持久化 `taskId` / `imageId` 引用，不复制经典历史中的生成 Blob。
- 本地环境不能发送真实邮箱验证码。测试登录相关流程时使用 `pnpm run dev:api`，不要依赖真实邮件；该脚本会强制 `IMAGE2_MAIL_PROVIDER=dev`，避免全局 `.image2.env` 中的生产邮件配置被误用。

## 代码约定

- 前端保持现有 React 函数组件和 hooks 风格；优先在 `src/App.jsx` 周围沿用既有状态、IndexedDB、本地存储和 API 调用模式。
- UI 组件沿用 shadcn/Radix 配置和 `lucide-react` 图标；新增通用组件优先放到 `src/components/ui/` 或与现有结构一致的位置。
- CSS 以现有 `src/styles.css` 和 `src/concept-fidelity.css` 为准，避免引入新的全局设计体系或无关重写。
- 后端继续使用原生 Node HTTP 服务和现有 helper，不要为了单个接口引入 Express/Koa 等框架。
- API 路由修改要同步考虑认证 cookie、额度扣减/返还、管理员权限、错误响应和前端 toast 文案。
- 多图生成是前端并行发送多次 `POST /api/generate`，不是在单个请求里传生成数量；相关请求格式见 `docs/request-format.md`。
- 图片比例为 `auto` 时不应给上游追加比例文本；其他比例会写入 prompt，参考 `docs/request-format.md` 的说明。
- 画布模式必须复用 `App.jsx` 的生成、轮询、额度和经典历史链路；不要在 Canvas 组件中另写一套 `/api/generate` 请求。画布移除生成节点只隐藏布局，不删除经典历史。
- 画布分支关系由节点 `parentIds` 和任务 `canvasContext.parentIds` 表达；分支续作结果默认落在来源节点右侧并绘制连线，不要根据节点坐标反推父子关系。节点连接锚点位于节点左右边缘外侧，拖动右侧吸附球时由 `connectionDraft` 表达跟随鼠标和磁性吸附状态；在空白处松手时，新节点的左侧吸附球必须与松手位置重合。空图像生成节点的直接 `parentIds` 同时代表该输入框的默认参考来源：上游图片作为参考图、上游文本作为提示词上下文，断开连线或移除参考卡片必须同步移除这项输入。对单个空图像节点发起生成时，首张任务图片必须原地替换该节点并继承其上游 `parentIds`；不要把空节点保留为中间父节点后再追加结果。
- 画布中的文本节点作为选中生成时的提示词上下文使用，空图像节点可作为分支起点；两者只保存在画布工作区，不写入经典生成历史。
- 画布提示词中的 `@[名称](canvas:节点ID)` 令牌用于 `@` 节点引用；提交生成前会移除令牌本身，并把被引用的图片加入参考图、把被引用的文本加入提示词上下文。

## 本地图片 Markdown 规则

- 在 Markdown 中展示本地图片时，始终使用绝对路径，并使用正斜杠 `/`。
- 推荐写法：

  ```md
  ![图片](D:/Project/image.png)
  ```

- 不要使用 Windows 反斜杠路径，渲染器可能把反斜杠当作转义字符：

  ```md
  ![图片](D:\Project\image.png)
  ```

- 优先使用绝对路径，不要使用相对路径：

  ```md
  ![图片](C:/Users/youdo/Documents/.../image.png)
  ```

## 测试与验证

- 这个仓库目前没有 `test`、`lint` 或 `typecheck` 脚本；不要在说明中假设它们存在。需要验证时优先运行与改动相关的已有脚本。
- 前端或构建配置改动后，至少运行 `pnpm run build`。
- 登录、生成、兑换、管理员后台或任何 `/api` 行为改动后，同时启动 `pnpm run dev` 和 `pnpm run dev:api` 做浏览器验证。
- 画布改动需要同时验证经典模式无回归，以及画布平移/缩放、框选、上传、图像/文本节点、添加菜单、AI 助手抽屉、上下文生成面板、拖拽、八方向缩放、复制/粘贴/克隆、选图参考、`@` 节点引用、图片标注、手动连线/断线/边删除、拖出新分支、导航地图、聚焦所选、撤销/重做、生成落位、双模式同步和刷新恢复。
- 使用 Playwright 测试本项目时，只需要测试横向桌面版本；不要求竖屏或移动端 portrait 测试。
- 如果修改 `server.js`，正在运行的服务需要重启后才会生效。
- 测试管理员接口时使用本地环境变量中的 `IMAGE2_ADMIN_KEY`，不要把真实 key 写进命令记录或文档。

## AGENTS.md 维护

- 修改代码、脚本、目录结构、环境变量、运行命令、部署方式、验证方式或稳定工作流时，检查是否需要同步更新本文件。
- 如果本次改动产生了可复用的项目知识，例如新命令、新验证步骤、反复出现的坑点、目录职责变化或安全边界变化，应把对应说明写入本文件。
- 准备提交前，主动检查本文件是否需要随代码一起更新；如果需要，`AGENTS.md` 的更新应与相关代码修改放在同一个提交中。
- 需要让 AI 专门维护本文件时，直接调用：`使用 $generate-agents-md 检查并更新当前项目的 AGENTS.md`。
- 不要把一次性任务记录、临时调试过程、截图流水账、时间戳、密钥、token、真实环境变量值或提交历史写入本文件。
- 如果未来某个子目录出现与根目录不同且长期有效的规则，只在该子目录新增嵌套 `AGENTS.md`；不要复制根目录已有说明。

## 文档维护

- 用户可见行为、环境变量、运行命令、请求格式、额度规则或管理员接口变化时，同步更新 `README.md` 或 `docs/` 下对应文档。
- 不要把一次性任务记录、临时调试过程、截图流水账或密钥写入项目文档。

# AGENTS.md

## 项目概览

- 这是一个可部署的 Image2 网页生图中转工具：React/Vite 前端负责登录、提示词、参考图、本地历史、经典生成界面和轻量无限画布；Node `server.js` 负责邮箱验证码登录、额度、礼品卡、管理员后台和上游图片接口转发。
- 项目主要面向中文使用场景；新增项目文档和 agent 说明默认用中文，代码标识符、命令和路径保持原文。
- 包管理器使用 `pnpm`，`package.json` 指定 `pnpm@9.15.2`；Node 使用 `^20.19.0 || >=22.12.0`，兼容 Vite 和 sharp 0.35.4+。

## 项目地图

- 前端入口：`src/main.jsx`、`src/App.jsx`。
- 前端样式：`src/styles.css`、`src/concept-fidelity.css`；经典模式手机竖屏的最终覆盖样式集中在最后加载的 `src/classic-mobile.css`，画布基础样式为 `src/canvas-mode.css`，生成卡与固定面板样式集中在随后加载的 `src/canvas-redesign.css`，均不得影响经典模式。
- 轻量画布：`CanvasProjectsPage.jsx` 负责项目管理；`CanvasWorkspace.jsx` 负责画布手势、布局、素材、草稿与运行协调；`CanvasInspector.jsx` 负责固定右侧的草稿/素材详情与运行操作；`AnnotationEditor.jsx` 负责非破坏式标注。`src/lib/canvas-model.js` 提供输入解析、快照、运行状态和 schema 迁移纯函数；`src/lib/canvas-db.js` 负责按 `canvasId` 隔离的 IndexedDB 与本地兜底存储。交互契约见 `docs/canvas-redesign.md`。画布不包含视频或自动执行图。
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
- 后端回归：`pnpm test`；真实浏览器回归：`pnpm run test:browser`。测试通过 `tests/helpers/fixture.mjs` 启动开发 API 和本地模拟供应商，隔离 env 与数据到 `tmp/regression-tests/`。Windows 默认 Edge，其他系统默认 Playwright Chromium，可用 `IMAGE2_TEST_BROWSER` 指定 channel。

## 环境与数据

- 运行配置优先级：系统环境变量优先，其次是 `IMAGE2_ENV_FILE` 指定文件或用户目录 `.image2.env`，最后是项目根目录 `.env`。
- 生图供应商列表和当前启用项由共享环境文件中的 `IMAGE2_PROVIDERS_JSON`、`IMAGE2_ACTIVE_PROVIDER_ID` 管理，并在每次读取时获取最新共享值；新 Git worktree 初始化及用户、历史、额度等普通数据写入不得覆盖共享供应商。未显式配置供应商时默认使用 `https://ai-pixel.online` 的 `ai-pixel` 格式和 `gpt-image-2.5-flare` 模型。
- 不要提交 `.env`、`.env.*`、`data/`、生成图片、日志或临时调试输出；这些已在 `.gitignore` 中排除。
- `IMAGE2_API_KEY` / `NOWCODING_API_KEY`、`IMAGE2_ADMIN_KEY`、腾讯云邮件推送 Secret、SendCloud 凭证等都属于敏感信息，不要写入文档、测试输出或提交内容。
- 验证码邮件发信平台由 `IMAGE2_MAIL_PROVIDER` 控制；`auto` 会优先使用腾讯云邮件推送配置，再回退到 SendCloud，未配置时走开发验证码输出。
- 腾讯云邮件推送需要 `TENCENT_SES_SECRET_ID`、`TENCENT_SES_SECRET_KEY`、`TENCENT_SES_REGION`、`TENCENT_SES_FROM`；默认 `TENCENT_SES_CONTENT_MODE=simple` 会直接发送项目内验证码 HTML/纯文本内容。如腾讯云账号不支持 Simple 模式，可切到 `template` 并配置 `TENCENT_SES_TEMPLATE_ID`，模板变量默认使用 `{{code}}`，可通过 `TENCENT_SES_TEMPLATE_DATA_KEY` 调整。
- 用户、session、礼品卡、额度和生成历史默认写入 `IMAGE2_DATA_DIR` 下的数据文件。修改数据结构时，要兼容已有本地数据或写清迁移方式。
- 新账号初始额度由 `IMAGE2_SIGNUP_CREDITS` 控制，当前默认值为 `5`；单次生图成本由 `IMAGE2_GENERATION_COST_CREDITS` 控制，当前默认值为 `0.05`，表示每张图片扣 0.05 点；余额、预扣、失败返还和统计统一保留最多两位小数，用户当前余额及历史余额在前端固定显示两位小数。`GET /api/auth/me` 会同时返回 `generationCostCredits`，经典模式和 Canvas 必须基于该运行时单价与当前生成数量显示预计消耗，不得在前端硬编码单价。
- 经典历史保存在浏览器 `image2-local-history` IndexedDB；Canvas 项目清单以及每个项目按 `canvasId` 隔离的布局、本地上传素材、独立草稿、有序参考、运行快照和标注素材版本保存在独立的 `image2-canvas-workspace` IndexedDB。数据库从旧单画布结构升级时会把原节点迁入 `default-workspace` 项目。为覆盖刷新前的保存窗口，各画布还会把不含 Blob 的布局、草稿、运行快照、视口和设置写入独立的 `localStorage` 兜底键；生成图片节点只持久化 `taskId` / `imageId` 引用，不复制经典历史中的生成 Blob。
- 本地环境不能发送真实邮箱验证码。测试登录相关流程时使用 `pnpm run dev:api`，不要依赖真实邮件；该脚本会强制 `IMAGE2_MAIL_PROVIDER=dev`，避免全局 `.image2.env` 中的生产邮件配置被误用。

## 代码约定

- 前端保持现有 React 函数组件和 hooks 风格；优先在 `src/App.jsx` 周围沿用既有状态、IndexedDB、本地存储和 API 调用模式。
- UI 组件沿用 shadcn/Radix 配置和 `lucide-react` 图标；新增通用组件优先放到 `src/components/ui/` 或与现有结构一致的位置。
- CSS 以现有 `src/styles.css` 和 `src/concept-fidelity.css` 为准，避免引入新的全局设计体系或无关重写。
- 后端继续使用原生 Node HTTP 服务和现有 helper，不要为了单个接口引入 Express/Koa 等框架。
- API 路由修改要同步考虑认证 cookie、额度扣减/返还、管理员权限、错误响应和前端 toast 文案。
- HTTP 路由通过统一 Promise 异常边界返回受控错误；后台生成 Promise 也必须有最终错误边界，防止失败记账再次抛错导致进程退出。JSON 请求使用 `readJsonBody`，静态资源仅允许读取普通文件。异步网络/图片操作结束后必须重新读取最新数据再同步提交，禁止把 await 前的整个数据快照写回。该 JSON 数据存储仅适用于单个写入进程。
- 生成状态查询必须校验 session 与历史记录的 `userId`，仅返回任务结果字段。生成任务以同一用户的 `clientTaskId` + `clientImageId` 去重；“再次生成”必须换新 ID。服务器从持久化归档恢复成功结果，启动时对无结果的遗留任务幂等退款。
- 前端必须先持久化任务、所属账号和所有图片 ID 再发请求；刷新时只恢复当前账号的进行中任务。收到 requestId 后立即保存；图片结果、每图扣点和任务账务汇总在同一 IndexedDB 事务内写入，避免多图并发丢失累计费用。恢复任务的历史余额快照不得覆盖账户当前余额。
- 历史自动清理只限制未被画布引用的已完成图片为 300 张；`loadCanvasHistoryImageIds` 要覆盖所有项目、隐藏节点和 localStorage 兜底快照，引用读取失败时中止清理。素材缺失时保留画布节点及连线，不能因历史暂不可用删除已保存布局。
- 多图生成是前端并行发送多次 `POST /api/generate`，不是在单个请求里传生成数量；相关请求格式见 `docs/request-format.md`。
- 可选生图模型集中在 `src/lib/image-models.js`：`gpt-image-2.5-flare`（默认）和 `gpt-image-2.5-sunburst`，前端与 Node 后端共用。经典模式、Canvas、历史重试均须显式提交任务模型，后端在预扣前校验，并在异步任务、上游文生图/编辑请求和历史中保留所选模型，不能被供应商默认值或上游内部模型别名覆盖。切换模型不改共享供应商；Canvas 的模型设置按项目内的生成草稿保存，新草稿默认值仍按 `canvasId` 隔离。旧历史重新生成时回退 Flare；旧供应商 `gpt-image-2` / `gpt-image-2-codex` 读取时兼容 Flare，保留其他自定义供应商模型配置。
- 图片比例为 `auto` 时不应给上游追加比例文本；其他比例会写入 prompt，参考 `docs/request-format.md` 的说明。
- 经典模式主页只保留已经接入真实业务动作、状态或有效外链的交互控件；左侧栏仅承担“经典 / 画布”模式切换，不得重新加入语义和行为随当前模式变化的全局“新建生成”按钮；不要为了视觉还原重新加入仅调用占位弹窗、没有状态变化或没有后续业务逻辑的按钮、筛选器、导航项和开关。
- 经典模式在不超过 720px 的手机竖屏下使用紧凑底部生成栏：默认收起高级设置，聚焦提示词、点击参考图入口或重新编辑任务时展开底部创作设置抽屉；生成提交后自动收起并把最新任务滚动到可见区域。该适配只允许在 `src/classic-mobile.css` 中以经典模式根节点作用域维护，不能扩散到 Canvas，也不要再在其他全局样式文件追加相互覆盖的手机竖屏规则。无 `mode` 参数的首页必须始终默认进入经典模式，不得再从 `localStorage` 恢复上次模式；显式 `?mode=canvas` 仍按深链进入 Canvas。手机端必须保留可进入 Canvas 的入口，Canvas 项目页也必须提供返回经典模式的可见导航，但不隐藏 Canvas、不显示桌面端提示，也不要求 Canvas 工作区适配竖屏。
- 经典模式主页与 Canvas 项目页必须复用同一组主页背景、玻璃面板配色和桌面侧栏宽度变量；不要在 `canvas-mode.css` 中为项目页重新硬编码另一套外壳渐变或侧栏尺寸。单个 Canvas 工作区仍保持独立的全屏画布外观。
- 画布模式必须复用 `App.jsx` 的生成、轮询、额度和经典历史链路；不要在 Canvas 组件中另写一套 `/api/generate` 请求。画布移除生成节点只隐藏布局，不删除经典历史。
- 多 Canvas 的所有节点、视口、提示词设置、上传 Blob、标注和本地兜底快照都必须按显式 `canvasId` 读写；保存一个项目时只替换该项目的节点，不能再清空整个 `nodes` object store。Canvas 项目删除不影响经典生成历史。
- Canvas 新任务必须携带 `canvasContext.canvasId/runId/draftId/draftNodeId/inputPrompt/inputSnapshot/anchor`，结果只自动补齐到所属项目。无归属旧画布任务仅补齐到 `default-workspace`。历史节点 ID 包含 `canvasId`；按任务内图片索引计算落点，不得因只补齐部分图片而错位。手动拖入其他项目的历史图片仍保留。
- Canvas 项目页只通过空白“新建项目”卡片创建项目，并在当前列表插入新卡片，不得自动进入工作区；只有点击项目卡片才调用 `onOpenProject`。项目页不提供独立的提示词创建入口。
- Canvas 项目页、具体画布编辑页和经典模式必须形成真实的浏览器历史层级：用户主动切换模式或进入/退出项目时使用 `pushState`，只允许初始化当前条目时使用 `replaceState`；监听 `popstate` 从 URL 恢复 `workspaceMode` 和 `activeCanvasId`，确保浏览器后退/前进可往返此前页面，不得再用响应状态变化的 `replaceState` 覆盖历史条目。
- Canvas 采用“素材 → 生成卡 → 结果组”。每张生成卡独立保存有序 `refs`、提示词、模型、比例、质量、数量和修订号；选择仅检查和整理，不决定请求输入。所有添加入口（连线、画布选择、直接上传、历史、`@`）必须写同一个 `draft.refs`，按图片内容或历史图片 ID 去重。文本只有明确加入才拼接到提示词；输入预览和提交共用 `resolveGenerationInput`，不得从坐标、选择或旧 `parentIds` 隐式推导。
- 仅素材右侧与生成卡左侧提供可编辑参考连线。素材右侧拖到空白创建引用它的生成卡；生成卡左侧拖到空白提供文本/上传输入。保留双向磁吸、菜单期间冻结待定线和落点锚点对齐。结果来源连线由运行快照产生，只读；检查历史结果时不能同时显示当前草稿输入造成混淆。
- 固定右侧面板区分草稿编辑、素材详情和批量整理。“基于此图修改”创建仅引用该图的新草稿且清空输入正文；“复用生成参数”使用任务当时的实际图片及文字快照创建另一张卡。“标注修改”另存新素材及草稿，不改原节点 Blob。画布选参考锁定目标草稿，候选在完成前不落盘，取消或 Esc 不改变原引用。直接上传引用保留为项目素材，不创建可见节点。
- 每次提交在异步读取图片前冻结输入；`task.prompt` 保存实际请求正文，`canvasContext.inputPrompt` 保存本轮正文，`inputSnapshot` 保存文本内容、引用顺序、参数和修订号；任务 `referenceImages` 保留实际图片版本。修改草稿、文本、标注或引用不能改写历史运行。结果按运行成组放在生成卡右侧并避让已有内容；卡片不被结果替换，完成时不清空草稿、不改变选择或视口。
- 画布文本节点默认作为便签，明确引用后才成为提示词上下文；文本与生成草稿仅保存在画布工作区，不作为经典图片历史。文本节点默认把正文在内的整个节点作为拖拽命中区，单击只选择，双击后才进入编辑状态；编辑期间正文用于输入和文本选择，节点只能从边框拖动，开始键盘输入后暂时隐藏正文上的鼠标指针，移动或按下鼠标时立即恢复，点击画布空白处退出编辑。
- 画布中已有内容的图片节点使用适合画布的标准显示尺寸，不按图片实际分辨率 1:1 展示：上传图片通过 `fitNodeSize` 适配到默认范围，历史和生成图片继续通过 `sizeFromAspectRatio` 使用请求比例对应的节点尺寸。图片节点不得显示缩放柄或允许拉伸；旧布局、上传、复制和标注图片在加载后都要以节点中心不变的方式校正回标准显示尺寸。生成卡使用固定卡片尺寸，文本节点仍可八方向调整文本框尺寸。
- 画布生成只要求“输入框存在有效文字”或“当前生成上下文引用了至少一个有内容的文本节点”满足其一；仅引用图片不能替代提示词，两者都为空时才提示补充提示词。
- 画布提交生成并插入结果后必须保留用户当前的 `viewport`，不得自动调用 `fitToContent`；只有首次进入未保存视口的画布或用户主动点击“适应内容/聚焦所选”时才允许自动调整缩放和平移。
- `@` 仅提供可读素材选择菜单，选项加入统一参考列表并移除临时搜索串，不向新草稿写原始节点 ID 令牌。旧 `@[名称](canvas:ID)` 仅在迁移时解析为明确引用。
- 从画布移除只隐藏节点，仍被引用的素材及其 Blob 保留，引用项标明其不在画布上；缺失、空文本、未完成图片或超过 8 张图片必须阻止提交，不能静默少传。撤销作用于草稿与布局，运行及扣费不可撤销；运行中的结果即使隐藏也能从运行记录恢复显示。
- “恢复任务”调用 App 的既有恢复链路并沿用请求 ID；“重试失败项”只为确定失败项创建新请求；“再生成一组”使用原运行快照及数量，二者显示新增额度。原任务成功图保持不动。
- IndexedDB schema 3 在迁移前把旧完整快照保存在 `backups` store，迁移幂等；空图像转换为生成卡，旧全局提示词只转换为一个未归属草稿。无法核对实际请求的 `parentIds` 只保留为 `legacyParentIds`，不当作新输入。布局 fallback 同时保存 drafts/runs/schemaVersion；Blob 缺失时保留引用占位。加载失败不能保存空数据覆盖旧项目。
- “使用标注图”会另存标注素材，并创建明确引用该素材的新生成草稿，使标注 Blob 进入下一次编辑请求；不写入原始 `@` 令牌，不改变原图和旧运行。删除草稿中的该引用会同步移除参考输入。
- 画布指针交互约定：普通滚轮用于二维平移，`Ctrl/⌘ + 滚轮` 以指针位置为锚点连续缩放；左键用于节点选择/拖动和空白框选，中键或右键拖动空白区用于平移，右键单击节点或已有选择打开操作菜单，右键拖动结束后不得误弹菜单。`Ctrl/⌘ + V` 普通粘贴必须把复制内容的整体包围盒中心放到画布内当前鼠标位置，多节点相对布局保持不变；`Ctrl/⌘ + D` 快速克隆仍在原位置固定偏移，不得被鼠标粘贴定位逻辑改变。滚轮必须由画布 stage 上 `{ passive: false }` 的原生监听处理并取消浏览器默认行为，不能退回 React `onWheel`，否则真实浏览器中 `Ctrl/⌘ + 滚轮` 可能同时触发整页缩放。该原生入口必须先排除 `.canvas-floating-ui`；历史生成图片面板命中时应滚动 `.canvas-history-scroll` 并阻止事件穿透到画布 viewport。素材历史面板的外部点击关闭要在工作区根节点的捕获阶段判断（包含画布与固定右侧面板），面板内部和历史按钮本身不关闭，其余画布节点、空白区或浮层点击均先关闭面板但不得吞掉原点击行为。

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

- 仓库提供 `test` 和 `test:browser` 脚本，没有 `lint` 或 `typecheck` 脚本。回归脚本中必须对期望结果做断言，不能只输出观察值。
- 前端或构建配置改动后，至少运行 `pnpm run build`。
- 登录、生成、兑换、管理员后台或任何 `/api` 行为改动后，同时启动 `pnpm run dev` 和 `pnpm run dev:api` 做浏览器验证。
- 画布改动须跑 `pnpm run test:browser`：包含经典模式登录/恢复/账务，Canvas 独立草稿、明确输入、结果分组、标注、部分失败重试和原 ID 恢复，以及项目导航/搜索/重命名/删除、长列表、平移缩放、文本编辑与八方向缩放、框选、复制粘贴克隆、磁吸连线/断线/空白落点菜单、撤销重做、地图、直接参考上传、迁移备份和刷新/多项目/历史保留。新增纯输入和迁移规则由 `tests/canvas-model.test.mjs` 验证。
- 经典模式移动布局改动需要覆盖至少一个不超过 720px 的手机竖屏尺寸，并回归横向桌面版本；Canvas 仍只要求测试横向桌面版本，不要求竖屏或移动端 portrait 测试。
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

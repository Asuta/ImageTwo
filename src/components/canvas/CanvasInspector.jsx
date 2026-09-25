import React from "react";
import { ArrowUp, ArrowDown, ArrowLeft, ChevronRight, Focus, ImagePlus, MousePointer2, PanelRightClose, Plus, Sparkles, Type, Upload, X } from "lucide-react";
import { IMAGE_MODELS } from "@/lib/image-models";
import { formatCreditAmount } from "@/lib/utils";
import { summarizeRun } from "@/lib/canvas-model";

export function CanvasRunDetails({ run, history, cost, onReuse, onRepeat, onRecover, onReveal, busy, language = "zh" }) {
  const tr = (zh, en) => language === "en" ? en : zh;
  const summary = summarizeRun(run, history);
  const price = amount => Number.isFinite(cost) ? formatCreditAmount(cost * amount) : "—";
  const labels = { running: tr("生成中", "Running"), recoverable: tr("连接中断，可恢复", "Can be recovered"),
    partial: tr("部分失败", "Partially failed"), failed: tr("生成失败", "Failed"), done: tr("已完成", "Completed"), missing: tr("本地任务不可用", "Task unavailable") };
  return <section className="canvas-run-details" data-run-id={run.id}>
    <div className="canvas-run-status"><b>{labels[summary.status]}</b><span>{summary.done}/{summary.total}</span></div>
    <small>{new Date(run.createdAt).toLocaleString()} · {run.snapshot.model} · {run.snapshot.aspectRatio}</small>
    <details>
      <summary>{tr("查看本轮实际输入", "View submitted inputs")}</summary>
      <p className="canvas-snapshot-note">{tr("本轮提交时的快照，后续编辑不会改变它。", "Captured at submission; later edits do not change this run.")}</p>
      <pre>{run.snapshot.prompt}</pre>
      {(summary.task?.referenceImages || []).length > 0 && <div className="canvas-run-images">{summary.task.referenceImages.map((image, index) =>
        <figure key={image.id || index}><img src={image.dataUrl} alt={image.name || tr("参考图", "Reference")} /><figcaption>{index + 1}. {image.name || tr("参考图", "Reference")}</figcaption></figure>
      )}</div>}
      {run.snapshot.inputs.filter(input => input.kind === "text").map((input, index) => <p key={index}>{input.name}: {input.content}</p>)}
    </details>
    <div className="canvas-run-actions">
      {onReveal && <button type="button" onClick={() => onReveal(run)}>{tr("定位结果", "Locate results")}</button>}
      <button type="button" disabled={!summary.task || busy} onClick={() => onReuse(run)}>{tr("复用生成参数", "Reuse inputs")}</button>
      {summary.recoverable > 0 && <button type="button" disabled={busy} onClick={() => onRecover(run.taskId)}>{tr("恢复任务 · 不重复扣费", "Recover · no new charge")}</button>}
      {summary.failed > 0 && <button type="button" disabled={busy} onClick={() => onRepeat(run, true)}>{tr(`重试失败 ${summary.failed} 张 · ${price(summary.failed)} 点`, `Retry ${summary.failed} failed · ${price(summary.failed)} credits`)}</button>}
      <button type="button" disabled={!summary.task || busy} onClick={() => onRepeat(run)}>{tr(`再生成一组 · ${price(run.snapshot.count)} 点`, `Generate again · ${price(run.snapshot.count)} credits`)}</button>
    </div>
  </section>;
}

export default function CanvasInspector({ language, collapsed, onCollapse, draft, selection, selectedAsset, run,
  nodes, getAsset, resolved, promptRef, onPrompt, onChange, onGenerate, onNew, onReturn,
  onContinue, onAddSelected, onAnnotate, onPicker, onUpload, onRemoveRef, onReorderRef, onRevealAsset,
  mentionMenu, busy, currentUser, estimatedCost, runProps, picking, selectedNodes,
  onDuplicate, onRemove, onFocus, onMultiGenerate, onAlign, onEditStart, onEditEnd, onFocusDraft }) {
  const tr = (zh, en) => language === "en" ? en : zh;
  const showDetails = selection && selection.type !== "generation";
  if (collapsed) return <button className="canvas-inspector-expand canvas-floating-ui" type="button" onClick={onCollapse} title={tr("展开面板", "Open inspector")}><ArrowLeft /></button>;
  return <aside className="canvas-inspector canvas-floating-ui" aria-label={tr("画布操作面板", "Canvas inspector")} onPointerDown={event => event.stopPropagation()}>
    <header><div><span>{showDetails ? tr("素材详情", "Asset details") : tr("生成草稿", "Generation draft")}</span><small>{tr("素材 → 生成 → 结果", "Assets → Generate → Results")}</small></div>
      <div className="canvas-inspector-header-actions">{draft && <button type="button" onClick={onFocusDraft} title={tr("定位草稿", "Locate draft")}><Focus /></button>}<button type="button" onClick={onCollapse} title={tr("收起面板", "Collapse inspector")}><PanelRightClose /></button></div></header>
    {selectedNodes.length > 1 ? <div className="canvas-inspector-scroll">
      <h3>{tr(`已选择 ${selectedNodes.length} 项`, `${selectedNodes.length} selected`)}</h3>
      <div className="canvas-inspector-actions">
        <button className="is-primary" type="button" onClick={onMultiGenerate} disabled={!selectedNodes.some(node => ["upload", "history-image"].includes(node.type) && getAsset(node).blob && getAsset(node).status === "done")}>{tr("用所选图片创建生成", "Create draft from selected images")}</button>
        <button type="button" onClick={onDuplicate}>{tr("克隆所选", "Duplicate selected")}</button>
        <button type="button" onClick={onAlign}>{tr("左侧对齐", "Align left")}</button>
        <button type="button" onClick={onFocus}>{tr("聚焦所选", "Focus selected")}</button>
        <button type="button" onClick={onRemove}>{tr("从画布移除", "Remove from canvas")}</button>
        {draft && <button type="button" onClick={onReturn}>{tr("返回正在编辑的草稿", "Return to draft")}</button>}
      </div>
      <p className="canvas-inspector-hint">{tr("多选仅用于整理；创建生成只采用选中的已完成图片。", "Selection is for organization. Only completed selected images enter the new draft.")}</p>
    </div> : showDetails ? <div className="canvas-inspector-scroll">
      {draft && <button className="canvas-back-to-draft" type="button" onClick={onReturn}><ArrowLeft />{tr("返回正在编辑的草稿", "Return to draft")}</button>}
      {selectedAsset?.url ? <img className="canvas-inspector-preview" src={selectedAsset.url} alt={selectedAsset.name || ""} /> : selection.type === "text" ? <pre>{selection.content || tr("空白文本", "Empty note")}</pre> : <p>{selectedAsset?.error || tr("图片尚未完成", "Image is not ready")}</p>}
      <h3>{selection.name || selection.title || tr("生成结果", "Generated image")}</h3>
      <div className="canvas-inspector-actions">
        {selection.type !== "text" && <button className="is-primary" type="button" disabled={!selectedAsset?.blob || selectedAsset.status !== "done"} onClick={onContinue}><Sparkles />{tr("基于此图修改", "Edit from this image")}</button>}
        <button type="button" disabled={!draft || picking} onClick={onAddSelected}><Plus />{tr("添加到当前草稿", "Add to current draft")}</button>
        {selection.type !== "text" && <button type="button" disabled={!selectedAsset?.blob || selectedAsset.status !== "done"} onClick={onAnnotate}>{tr("标注修改", "Annotate and edit")}</button>}
      </div>
      <p className="canvas-inspector-hint">{tr("选择仅查看详情。只有明确添加的素材才参与生成。", "Selection only inspects an asset. Only explicit references are submitted.")}</p>
      {run && <CanvasRunDetails run={run} {...runProps} />}
      {!run && selection.legacyParentIds?.length > 0 && <p className="canvas-inspector-hint">{tr("此图片保留了旧画布的关联，缺少实际请求快照，未将关联自动用作参考。", "Legacy links are retained, but are not treated as submitted inputs.")}</p>}
    </div> : draft ? <form onSubmit={event => { event.preventDefault(); onGenerate(); }} className="canvas-draft-form">
      <div className="canvas-inspector-scroll">
        <label className="canvas-draft-title">{tr("草稿名称", "Draft name")}<input aria-label={tr("草稿名称", "Draft name")} value={draft.title} onFocus={onEditStart} onBlur={onEditEnd} onChange={event => onChange("title", event.target.value)} /></label>
        <div className="canvas-reference-heading"><strong>{tr("参考内容", "References")} <small>{draft.refs.length}</small></strong><span>{tr("按下方顺序提交", "Submitted in order")}</span></div>
        <div className="canvas-reference-list">
          {draft.refs.map((ref, index) => {
            const node = nodes.find(item => item.id === ref.nodeId), asset = node ? getAsset(node) : {};
            const error = resolved.errors.find(item => item.nodeId === ref.nodeId);
            return <div key={ref.nodeId} className={`canvas-reference-item${error ? " is-missing" : ""}`} data-reference-id={ref.nodeId}>
              <b>{index + 1}</b><button type="button" className="canvas-reference-thumbnail" disabled={!node} onClick={() => onRevealAsset(node)} title={tr("在画布查看素材", "Show asset")}>
                {node?.type === "text" ? <Type /> : asset.url ? <img src={asset.url} alt="" /> : <ImagePlus />}</button>
              <div><strong>{node?.name || node?.title || asset.name || tr("丢失的素材", "Missing asset")}</strong><small>{error ? tr("内容不可用，请移除或重新添加", "Unavailable; remove or replace") : node?.type === "text" ? node.content : node?.hidden ? tr("保留在项目素材中", "Stored in project assets") : tr("图片参考", "Image reference")}</small></div>
              <div className="canvas-reference-item-actions"><button type="button" disabled={index === 0 || picking} title={tr("上移参考", "Move reference up")} onClick={() => onReorderRef(index, -1)}><ArrowUp /></button><button type="button" disabled={index === draft.refs.length - 1 || picking} title={tr("下移参考", "Move reference down")} onClick={() => onReorderRef(index, 1)}><ArrowDown /></button><button type="button" disabled={picking} title={tr("移除参考", "Remove reference")} onClick={() => onRemoveRef(ref.nodeId)}><X /></button></div>
            </div>;
          })}
        </div>
        {!draft.refs.length && <p className="canvas-inspector-hint">{tr("可以直接用文字生成，也可以添加图片或文本素材。", "Start with a prompt, or add image and text references.")}</p>}
        <div className="canvas-add-references"><button type="button" disabled={picking} onClick={onPicker}><MousePointer2 />{tr("画布选择", "Select on canvas")}</button><button type="button" disabled={picking} onClick={onUpload}><Upload />{tr("上传参考", "Upload references")}</button></div>
        <label className="canvas-prompt-label">{tr("提示词", "Prompt")}<small>{tr("输入 @ 快速添加参考", "Type @ to add a reference")}</small>
          <textarea ref={promptRef} data-testid="canvas-draft-prompt" value={draft.prompt} onFocus={onEditStart} onBlur={onEditEnd} onChange={event => onPrompt(event.target.value)} placeholder={tr("描述这次想生成或修改的画面…", "Describe what to generate or change…")} onKeyDown={event => {
            if (event.key === "Escape") event.currentTarget.blur();
            if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) { event.preventDefault(); if (!picking) onGenerate(); }
          }} /></label>
        {mentionMenu}
        <details className="canvas-input-preview"><summary>{tr("预览实际提交内容", "Preview submitted input")}</summary><pre>{resolved.prompt || tr("尚无有效提示词", "No prompt yet")}</pre><p>{tr(`${resolved.images.length} 张图片 · ${resolved.texts.length} 段文本上下文`, `${resolved.images.length} images · ${resolved.texts.length} text inputs`)}</p></details>
        <div className="canvas-draft-settings"><label>{tr("图片模型", "Model")}<select aria-label={tr("图片模型", "Model")} value={draft.model} onChange={event => onChange("model", event.target.value)}>{IMAGE_MODELS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
          <label>{tr("比例", "Ratio")}<select aria-label={tr("比例", "Ratio")} value={draft.aspectRatio} onChange={event => onChange("aspectRatio", event.target.value)}>{["auto", "9:21", "9:16", "2:3", "3:4", "1:1", "4:3", "3:2", "16:9", "21:9"].map(value => <option key={value} value={value}>{value === "auto" ? tr("自动", "Auto") : value}</option>)}</select></label>
          <label>{tr("质量", "Quality")}<select aria-label={tr("质量", "Quality")} value={draft.quality} onChange={event => onChange("quality", event.target.value)}>{[["low", "低", "Low"], ["medium", "中", "Medium"], ["high", "高", "High"]].map(([value, zh, en]) => <option key={value} value={value}>{tr(zh, en)}</option>)}</select></label>
          <label>{tr("数量", "Count")}<input aria-label={tr("数量", "Count")} type="number" min="1" max="8" value={draft.count} onChange={event => onChange("count", Math.max(1, Math.min(8, Number(event.target.value) || 1)))} /></label></div>
        {resolved.errors.length > 0 && <p className="canvas-input-error" role="alert">{tr("参考内容存在缺失、空文本或超过 8 张图片，请先处理。", "Fix missing inputs, empty text, or more than 8 image references.")}</p>}
      </div>
      <footer><button className="is-primary" type="submit" data-testid="canvas-generate" disabled={busy || picking || !resolved.hasPrompt || resolved.errors.length > 0}><Sparkles />{busy ? tr("正在提交…", "Submitting…") : currentUser ? tr("生成一组", "Generate batch") : tr("登录后生成", "Sign in to generate")}<span>{estimatedCost} {tr("点", "credits")}</span></button><small>{tr("草稿会保留 · Ctrl/⌘ + Enter 生成", "Draft stays saved · Ctrl/⌘ + Enter")}</small></footer>
    </form> : <div className="canvas-inspector-welcome"><Sparkles /><h3>{tr("从一个生成草稿开始", "Start a generation draft")}</h3><p>{tr("每个草稿独立保存提示词、参考内容和参数。", "Each draft keeps its own prompt, inputs and settings.")}</p><button className="is-primary" type="button" onClick={onNew}><Plus />{tr("新建生成", "New generation")}</button></div>}
    {draft && !showDetails && <button className="canvas-new-draft" type="button" onClick={onNew} disabled={picking}><Plus />{tr("另建一个草稿", "Create another draft")}<ChevronRight /></button>}
  </aside>;
}

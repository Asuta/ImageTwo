import React, { useEffect, useRef, useState } from "react";
import { Eraser, Paintbrush, RotateCcw, Square, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const COLORS = ["#7c5cff", "#ff4d67", "#ffb020", "#21b573", "#111827", "#ffffff"];

function canvasPoint(event, canvas) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) * (canvas.width / rect.width),
    y: (event.clientY - rect.top) * (canvas.height / rect.height)
  };
}

export default function AnnotationEditor({ imageUrl, title, language = "zh", onCancel, onSave }) {
  const canvasRef = useRef(null);
  const baseCanvasRef = useRef(null);
  const historyRef = useRef([]);
  const interactionRef = useRef(null);
  const [tool, setTool] = useState("brush");
  const [color, setColor] = useState(COLORS[0]);
  const [size, setSize] = useState(12);
  const [ready, setReady] = useState(false);

  const copy = language === "en"
    ? {
        title: "Annotate & edit region",
        hint: "Paint or frame the region you want to change. The marked image becomes the next reference.",
        brush: "Brush",
        rectangle: "Rectangle",
        eraser: "Eraser",
        undo: "Undo",
        clear: "Clear",
        cancel: "Cancel",
        save: "Use marked image"
      }
    : {
        title: "图片标注与局部修改",
        hint: "涂抹或框出需要修改的区域，保存后标注图会作为下一次生成的参考图。",
        brush: "画笔",
        rectangle: "框选",
        eraser: "橡皮",
        undo: "撤销",
        clear: "清空",
        cancel: "取消",
        save: "使用标注图"
      };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imageUrl) {
      return undefined;
    }
    let cancelled = false;
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      if (cancelled) return;
      const maximum = 1800;
      const scale = Math.min(maximum / image.naturalWidth, maximum / image.naturalHeight, 1);
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext("2d");
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const baseCanvas = document.createElement("canvas");
      baseCanvas.width = canvas.width;
      baseCanvas.height = canvas.height;
      baseCanvas.getContext("2d").drawImage(canvas, 0, 0);
      baseCanvasRef.current = baseCanvas;
      historyRef.current = [context.getImageData(0, 0, canvas.width, canvas.height)];
      setReady(true);
    };
    image.src = imageUrl;
    return () => {
      cancelled = true;
    };
  }, [imageUrl]);

  function remember() {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!context) return;
    historyRef.current = [
      ...historyRef.current,
      context.getImageData(0, 0, canvas.width, canvas.height)
    ].slice(-30);
  }

  function undo() {
    if (historyRef.current.length <= 1) return;
    historyRef.current.pop();
    canvasRef.current
      ?.getContext("2d")
      ?.putImageData(historyRef.current.at(-1), 0, 0);
  }

  function clear() {
    if (historyRef.current.length === 0) return;
    historyRef.current = [historyRef.current[0]];
    canvasRef.current?.getContext("2d")?.putImageData(historyRef.current[0], 0, 0);
  }

  function begin(event) {
    if (!ready || event.button !== 0) return;
    event.preventDefault();
    const canvas = canvasRef.current;
    const point = canvasPoint(event, canvas);
    interactionRef.current = {
      pointerId: event.pointerId,
      start: point,
      last: point,
      before: canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height)
    };
    canvas.setPointerCapture(event.pointerId);
  }

  function move(event) {
    const interaction = interactionRef.current;
    if (!interaction || interaction.pointerId !== event.pointerId) return;
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");
    const point = canvasPoint(event, canvas);
    context.lineCap = "round";
    context.lineJoin = "round";
    context.lineWidth = size;
    if (tool === "rectangle") {
      context.putImageData(interaction.before, 0, 0);
      context.globalCompositeOperation = "source-over";
      context.strokeStyle = color;
      context.strokeRect(
        interaction.start.x,
        interaction.start.y,
        point.x - interaction.start.x,
        point.y - interaction.start.y
      );
    } else {
      context.globalCompositeOperation = tool === "eraser" ? "destination-out" : "source-over";
      context.strokeStyle = color;
      context.beginPath();
      context.moveTo(interaction.last.x, interaction.last.y);
      context.lineTo(point.x, point.y);
      context.stroke();
      if (tool === "eraser" && baseCanvasRef.current) {
        context.globalCompositeOperation = "destination-over";
        context.drawImage(baseCanvasRef.current, 0, 0);
      }
      context.globalCompositeOperation = "source-over";
    }
    interaction.last = point;
  }

  function end(event) {
    const interaction = interactionRef.current;
    if (!interaction || interaction.pointerId !== event.pointerId) return;
    interactionRef.current = null;
    remember();
  }

  function save() {
    canvasRef.current?.toBlob(blob => {
      if (blob) onSave(blob);
    }, "image/png");
  }

  return (
    <div className="canvas-annotation-backdrop canvas-floating-ui" role="dialog" aria-modal="true">
      <section className="canvas-annotation-dialog">
        <header>
          <div>
            <strong>{copy.title}</strong>
            <span>{title}</span>
          </div>
          <button type="button" onClick={onCancel} aria-label={copy.cancel}><X /></button>
        </header>
        <div className="canvas-annotation-tools">
          <button className={tool === "brush" ? "active" : ""} type="button" onClick={() => setTool("brush")}><Paintbrush />{copy.brush}</button>
          <button className={tool === "rectangle" ? "active" : ""} type="button" onClick={() => setTool("rectangle")}><Square />{copy.rectangle}</button>
          <button className={tool === "eraser" ? "active" : ""} type="button" onClick={() => setTool("eraser")}><Eraser />{copy.eraser}</button>
          <i />
          <div className="canvas-annotation-colors">
            {COLORS.map(value => (
              <button
                key={value}
                className={color === value ? "active" : ""}
                type="button"
                style={{ "--annotation-color": value }}
                onClick={() => setColor(value)}
                aria-label={value}
              />
            ))}
          </div>
          <label>
            <input type="range" min="3" max="42" value={size} onChange={event => setSize(Number(event.target.value))} />
            <span>{size}px</span>
          </label>
          <button type="button" onClick={undo}><RotateCcw />{copy.undo}</button>
          <button type="button" onClick={clear}><Trash2 />{copy.clear}</button>
        </div>
        <div className="canvas-annotation-surface">
          <canvas
            ref={canvasRef}
            onPointerDown={begin}
            onPointerMove={move}
            onPointerUp={end}
            onPointerCancel={end}
          />
        </div>
        <footer>
          <p>{copy.hint}</p>
          <div>
            <Button type="button" variant="secondary" onClick={onCancel}>{copy.cancel}</Button>
            <Button type="button" disabled={!ready} onClick={save}>{copy.save}</Button>
          </div>
        </footer>
      </section>
    </div>
  );
}

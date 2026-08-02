import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowUp,
  Clock3,
  FileImage,
  Grid2X2,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
  X
} from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import {
  createCanvasProject,
  deleteCanvasProject,
  loadCanvasProjects,
  renameCanvasProject
} from "@/lib/canvas-db";

const projectCopy = {
  zh: {
    title: "欢迎来到 Image2 无限画布",
    titleAccent: "无限画布",
    subtitle: "从一个想法开始，或继续已有的创作项目。每个画布都会独立保存。",
    promptPlaceholder: "描述你的想法，创建画布后继续完善…",
    createFromPrompt: "创建并开始",
    quickStart: "快速开始",
    allProjects: "全部项目",
    newProject: "新建项目",
    search: "搜索画布项目",
    emptySearch: "没有找到匹配的画布",
    emptySearchCopy: "换个关键词，或者新建一个项目。",
    loading: "正在整理你的画布…",
    nodeCount: "{count} 个节点",
    emptyCanvas: "空画布",
    justNow: "刚刚修改",
    minutesAgo: "{count} 分钟前修改",
    hoursAgo: "{count} 小时前修改",
    daysAgo: "{count} 天前修改",
    rename: "重命名",
    saveRename: "保存名称",
    cancelRename: "取消重命名",
    delete: "删除项目",
    deleteTitle: "删除这个 Canvas？",
    deleteCopy: "画布中的节点、上传素材和布局都会从当前浏览器删除，经典生成历史不会受影响。",
    cancel: "取消",
    confirmDelete: "确认删除",
    loadFailed: "画布项目读取失败。",
    createFailed: "画布项目创建失败。",
    renameFailed: "画布项目重命名失败。",
    deleteFailed: "画布项目删除失败。",
    untitled: "未命名画布"
  },
  en: {
    title: "Welcome to Image2 Infinite Canvas",
    titleAccent: "Infinite Canvas",
    subtitle: "Start from an idea or continue an existing project. Every canvas is saved independently.",
    promptPlaceholder: "Describe an idea, then continue shaping it inside a new canvas…",
    createFromPrompt: "Create and start",
    quickStart: "Quick start",
    allProjects: "All projects",
    newProject: "New project",
    search: "Search canvas projects",
    emptySearch: "No matching canvases",
    emptySearchCopy: "Try another keyword or create a new project.",
    loading: "Loading your canvases…",
    nodeCount: "{count} nodes",
    emptyCanvas: "Empty canvas",
    justNow: "Edited just now",
    minutesAgo: "Edited {count} minutes ago",
    hoursAgo: "Edited {count} hours ago",
    daysAgo: "Edited {count} days ago",
    rename: "Rename",
    saveRename: "Save name",
    cancelRename: "Cancel rename",
    delete: "Delete project",
    deleteTitle: "Delete this Canvas?",
    deleteCopy: "Its nodes, uploads, and layout will be removed from this browser. Classic generation history is not affected.",
    cancel: "Cancel",
    confirmDelete: "Delete",
    loadFailed: "Canvas projects could not be loaded.",
    createFailed: "Canvas project could not be created.",
    renameFailed: "Canvas project could not be renamed.",
    deleteFailed: "Canvas project could not be deleted.",
    untitled: "Untitled canvas"
  }
};

function formatCopy(value, values = {}) {
  return Object.entries(values).reduce(
    (result, [key, replacement]) => result.replaceAll(`{${key}}`, String(replacement)),
    value
  );
}

function relativeUpdatedAt(value, copy) {
  const elapsed = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(elapsed) || elapsed < 60_000) {
    return copy.justNow;
  }
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 60) {
    return formatCopy(copy.minutesAgo, { count: minutes });
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return formatCopy(copy.hoursAgo, { count: hours });
  }
  return formatCopy(copy.daysAgo, { count: Math.floor(hours / 24) });
}

function ProjectCover({ project, historyImageMap }) {
  const [blobUrl, setBlobUrl] = useState("");

  useEffect(() => {
    if (project.cover?.type !== "blob" || !project.cover.blob) {
      setBlobUrl("");
      return undefined;
    }
    const nextUrl = URL.createObjectURL(project.cover.blob);
    setBlobUrl(nextUrl);
    return () => URL.revokeObjectURL(nextUrl);
  }, [project.cover]);

  const historyUrl = project.cover?.type === "history"
    ? historyImageMap.get(`${project.cover.taskId}:${project.cover.imageId}`)
    : "";
  const coverUrl = blobUrl || historyUrl;

  return coverUrl
    ? <img src={coverUrl} alt="" />
    : (
      <span className="canvas-project-cover-empty" aria-hidden="true">
        <FileImage />
      </span>
    );
}

function CanvasProjectsPage({ active, language = "zh", history = [], onOpenProject, onToast }) {
  const copy = projectCopy[language] || projectCopy.zh;
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [quickPrompt, setQuickPrompt] = useState("");
  const [query, setQuery] = useState("");
  const [menuId, setMenuId] = useState("");
  const [renamingId, setRenamingId] = useState("");
  const [renameValue, setRenameValue] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);

  const historyImageMap = useMemo(() => {
    const imageMap = new Map();
    history.forEach(task => {
      (task.images || []).forEach(image => {
        if (image.url) {
          imageMap.set(`${task.id}:${image.id}`, image.url);
        }
      });
    });
    return imageMap;
  }, [history]);

  const visibleProjects = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return normalizedQuery
      ? projects.filter(project => project.title.toLocaleLowerCase().includes(normalizedQuery))
      : projects;
  }, [projects, query]);

  useEffect(() => {
    if (!active) {
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    loadCanvasProjects()
      .then(nextProjects => {
        if (!cancelled) {
          setProjects(nextProjects);
        }
      })
      .catch(error => {
        console.error(error);
        onToast?.(copy.loadFailed);
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [active]);

  async function createProject(initialPrompt = "", { openAfterCreate = true } = {}) {
    if (creating) {
      return;
    }
    setCreating(true);
    try {
      const prompt = initialPrompt.trim();
      const project = await createCanvasProject({
        title: prompt ? prompt.slice(0, 28) : copy.untitled,
        initialPrompt: prompt
      });
      if (openAfterCreate) {
        onOpenProject(project.id);
        return;
      }
      setProjects(current => [
        { ...project, nodeCount: 0, cover: null },
        ...current
      ]);
    } catch (error) {
      console.error(error);
      onToast?.(copy.createFailed);
    } finally {
      setCreating(false);
    }
  }

  async function saveRename(project) {
    const title = renameValue.trim();
    if (!title) {
      setRenamingId("");
      return;
    }
    try {
      const updated = await renameCanvasProject(project.id, title);
      setProjects(current => current
        .map(item => item.id === updated.id ? { ...item, ...updated } : item)
        .sort((left, right) => new Date(right.updatedAt) - new Date(left.updatedAt)));
      setRenamingId("");
    } catch (error) {
      console.error(error);
      onToast?.(copy.renameFailed);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) {
      return;
    }
    try {
      await deleteCanvasProject(deleteTarget.id);
      setProjects(current => current.filter(project => project.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (error) {
      console.error(error);
      onToast?.(copy.deleteFailed);
    }
  }

  return (
    <section
      className={`canvas-projects-page${active ? " is-active" : " mode-hidden"}`}
      aria-label={copy.allProjects}
      onClick={() => setMenuId("")}
    >
      <div className="canvas-projects-hero">
        <span className="canvas-projects-hero-mark" aria-hidden="true"><Sparkles /></span>
        <h1>
          {copy.title.split(copy.titleAccent)[0]}
          <em>{copy.titleAccent}</em>
          {copy.title.split(copy.titleAccent)[1]}
        </h1>
        <p>{copy.subtitle}</p>
        <form className="canvas-projects-prompt" onSubmit={event => {
          event.preventDefault();
          if (quickPrompt.trim()) {
            createProject(quickPrompt);
          }
        }}>
          <textarea
            value={quickPrompt}
            onChange={event => setQuickPrompt(event.target.value)}
            placeholder={copy.promptPlaceholder}
            aria-label={copy.promptPlaceholder}
          />
          <div>
            <span><Sparkles /> Image2</span>
            <button type="submit" disabled={!quickPrompt.trim() || creating} aria-label={copy.createFromPrompt} title={copy.createFromPrompt}>
              <ArrowUp />
            </button>
          </div>
        </form>
      </div>

      <div className="canvas-projects-section">
        <header className="canvas-projects-section-header">
          <div>
            <span>{copy.quickStart}</span>
            <strong>{copy.allProjects}</strong>
          </div>
          <label className="canvas-project-search">
            <Search />
            <input value={query} onChange={event => setQuery(event.target.value)} placeholder={copy.search} />
            {query ? <button type="button" onClick={() => setQuery("")} aria-label={copy.cancel}><X /></button> : null}
          </label>
        </header>

        {loading ? (
          <div className="canvas-projects-loading"><Sparkles /><span>{copy.loading}</span></div>
        ) : (
          <div className="canvas-project-grid">
            {!query ? (
              <button className="canvas-project-new-card" type="button" onClick={() => createProject("", { openAfterCreate: false })} disabled={creating}>
                <span><Plus /></span>
                <strong>{copy.newProject}</strong>
              </button>
            ) : null}

            {visibleProjects.map(project => (
              <article className="canvas-project-card" key={project.id}>
                <button className="canvas-project-card-open" type="button" onClick={() => onOpenProject(project.id)} aria-label={project.title}>
                  <span className="canvas-project-cover">
                    <ProjectCover project={project} historyImageMap={historyImageMap} />
                    <i><Grid2X2 /> {project.nodeCount ? formatCopy(copy.nodeCount, { count: project.nodeCount }) : copy.emptyCanvas}</i>
                  </span>
                </button>
                <div className="canvas-project-card-copy">
                  {renamingId === project.id ? (
                    <input
                      autoFocus
                      value={renameValue}
                      onChange={event => setRenameValue(event.target.value)}
                      onBlur={() => saveRename(project)}
                      onKeyDown={event => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          saveRename(project);
                        } else if (event.key === "Escape") {
                          setRenamingId("");
                        }
                      }}
                      aria-label={copy.rename}
                    />
                  ) : <strong title={project.title}>{project.title}</strong>}
                  <small><Clock3 /> {relativeUpdatedAt(project.updatedAt, copy)}</small>
                </div>
                <button
                  className="canvas-project-more"
                  type="button"
                  aria-label={`${project.title} · ${copy.rename}`}
                  aria-expanded={menuId === project.id}
                  onClick={event => {
                    event.stopPropagation();
                    setMenuId(current => current === project.id ? "" : project.id);
                  }}
                >
                  <MoreHorizontal />
                </button>
                {menuId === project.id ? (
                  <div className="canvas-project-menu" onClick={event => event.stopPropagation()}>
                    <button type="button" onClick={() => {
                      setRenameValue(project.title);
                      setRenamingId(project.id);
                      setMenuId("");
                    }}><Pencil /><span>{copy.rename}</span></button>
                    <button className="is-danger" type="button" onClick={() => {
                      setDeleteTarget(project);
                      setMenuId("");
                    }}><Trash2 /><span>{copy.delete}</span></button>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        )}

        {!loading && query && visibleProjects.length === 0 ? (
          <div className="canvas-projects-empty-search">
            <Search />
            <strong>{copy.emptySearch}</strong>
            <span>{copy.emptySearchCopy}</span>
          </div>
        ) : null}
      </div>

      <Dialog open={Boolean(deleteTarget)} onOpenChange={open => !open && setDeleteTarget(null)}>
        <DialogContent className="canvas-project-delete-dialog">
          <DialogHeader>
            <DialogTitle>{copy.deleteTitle}</DialogTitle>
            <DialogDescription>{copy.deleteCopy}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild><button type="button">{copy.cancel}</button></DialogClose>
            <button className="is-danger" type="button" onClick={confirmDelete}>{copy.confirmDelete}</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

export default CanvasProjectsPage;

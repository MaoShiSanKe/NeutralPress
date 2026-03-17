export interface EditorConfig {
  [key: string]: unknown;
}

export interface EditorContent {
  [key: string]: {
    content: string;
    lastUpdatedAt: string;
    config: EditorConfig;
  };
}

const STORAGE_KEY = "editor";
const pendingEditorContent = new Map<
  string,
  { content: string; config: EditorConfig }
>();
const pendingEditorTimers = new Map<string, ReturnType<typeof setTimeout>>();

function persistEditorContent(
  content: string,
  config: EditorConfig = {},
  key: string = "new",
): void {
  const existingData = loadAllEditorContent() || {};

  existingData[key] = {
    content,
    lastUpdatedAt: new Date().toISOString(),
    config,
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(existingData));
}

/**
 * 保存编辑器内容到localStorage
 * @param content - 要保存的 Markdown 内容
 * @param config - 编辑器配置
 * @param isMarkdown - 保留参数以保持向后兼容（现在总是为 true）
 * @param key - 存储的键名,默认为"new"
 */
export function saveEditorContent(
  content: string,
  config: EditorConfig = {},
  _isMarkdown: boolean = true,
  key: string = "new",
): void {
  // 检查是否在浏览器环境
  if (typeof window === "undefined") return;

  try {
    const timer = pendingEditorTimers.get(key);
    if (timer) {
      clearTimeout(timer);
      pendingEditorTimers.delete(key);
    }
    pendingEditorContent.delete(key);
    persistEditorContent(content, config, key);
  } catch (error) {
    console.error("Failed to save editor content:", error);
  }
}

/**
 * 调度保存编辑器内容到 localStorage
 * @param content - 要保存的 Markdown 内容
 * @param config - 编辑器配置
 * @param key - 存储的键名,默认为"new"
 * @param delayMs - 防抖延迟，默认 5000ms
 */
export function scheduleEditorContentSave(
  content: string,
  config: EditorConfig = {},
  key: string = "new",
  delayMs: number = 5000,
): void {
  if (typeof window === "undefined") return;

  pendingEditorContent.set(key, {
    content,
    config,
  });

  const existingTimer = pendingEditorTimers.get(key);
  if (existingTimer) {
    clearTimeout(existingTimer);
  }

  const timer = setTimeout(() => {
    flushEditorContentSave(key);
  }, delayMs);

  pendingEditorTimers.set(key, timer);
}

/**
 * 立即刷新待保存的编辑器内容到 localStorage
 * @param key - 要刷新的键名；不传则刷新全部
 */
export function flushEditorContentSave(key?: string): void {
  if (typeof window === "undefined") return;

  const flushOne = (targetKey: string) => {
    const pending = pendingEditorContent.get(targetKey);
    const timer = pendingEditorTimers.get(targetKey);

    if (timer) {
      clearTimeout(timer);
      pendingEditorTimers.delete(targetKey);
    }

    if (!pending) return;

    persistEditorContent(pending.content, pending.config, targetKey);
    pendingEditorContent.delete(targetKey);
  };

  if (key) {
    flushOne(key);
    return;
  }

  Array.from(pendingEditorContent.keys()).forEach(flushOne);
}

/**
 * 从localStorage读取指定键的编辑器内容
 * @param key - 要读取的键名,默认为"new"
 */
export function loadEditorContent(
  key: string = "new",
): EditorContent[string] | null {
  // 检查是否在浏览器环境
  if (typeof window === "undefined") return null;

  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return null;
    const allContent = JSON.parse(data) as EditorContent;
    return allContent[key] || null;
  } catch (error) {
    console.error("Failed to load editor content:", error);
    return null;
  }
}

/**
 * 从localStorage读取所有编辑器内容
 */
export function loadAllEditorContent(): EditorContent | null {
  // 检查是否在浏览器环境
  if (typeof window === "undefined") return null;

  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return null;
    return JSON.parse(data) as EditorContent;
  } catch (error) {
    console.error("Failed to load all editor content:", error);
    return null;
  }
}

/**
 * 清除localStorage中指定键的编辑器内容
 * @param key - 要清除的键名,如果不提供则清除所有内容
 */
export function clearEditorContent(key?: string): void {
  // 检查是否在浏览器环境
  if (typeof window === "undefined") return;

  try {
    if (!key) {
      flushEditorContentSave();
      pendingEditorContent.clear();
      pendingEditorTimers.forEach((timer) => clearTimeout(timer));
      pendingEditorTimers.clear();
      localStorage.removeItem(STORAGE_KEY);
      return;
    }

    const timer = pendingEditorTimers.get(key);
    if (timer) {
      clearTimeout(timer);
      pendingEditorTimers.delete(key);
    }
    pendingEditorContent.delete(key);

    const data = loadAllEditorContent();
    if (data && data[key]) {
      delete data[key];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }
  } catch (error) {
    console.error("Failed to clear editor content:", error);
  }
}

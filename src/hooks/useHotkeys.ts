import { useEffect } from "react";

export const HOTKEYS: Array<{ keys: string; label: string }> = [
  { keys: "/", label: "打开全局搜索" },
  { keys: "1", label: "切换到现货" },
  { keys: "2", label: "切换到 U 本位永续" },
  { keys: "3", label: "切换到 Alpha" },
  { keys: "M", label: "打开 Markets" },
  { keys: "R", label: "打开异动雷达" },
  { keys: "C", label: "打开 K 线工作区" },
  { keys: "W", label: "打开自选工作台" },
  { keys: "F", label: "收藏 / 取消收藏当前交易对" },
  { keys: "?", label: "查看快捷键说明" },
  { keys: "Esc", label: "关闭弹层 / 取消搜索" },
];

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (target.isContentEditable) return true;
  return false;
}

/**
 * Global shortcuts.
 *
 * Any key pressed inside an input, textarea or contenteditable is ignored, so
 * typing a symbol into the search box never navigates away mid-word.
 */
export function useHotkeys(map: Record<string, (event: KeyboardEvent) => void>): void {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) {
        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
          const action = map["/"];
          if (action) {
            event.preventDefault();
            action(event);
          }
        }
        return;
      }
      const active = document.activeElement;
      const inField = isTypingTarget(event.target) || isTypingTarget(active);
      if (event.key === "Escape") {
        const escape = map.escape ?? map.Escape;
        if (escape) {
          escape(event);
          return;
        }
      }
      if (inField) return;
      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key.toLowerCase();
      const action = map[key];
      if (!action) return;
      event.preventDefault();
      action(event);
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [map]);
}

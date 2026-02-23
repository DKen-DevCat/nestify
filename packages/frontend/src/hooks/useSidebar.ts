import { useState, useEffect, useCallback, useRef } from "react";
import type React from "react";

const MIN_WIDTH = 180;
const MAX_WIDTH = 400;
const DEFAULT_WIDTH = 256;
const STORAGE_WIDTH_KEY = "nestify_sidebar_width";
const STORAGE_OPEN_KEY = "nestify_sidebar_open";

export function useSidebar(): {
  isOpen: boolean;
  width: number;
  toggle: () => void;
  startResize: (e: React.MouseEvent) => void;
  isResizing: boolean;
} {
  const [isOpen, setIsOpen] = useState(true);
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [isResizing, setIsResizing] = useState(false);

  // ドラッグ中にクロージャが古い width を参照しないよう ref で保持
  const widthRef = useRef(width);
  widthRef.current = width;

  // SSR 安全: クライアントマウント後に localStorage を読む
  useEffect(() => {
    const savedWidth = localStorage.getItem(STORAGE_WIDTH_KEY);
    const savedOpen = localStorage.getItem(STORAGE_OPEN_KEY);

    if (savedWidth !== null) {
      const parsed = Number(savedWidth);
      if (!isNaN(parsed)) {
        const clamped = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, parsed));
        setWidth(clamped);
        widthRef.current = clamped;
      }
    }

    if (savedOpen !== null) {
      setIsOpen(savedOpen === "true");
    }
  }, []);

  const toggle = useCallback(() => {
    setIsOpen((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_OPEN_KEY, String(next));
      return next;
    });
  }, []);

  const startResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = widthRef.current;

    const onMouseMove = (ev: MouseEvent): void => {
      const newWidth = Math.min(
        MAX_WIDTH,
        Math.max(MIN_WIDTH, startWidth + (ev.clientX - startX)),
      );
      setWidth(newWidth);
      widthRef.current = newWidth;
    };

    const onMouseUp = (ev: MouseEvent): void => {
      const finalWidth = Math.min(
        MAX_WIDTH,
        Math.max(MIN_WIDTH, startWidth + (ev.clientX - startX)),
      );
      setWidth(finalWidth);
      widthRef.current = finalWidth;
      localStorage.setItem(STORAGE_WIDTH_KEY, String(finalWidth));
      setIsResizing(false);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };

    setIsResizing(true);
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }, []);

  return { isOpen, width, toggle, startResize, isResizing };
}

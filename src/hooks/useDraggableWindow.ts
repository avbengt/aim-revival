"use client";

import { useEffect, useRef } from "react";

type Options = {
    headerSelector?: string;      // e.g. ".login-header"
    disabled?: boolean;           // disable when window is hidden
    storageKey?: string;          // persist {top,left}
    centerOnFirstPaint?: boolean; // center if no saved position
};

export function useDraggableWindow(
    winRef: React.RefObject<HTMLElement>,
    {
        headerSelector,
        disabled = false,
        storageKey,
        centerOnFirstPaint = true,
    }: Options = {}
) {
    const centeredOnce = useRef(false);

    useEffect(() => {
        const winEl = winRef.current;
        if (!winEl || disabled) return;

        // Ensure positioning is absolute and numeric top/left exist
        const cs = getComputedStyle(winEl);
        if (cs.position === "static") winEl.style.position = "absolute";

        const ensureTopLeft = () => {
            if (!winEl.style.left) winEl.style.left = `${winEl.offsetLeft}px`;
            if (!winEl.style.top) winEl.style.top = `${winEl.offsetTop}px`;
        };

        // Restore saved pos or center once
        const restoreOrCenter = () => {
            if (storageKey) {
                const raw = localStorage.getItem(storageKey);
                if (raw) {
                    try {
                        const { top, left } = JSON.parse(raw);
                        winEl.style.top = `${top}px`;
                        winEl.style.left = `${left}px`;
                        return;
                    } catch (_e: unknown) {
                        /* ignore */
                    }
                }
            }
            if (!centeredOnce.current && centerOnFirstPaint) {
                const rect = winEl.getBoundingClientRect();
                const vw = window.innerWidth;
                const vh = window.innerHeight;
                const top = Math.max(0, Math.floor((vh - rect.height) / 2));
                const left = Math.max(0, Math.floor((vw - rect.width) / 2));
                winEl.style.top = `${top}px`;
                winEl.style.left = `${left}px`;
                centeredOnce.current = true;
            }
        };

        restoreOrCenter();
        ensureTopLeft();

        const header = headerSelector
            ? (winEl.querySelector(headerSelector) as HTMLElement | null)
            : (winEl as HTMLElement);

        if (!header) return;

        // Make it clearly draggable + allow pointer events to fire on touch
        header.style.cursor = "move";
        header.style.touchAction = "none";
        header.style.userSelect = "none";

        let dragging = false;
        let startX = 0, startY = 0, startLeft = 0, startTop = 0;

        const clampAndApply = (nextLeft: number, nextTop: number) => {
            const rect = winEl.getBoundingClientRect();
            const maxLeft = Math.max(0, window.innerWidth - rect.width);
            const maxTop = Math.max(0, window.innerHeight - rect.height);
            winEl.style.left = `${Math.min(Math.max(0, nextLeft), maxLeft)}px`;
            winEl.style.top = `${Math.min(Math.max(0, nextTop), maxTop)}px`;
        };

        // --- Pointer Events (preferred) ---
        const onPointerDown = (e: PointerEvent) => {
            if (e.button !== 0) return; // left click only
            dragging = true;
            try { header.setPointerCapture(e.pointerId); } catch { }
            startLeft = parseInt(winEl.style.left || "0", 10);
            startTop = parseInt(winEl.style.top || "0", 10);
            startX = e.clientX;
            startY = e.clientY;
        };

        const onPointerMove = (e: PointerEvent) => {
            if (!dragging) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            clampAndApply(startLeft + dx, startTop + dy);
        };

        const onPointerUp = (e: PointerEvent) => {
            if (!dragging) return;
            dragging = false;
            header.releasePointerCapture(e.pointerId);

            if (storageKey) {
                const top = parseInt(el.style.top || "0", 10);
                const left = parseInt(el.style.left || "0", 10);
                localStorage.setItem(storageKey, JSON.stringify({ top, left }));
            }
        };

        // --- Mouse fallback (older Safari, etc.) ---
        const onMouseDown = (e: MouseEvent) => {
            if ((e as any).pointerType) return; // pointer already handled
            if (e.button !== 0) return;
            dragging = true;
            startLeft = parseInt(winEl.style.left || "0", 10);
            startTop = parseInt(winEl.style.top || "0", 10);
            startX = e.clientX;
            startY = e.clientY;
            // prevent text selection while dragging
            e.preventDefault();
        };

        const onMouseMove = (e: MouseEvent) => {
            if (!dragging) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            clampAndApply(startLeft + dx, startTop + dy);
        };

        const onMouseUp = () => {
            if (!dragging) return;
            dragging = false;
            if (storageKey) {
                localStorage.setItem(
                    storageKey,
                    JSON.stringify({
                        top: parseInt(winEl.style.top || "0", 10),
                        left: parseInt(winEl.style.left || "0", 10),
                    })
                );
            }
        };

        header.addEventListener("pointerdown", onPointerDown);
        window.addEventListener("pointermove", onPointerMove);
        window.addEventListener("pointerup", onPointerUp);

        header.addEventListener("mousedown", onMouseDown);
        window.addEventListener("mousemove", onMouseMove);
        window.addEventListener("mouseup", onMouseUp);

        return () => {
            header.removeEventListener("pointerdown", onPointerDown);
            window.removeEventListener("pointermove", onPointerMove);
            window.removeEventListener("pointerup", onPointerUp);

            header.removeEventListener("mousedown", onMouseDown);
            window.removeEventListener("mousemove", onMouseMove);
            window.removeEventListener("mouseup", onMouseUp);
        };
    }, [winRef, headerSelector, disabled, storageKey, centerOnFirstPaint]);
}
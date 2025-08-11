"use client";

import { useEffect, useRef } from "react";

export function useDraggableWindow(
    winRef,
    {
        headerSelector,
        disabled = false,
        storageKey,
        centerOnFirstPaint = true,
    } = {}
) {
    const startedOnce = useRef(false);

    useEffect(() => {
        const el = winRef.current;
        if (!el || disabled) return;

        const style = window.getComputedStyle(el);
        if (style.position === "static") el.style.position = "absolute";

        const restore = () => {
            if (storageKey) {
                const raw = localStorage.getItem(storageKey);
                if (raw) {
                    try {
                        const parsed = JSON.parse(raw);
                        if (
                            parsed &&
                            typeof parsed.top === "number" &&
                            typeof parsed.left === "number"
                        ) {
                            el.style.top = `${parsed.top}px`;
                            el.style.left = `${parsed.left}px`;
                            return;
                        }
                    } catch { }
                }
            }
            if (!startedOnce.current && centerOnFirstPaint) {
                const vw = window.innerWidth;
                const vh = window.innerHeight;
                const rect = el.getBoundingClientRect();
                el.style.top = `${Math.max(0, Math.floor((vh - rect.height) / 2))}px`;
                el.style.left = `${Math.max(0, Math.floor((vw - rect.width) / 2))}px`;
                startedOnce.current = true;
            } else {
                if (!el.style.top) el.style.top = "0px";
                if (!el.style.left) el.style.left = "0px";
            }
        };
        restore();

        const header = headerSelector ? el.querySelector(headerSelector) : el;
        if (!header) return;

        let startX = 0;
        let startY = 0;
        let startLeft = 0;
        let startTop = 0;
        let dragging = false;

        const onPointerDown = (e) => {
            if (e.button !== 0) return;
            dragging = true;
            header.setPointerCapture(e.pointerId);

            startLeft = parseInt(el.style.left || "0", 10);
            startTop = parseInt(el.style.top || "0", 10);
            startX = e.clientX;
            startY = e.clientY;
        };

        const onPointerMove = (e) => {
            if (!dragging) return;

            const dx = e.clientX - startX;
            const dy = e.clientY - startY;

            const nextLeft = startLeft + dx;
            const nextTop = startTop + dy;

            const vw = window.innerWidth;
            const vh = window.innerHeight;
            const rect = el.getBoundingClientRect();
            const maxLeft = vw - rect.width;
            const maxTop = vh - rect.height;

            el.style.left = `${Math.min(Math.max(0, nextLeft), Math.max(0, maxLeft))}px`;
            el.style.top = `${Math.min(Math.max(0, nextTop), Math.max(0, maxTop))}px`;
        };

        const onPointerUp = (e) => {
            if (!dragging) return;
            dragging = false;
            header.releasePointerCapture(e.pointerId);

            if (storageKey) {
                const top = parseInt(el.style.top || "0", 10);
                const left = parseInt(el.style.left || "0", 10);
                localStorage.setItem(storageKey, JSON.stringify({ top, left }));
            }
        };

        header.addEventListener("pointerdown", onPointerDown);
        window.addEventListener("pointermove", onPointerMove);
        window.addEventListener("pointerup", onPointerUp);

        return () => {
            header.removeEventListener("pointerdown", onPointerDown);
            window.removeEventListener("pointermove", onPointerMove);
            window.removeEventListener("pointerup", onPointerUp);
        };
    }, [winRef, headerSelector, disabled, storageKey, centerOnFirstPaint]);
}
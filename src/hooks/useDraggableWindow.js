"use client";
import { useEffect, useRef } from "react";

export function useDraggableWindow(
    winRef,
    { headerSelector, storageKey, centerOnFirstPaint = true, alwaysCenter = false } = {}
) {
    const centeredOnce = useRef(false);

    useEffect(() => {
        const el = winRef.current;
        if (!el) return;

        // Reset centered flag when element is remounted
        centeredOnce.current = false;

        // Always use absolute positioning and kill conflicting sides/shorthand
        const clearConflicts = () => {
            // Store current positioning before clearing conflicts
            const currentLeft = el.style.left;
            const currentTop = el.style.top;

            el.style.position = "absolute";
            el.style.removeProperty("inset");
            el.style.right = "auto";
            el.style.bottom = "auto";
            el.style.removeProperty("transform");

            // Restore positioning if it was set
            if (currentLeft) el.style.left = currentLeft;
            if (currentTop) el.style.top = currentTop;
        };

        const clampToViewport = (left, top) => {
            // Allow unlimited dragging - no boundaries
            return {
                left: left,
                top: top,
            };
        };

        // Restore/center with clamping
        const restore = () => {
            clearConflicts();

            let restored = false;
            if (storageKey && !alwaysCenter) {
                try {
                    const raw = localStorage.getItem(storageKey);
                    if (raw) {
                        const { top, left } = JSON.parse(raw);
                        if (typeof top === "number" && typeof left === "number") {
                            const { left: L, top: T } = clampToViewport(left, top);
                            el.style.left = `${L}px`;
                            el.style.top = `${T}px`;
                            restored = true;
                        }
                    }
                } catch { }
            }

            // Center only once if nothing restored
            if (!restored && centerOnFirstPaint && !centeredOnce.current) {
                // Convert transform-based centering to absolute positioning
                const computedStyle = window.getComputedStyle(el);
                if (computedStyle.transform !== "none" && computedStyle.transform !== "") {
                    // Element is using transform centering, convert to absolute positioning
                    const rect = el.getBoundingClientRect();
                    const vw = window.innerWidth;
                    const vh = window.innerHeight;
                    const L = Math.max(0, Math.floor((vw - rect.width) / 2));
                    const T = Math.max(0, Math.floor((vh - rect.height) / 2));
                    el.style.left = `${L}px`;
                    el.style.top = `${T}px`;
                    el.style.transform = "none";
                } else {
                    // Element is already using absolute positioning, just center it
                    const rect = el.getBoundingClientRect();
                    const vw = window.innerWidth;
                    const vh = window.innerHeight;
                    const L = Math.max(0, Math.floor((vw - rect.width) / 2));
                    const T = Math.max(0, Math.floor((vh - rect.height) / 2));
                    el.style.left = `${L}px`;
                    el.style.top = `${T}px`;
                }
                centeredOnce.current = true;
            }

            // Ensure numeric fallback
            if (!el.style.top) el.style.top = "0px";
            if (!el.style.left) el.style.left = "0px";
        };

        restore();

        // Use setTimeout to ensure DOM is fully ready
        setTimeout(() => {
            const header = headerSelector ? el.querySelector(headerSelector) : el;
            if (!header) {
                console.log("useDraggableWindow: Header not found after delay");
                return;
            }

            console.log("useDraggableWindow: Header found, attaching listeners");

            header.style.touchAction = "none";
            header.style.userSelect = "none";

            let startX = 0,
                startY = 0,
                startLeft = 0,
                startTop = 0,
                dragging = false;

            const isInControls = (target) => {
                if (!target) return false;
                return target.closest?.(".title-bar-controls") ||
                    target.closest?.("button") ||
                    target.tagName === "BUTTON";
            };

            // --- Pointer API (no pointer capture; listen on window) ---
            const onPointerDown = (e) => {
                console.log("useDraggableWindow: Pointer down event triggered");
                if (e.button !== 0) return;
                if (isInControls(e.target)) {
                    console.log("useDraggableWindow: Clicked on controls, ignoring");
                    return;
                }
                console.log("useDraggableWindow: Starting drag");
                dragging = true;
                clearConflicts();
                startLeft = parseInt(el.style.left || "0", 10);
                startTop = parseInt(el.style.top || "0", 10);
                startX = e.clientX;
                startY = e.clientY;
            };

            const onPointerMove = (e) => {
                if (!dragging) return;
                const dx = e.clientX - startX;
                const dy = e.clientY - startY;
                const { left, top } = clampToViewport(startLeft + dx, startTop + dy);
                el.style.left = `${left}px`;
                el.style.top = `${top}px`;
            };

            const onPointerUp = () => {
                if (!dragging) return;
                dragging = false;
                if (storageKey) {
                    localStorage.setItem(
                        storageKey,
                        JSON.stringify({
                            top: parseInt(el.style.top || "0", 10),
                            left: parseInt(el.style.left || "0", 10),
                        })
                    );
                }
            };

            // --- Mouse fallback (older Safari) ---
            const onMouseDown = (e) => {
                if (e.button !== 0) return;
                if (isInControls(e.target)) return;
                dragging = true;
                clearConflicts();
                startLeft = parseInt(el.style.left || "0", 10);
                startTop = parseInt(el.style.top || "0", 10);
                startX = e.clientX;
                startY = e.clientY;
                window.addEventListener("mousemove", onMouseMove);
                window.addEventListener("mouseup", onMouseUp);
            };

            const onMouseMove = (e) => {
                if (!dragging) return;
                const dx = e.clientX - startX;
                const dy = e.clientY - startY;
                const { left, top } = clampToViewport(startLeft + dx, startTop + dy);
                el.style.left = `${left}px`;
                el.style.top = `${top}px`;
            };

            const onMouseUp = () => {
                if (!dragging) return;
                dragging = false;
                window.removeEventListener("mousemove", onMouseMove);
                window.removeEventListener("mouseup", onMouseUp);
                if (storageKey) {
                    localStorage.setItem(
                        storageKey,
                        JSON.stringify({
                            top: parseInt(el.style.top || "0", 10),
                            left: parseInt(el.style.left || "0", 10),
                        })
                    );
                }
            };

            header.addEventListener("pointerdown", onPointerDown);
            window.addEventListener("pointermove", onPointerMove);
            window.addEventListener("pointerup", onPointerUp);
            header.addEventListener("mousedown", onMouseDown);

            // Re‑clamp if viewport changes (e.g., rotate phone)
            const onResize = () => {
                const left = parseInt(el.style.left || "0", 10);
                const top = parseInt(el.style.top || "0", 10);
                const { left: L, top: T } = clampToViewport(left, top);
                el.style.left = `${L}px`;
                el.style.top = `${T}px`;
            };
            window.addEventListener("resize", onResize);

            return () => {
                // Reset dragging state
                dragging = false;

                header.removeEventListener("pointerdown", onPointerDown);
                window.removeEventListener("pointermove", onPointerMove);
                window.removeEventListener("pointerup", onPointerUp);
                header.removeEventListener("mousedown", onMouseDown);
                window.removeEventListener("mousemove", onMouseMove);
                window.removeEventListener("mouseup", onMouseUp);
                window.removeEventListener("resize", onResize);
            };
        }, 0); // Close setTimeout
    }, [winRef, headerSelector, storageKey, centerOnFirstPaint, alwaysCenter]);
}
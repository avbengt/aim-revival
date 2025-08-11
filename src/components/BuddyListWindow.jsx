"use client";
/* eslint-disable @next/next/no-img-element */
import { useRef } from "react";
import { useDraggableWindow } from "@/hooks/useDraggableWindow";
import { useWindowManager } from "@/context/WindowManagerContext";

export default function BuddyListWindow() {
    const { buddyListVisible, setBuddyListVisible } = useWindowManager();
    const winRef = useRef(null);

    useDraggableWindow(winRef, {
        headerSelector: ".buddylist-header",
        disabled: !buddyListVisible,
        storageKey: "pos_buddylist_window",
        centerOnFirstPaint: true,
    });

    if (!buddyListVisible) return null;

    return (
        <div ref={winRef} id="buddylist-window" className="window w-[280px] h-[520px] absolute">
            <div className="title-bar buddylist-header">
                <div className="title-bar-text">Buddy List</div>
                <div className="title-bar-controls">
                    <button aria-label="Minimize" onClick={() => setBuddyListVisible(false)} />
                    <button aria-label="Maximize" />
                    <button aria-label="Close" />
                </div>
            </div>

            <div className="window-body p-2">
                {/* TODO: real buddy list */}
                <p className="text-sm">Coming soon: buddies grouped like AIM 5.0 🙂</p>
            </div>
        </div>
    );
}
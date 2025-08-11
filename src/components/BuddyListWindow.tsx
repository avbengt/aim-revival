"use client";
import { useRef } from "react";
import { useDraggableWindow } from "@/hooks/useDraggableWindow";
import { useWindowManager } from "@context/WindowManagerContext";

export default function BuddyListWindow() {
    const { buddyListVisible, setBuddyListVisible } = useWindowManager();
    const winRef = useRef<HTMLDivElement>(null);

    useDraggableWindow(winRef, {
        headerSelector: ".buddylist-header",
        disabled: !buddyListVisible,
        storageKey: "pos_buddylist_window",
        centerOnFirstPaint: true,
    });

    return buddyListVisible ? (
        <div
            ref={winRef}
            id="buddylist-window"
            className="window w-[280px] h-[520px] absolute z-50"
        >
            <div className="title-bar buddylist-header">
                <div className="title-bar-text">Buddy List</div>
                <div className="title-bar-controls">
                    <button aria-label="Minimize" onClick={() => setBuddyListVisible(false)} />
                    <button aria-label="Maximize" />
                    <button aria-label="Close" />
                </div>
            </div>

            <div className="window-body p-2">
                {/* your real buddy list content goes here */}
                <p className="text-sm">Coming soon: buddies!</p>
            </div>
        </div>
    ) : null;
}
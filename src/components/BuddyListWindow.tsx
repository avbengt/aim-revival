"use client";

import { useEffect } from "react";
import { useWindowManager } from "@context/WindowManagerContext";


export default function BuddyListWindow() {
    const { setBuddyListVisible } = useWindowManager();


    useEffect(() => {
        const buddyEl = document.getElementById("buddylist-window");
        const header = document.getElementById("buddylist-header");

        if (!buddyEl || !header) return;

        let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;

        const dragMouseDown = (e: MouseEvent) => {
            e.preventDefault();
            pos3 = e.clientX;
            pos4 = e.clientY;
            document.addEventListener("mouseup", closeDragElement);
            document.addEventListener("mousemove", elementDrag);
        };

        const elementDrag = (e: MouseEvent) => {
            e.preventDefault();
            pos1 = pos3 - e.clientX;
            pos2 = pos4 - e.clientY;
            pos3 = e.clientX;
            pos4 = e.clientY;

            const newTop = buddyEl.offsetTop - pos2;
            const newLeft = buddyEl.offsetLeft - pos1;

            const winWidth = buddyEl.offsetWidth;
            const winHeight = buddyEl.offsetHeight;
            const screenWidth = window.innerWidth;
            const screenHeight = window.innerHeight;

            const clampedTop = Math.max(0, Math.min(newTop, screenHeight - winHeight));
            const clampedLeft = Math.max(0, Math.min(newLeft, screenWidth - winWidth));

            buddyEl.style.top = `${clampedTop}px`;
            buddyEl.style.left = `${clampedLeft}px`;
        };

        const closeDragElement = () => {
            document.removeEventListener("mouseup", closeDragElement);
            document.removeEventListener("mousemove", elementDrag);
        };

        header.addEventListener("mousedown", dragMouseDown);
        return () => header.removeEventListener("mousedown", dragMouseDown);
    }, []);

    return (
        <div id="buddylist-window" className="window buddylist-window w-[300px] h-[500px] absolute top-[100px] left-[100px]">
            <div id="buddylist-header" className="title-bar">
                <div className="title-bar-text">Buddy List</div>
                <div className="title-bar-controls">
                    <button aria-label="Minimize" onClick={() => setBuddyListVisible(false)}></button>
                    <button aria-label="Maximize"></button>
                    <button onClick={() => setBuddyListVisible(false)} aria-label="Close"></button>
                </div>
            </div>
            <div className="window-body">
                <p>Welcome to AIM Revival!</p>
            </div>
        </div>
    );
}
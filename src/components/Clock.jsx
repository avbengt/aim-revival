"use client";
import { useEffect, useState, useRef } from "react";
import { useSoundVolume } from "@/context/SoundVolumeContext";

const TIME_OPTIONS = { hour: "numeric", minute: "2-digit" };

export default function Clock() {
    const [time, setTime] = useState(() =>
        new Date().toLocaleTimeString([], TIME_OPTIONS)
    );
    const [showVolume, setShowVolume] = useState(false);
    const volumePopoverRef = useRef(null);

    const { volume, setVolume } = useSoundVolume();

    useEffect(() => {
        const interval = setInterval(
            () => setTime(new Date().toLocaleTimeString([], TIME_OPTIONS)),
            1000
        );
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (!showVolume) return;
        const onDocClick = (e) => {
            if (volumePopoverRef.current && !volumePopoverRef.current.contains(e.target)) {
                setShowVolume(false);
            }
        };
        document.addEventListener("click", onDocClick);
        return () => document.removeEventListener("click", onDocClick);
    }, [showVolume]);

    return (
        <div className="system-tray relative">
            <div className="clock text-white px-3 py-1 ">
                <img src="/login/running-man.svg" className="h-[17px] mr-[3px] inline-block drop-shadow-xs/30" />
                <img src="/layout/icons/icon-security.png" className="h-[17px] mr-[3px] inline-block drop-shadow-xs/30" />
                <span
                    role="button"
                    tabIndex={0}
                    className="mr-[8px] inline-block cursor-pointer"
                    onClick={(e) => {
                        e.stopPropagation();
                        setShowVolume((v) => !v);
                    }}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setShowVolume((v) => !v);
                        }
                    }}
                    aria-label="Volume"
                >
                    <img src="/layout/icons/icon-volume.png" className="h-[17px] w-[17px] inline-block drop-shadow-sm/30" alt="" />
                </span>
                <span suppressHydrationWarning>{time}</span>
            </div>

            {showVolume && (
                <div
                    ref={volumePopoverRef}
                    className="absolute right-0 bottom-full mb-1 bg-[#d4d0c8] border border-[#808080] border-t-[#ffffff] border-l-[#ffffff] p-3 min-w-[140px] pixelated-font text-sm z-[9999] [text-shadow:none]"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="text-black font-bold mb-2">Volume</div>
                    <div className="flex items-center gap-2">
                        <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.05"
                            value={volume}
                            onChange={(e) => setVolume(parseFloat(e.target.value, 10))}
                            className="w-24 h-2 accent-[#0a246a] cursor-pointer"
                        />
                        <span className="text-black text-xs w-8">{Math.round(volume * 100)}%</span>
                    </div>
                </div>
            )}
        </div>
    );
}
"use client";
import { useEffect, useState } from "react";

export default function Clock() {
    const [time, setTime] = useState<string>(() =>
        new Date().toLocaleTimeString([], {
            hour: "numeric",
            minute: "2-digit",
        })
    );

    useEffect(() => {
        const interval = setInterval(() => {
            setTime(
                new Date().toLocaleTimeString([], {
                    hour: "numeric",
                    minute: "2-digit",
                })
            );
        }, 1000);

        return () => clearInterval(interval);
    }, []);

    return (
        <div className="system-tray">
            <div className="clock text-white px-3 py-1 ">
                <img src="/login/running-man.svg" className="h-[17px] mr-[3px] inline-block drop-shadow-xs/30" />
                <img src="/layout/icons/icon-security.png" className="h-[17px] mr-[3px] inline-block drop-shadow-xs/30" />
                <img src="/layout/icons/icon-volume.png" className="h-[17px] mr-[8px] inline-block drop-shadow-sm/30" />
                {time}
            </div>
        </div>
    );
}
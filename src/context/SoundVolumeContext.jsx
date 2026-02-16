"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "aim-sound-volume";
const DEFAULT_VOLUME = 0.7;

// Module-level ref so any code (e.g. Firebase callbacks) can read current volume at play time
const volumeRef = { current: DEFAULT_VOLUME };

/** Call this when playing a sound to get the current volume (0–1). Works in async callbacks. */
export function getSoundVolume() {
    return volumeRef.current;
}

const SoundVolumeContext = createContext(undefined);

export function SoundVolumeProvider({ children }) {
    const [volume, setVolumeState] = useState(DEFAULT_VOLUME);

    useEffect(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored != null) {
                const v = parseFloat(stored, 10);
                if (!Number.isNaN(v) && v >= 0 && v <= 1) {
                    setVolumeState(v);
                    volumeRef.current = v;
                }
            }
        } catch (e) {
            // ignore
        }
    }, []);

    // Keep module-level ref in sync so getSoundVolume() is always current
    useEffect(() => {
        volumeRef.current = volume;
    }, [volume]);

    const setVolume = useCallback((valueOrUpdater) => {
        setVolumeState((prev) => {
            const next = typeof valueOrUpdater === "function" ? valueOrUpdater(prev) : valueOrUpdater;
            const clamped = Math.max(0, Math.min(1, next));
            volumeRef.current = clamped;
            try {
                localStorage.setItem(STORAGE_KEY, String(clamped));
            } catch (e) {
                // ignore
            }
            return clamped;
        });
    }, []);

    const value = { volume, setVolume };
    return (
        <SoundVolumeContext.Provider value={value}>
            {children}
        </SoundVolumeContext.Provider>
    );
}

export function useSoundVolume() {
    const ctx = useContext(SoundVolumeContext);
    if (ctx === undefined) {
        throw new Error("useSoundVolume must be used within a SoundVolumeProvider");
    }
    return ctx;
}

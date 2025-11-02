"use client";

import { useState, useEffect, useRef } from "react";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { ref, set, onDisconnect, get } from "firebase/database";
import { auth, db, database } from "@/lib/firebase";
import { useWindowManager } from "@/context/WindowManagerContext";

export default function LoginWindow() {
    const { loginWindowVisible, setLoginWindowVisible, setBuddyListVisible, bringToFront, isWindowActive, restorePreviousFocus, getWindowZIndex } = useWindowManager();
    const winRef = useRef(null);
    const hasBeenPositionedBeforeRef = useRef(false);

    // Handle visibility and ensure proper positioning
    useEffect(() => {
        if (winRef.current) {
            if (loginWindowVisible) {
                // Keep window hidden until positioned to prevent flicker
                winRef.current.style.visibility = "hidden";

                // Always center on initial page load (first time showing)
                // Use saved position only if user has positioned it before
                const savedPosition = localStorage.getItem("login-window-position");
                if (savedPosition && hasBeenPositionedBeforeRef.current) {
                    try {
                        const { top, left } = JSON.parse(savedPosition);
                        if (typeof top === "number" && typeof left === "number") {
                            winRef.current.style.top = `${top}px`;
                            winRef.current.style.left = `${left}px`;
                            // Make window visible after positioning
                            winRef.current.style.visibility = "visible";
                            return; // Exit early if we used saved position
                        }
                    } catch (e) {
                        console.log("Error parsing saved position:", e);
                        // Fall through to center positioning
                    }
                }

                // Always center the window (on initial load or if saved position invalid)
                // Use requestAnimationFrame to ensure window is rendered before calculating center
                requestAnimationFrame(() => {
                    if (winRef.current) {
                        const rect = winRef.current.getBoundingClientRect();
                        const vw = window.innerWidth;
                        const vh = window.innerHeight;
                        const left = Math.max(0, Math.floor((vw - rect.width) / 2));
                        const top = Math.max(0, Math.floor((vh - rect.height) / 2));
                        winRef.current.style.left = `${left}px`;
                        winRef.current.style.top = `${top}px`;
                        // Make window visible after positioning
                        winRef.current.style.visibility = "visible";
                    }
                });

                // Add manual drag functionality
                const header = winRef.current.querySelector(".title-bar");
                if (header) {
                    let startX = 0, startY = 0, startLeft = 0, startTop = 0, dragging = false;

                    const handleMouseDown = (e) => {
                        if (e.button !== 0) return;
                        if (e.target.closest?.(".title-bar-controls") || e.target.closest?.("button")) return;

                        dragging = true;
                        startLeft = parseInt(winRef.current.style.left || "0", 10);
                        startTop = parseInt(winRef.current.style.top || "0", 10);
                        startX = e.clientX;
                        startY = e.clientY;
                    };

                    const handleMouseMove = (e) => {
                        if (!dragging) return;
                        const dx = e.clientX - startX;
                        const dy = e.clientY - startY;

                        // Calculate new position
                        let newLeft = startLeft + dx;
                        let newTop = startTop + dy;

                        // Get window dimensions
                        const rect = winRef.current.getBoundingClientRect();
                        const windowWidth = rect.width;
                        const windowHeight = rect.height;

                        // Clamp to viewport bounds
                        const clampedLeft = Math.max(0, Math.min(newLeft, window.innerWidth - windowWidth));
                        const clampedTop = Math.max(0, Math.min(newTop, window.innerHeight - windowHeight));

                        winRef.current.style.left = `${clampedLeft}px`;
                        winRef.current.style.top = `${clampedTop}px`;
                    };

                    const handleMouseUp = () => {
                        if (!dragging) return;
                        dragging = false;

                        // Mark that user has positioned the window
                        hasBeenPositionedBeforeRef.current = true;
                        // Save position
                        localStorage.setItem("login-window-position", JSON.stringify({
                            top: parseInt(winRef.current.style.top || "0", 10),
                            left: parseInt(winRef.current.style.left || "0", 10),
                        }));
                    };

                    header.addEventListener("mousedown", handleMouseDown);
                    window.addEventListener("mousemove", handleMouseMove);
                    window.addEventListener("mouseup", handleMouseUp);

                    // Cleanup function
                    return () => {
                        header.removeEventListener("mousedown", handleMouseDown);
                        window.removeEventListener("mousemove", handleMouseMove);
                        window.removeEventListener("mouseup", handleMouseUp);
                    };
                }

                // Auto-focus the login window when it becomes visible
                // Use setTimeout to ensure the window is fully rendered and positioned
                setTimeout(() => {
                    bringToFront('login');
                }, 0);
            } else {
                winRef.current.style.visibility = "hidden";
            }
        }
    }, [loginWindowVisible]); // Only depend on loginWindowVisible, not bringToFront

    // Ensure login window gets focus on initial page load
    useEffect(() => {
        if (loginWindowVisible) {
            // Use a longer timeout to ensure everything is rendered
            const timer = setTimeout(() => {
                bringToFront('login');
            }, 100);

            return () => clearTimeout(timer);
        }
    }, [loginWindowVisible]); // Only depend on loginWindowVisible, not bringToFront

    const [screenname, setScreenname] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [showTooltip, setShowTooltip] = useState(false);
    const [showErrorWindow, setShowErrorWindow] = useState(false);
    const errorWinRef = useRef(null);
    const errorWindowPositionedRef = useRef(false);

    // Function to play error sound
    const playErrorSound = () => {
        try {
            const audio = new Audio('/sounds/xp-error.mp3');
            audio.volume = 0.7; // Set volume to 70%
            audio.play().catch(error => {
                console.log('Could not play error sound:', error);
            });
        } catch (error) {
            console.log('Could not play error sound:', error);
        }
    };

    // Auto-focus error window when it appears
    useEffect(() => {
        if (showErrorWindow) {
            bringToFront('error');
            playErrorSound(); // Play error sound when window appears
        }
    }, [showErrorWindow]); // Only depend on showErrorWindow, not bringToFront

    // Position error window when it first appears
    useEffect(() => {
        if (showErrorWindow && errorWinRef.current && !errorWindowPositionedRef.current) {
            const errorWindow = errorWinRef.current;

            // Calculate centered position relative to login window
            if (winRef.current) {
                const loginRect = winRef.current.getBoundingClientRect();
                const errorWidth = 300; // Approximate error window width
                const errorHeight = 150; // Approximate error window height

                const left = loginRect.left + (loginRect.width / 2) - (errorWidth / 2);
                const top = loginRect.top + (loginRect.height / 2) - (errorHeight / 2);

                errorWindow.style.left = `${left}px`;
                errorWindow.style.top = `${top}px`;
            } else {
                // Fallback to center of screen
                errorWindow.style.left = '50%';
                errorWindow.style.top = '50%';
                errorWindow.style.transform = 'translate(-50%, -50%)';
            }

            errorWindow.style.visibility = 'visible';
            errorWindowPositionedRef.current = true;
        }
    }, [showErrorWindow]);

    // Close tooltip when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (showTooltip && !event.target.closest('.tooltip-container')) {
                setShowTooltip(false);
            }
        };

        if (showTooltip) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showTooltip]);

    // Error window drag functionality - using same pattern as login window
    useEffect(() => {
        if (showErrorWindow && errorWinRef.current) {
            const errorWindow = errorWinRef.current;
            const header = errorWindow.querySelector('.error-title-bar');

            if (header) {
                let startX = 0, startY = 0, startLeft = 0, startTop = 0, dragging = false;

                const handleMouseDown = (e) => {
                    if (e.button !== 0) return;
                    if (e.target.closest?.('.title-bar-controls') || e.target.closest?.('button')) return;

                    dragging = true;
                    errorWindowPositionedRef.current = true;
                    startLeft = parseInt(errorWindow.style.left || "0", 10);
                    startTop = parseInt(errorWindow.style.top || "0", 10);
                    startX = e.clientX;
                    startY = e.clientY;
                };

                const handleMouseMove = (e) => {
                    if (!dragging) return;
                    const dx = e.clientX - startX;
                    const dy = e.clientY - startY;

                    // Calculate new position
                    let newLeft = startLeft + dx;
                    let newTop = startTop + dy;

                    // Get window dimensions
                    const rect = errorWindow.getBoundingClientRect();
                    const windowWidth = rect.width;
                    const windowHeight = rect.height;

                    // Clamp to viewport bounds
                    newLeft = Math.max(0, Math.min(newLeft, window.innerWidth - windowWidth));
                    newTop = Math.max(0, Math.min(newTop, window.innerHeight - windowHeight));

                    errorWindow.style.left = `${newLeft}px`;
                    errorWindow.style.top = `${newTop}px`;
                };

                const handleMouseUp = () => {
                    dragging = false;
                };

                header.addEventListener('mousedown', handleMouseDown);
                window.addEventListener('mousemove', handleMouseMove);
                window.addEventListener('mouseup', handleMouseUp);

                return () => {
                    header.removeEventListener('mousedown', handleMouseDown);
                    window.removeEventListener('mousemove', handleMouseMove);
                    window.removeEventListener('mouseup', handleMouseUp);
                };
            }
        }
    }, [showErrorWindow]);

    // Set user online status in Realtime Database
    const setOnlineStatus = async (uid, screenname) => {
        console.log('setOnlineStatus called with:', { uid, screenname });
        console.log('Screenname in setOnlineStatus:', screenname);
        console.log('Screenname type:', typeof screenname);
        console.log('Screenname length:', screenname.length);
        try {
            const userStatusRef = ref(database, `status/${uid}`);
            const userInfoRef = ref(database, `users/${uid}`);

            // Check if user already has a screenname stored
            const existingStatusSnapshot = await get(userStatusRef);
            const existingUserSnapshot = await get(userInfoRef);

            // Always use the screenname from the login form to preserve proper case
            // Trim to avoid issues with leading/trailing spaces
            let finalScreenname = screenname.trim();
            console.log('Using screenname from login form (trimmed):', finalScreenname);

            console.log('Setting user as online...');
            // Set user as online
            await set(userStatusRef, {
                online: true,
                lastSeen: Date.now(),
                screenname: finalScreenname
            });

            console.log('Setting user info...');
            // Set user info
            await set(userInfoRef, {
                screenname: finalScreenname,
                uid: uid
            });

            console.log('Setting up disconnect handler...');
            // Set up disconnect handler to mark user as offline when they disconnect
            onDisconnect(userStatusRef).update({
                online: false,
                lastSeen: Date.now(),
                screenname: finalScreenname
            });

            console.log('setOnlineStatus completed successfully');
        } catch (error) {
            console.log('setOnlineStatus error:', error);
            // Don't throw error - just log it so login can still work
        }
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        setError("");

        console.log('Login attempt started');

        if (!screenname.trim() || !password.trim()) {
            setError("Please enter both a screen name and password.");
            setShowErrorWindow(true);
            return;
        }
        if (password.length < 6) {
            setError("Password must be at least 6 characters.");
            setShowErrorWindow(true);
            return;
        }

        const email = `${screenname}@aim-revival.com`;
        console.log('Attempting login with email:', email);
        console.log('Original screenname:', screenname);
        console.log('Email screenname part:', screenname);

        try {
            console.log('Trying to sign in existing user...');
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            console.log('Sign in successful:', userCredential.user.uid);
            // Set online status for existing user with proper case screenname
            await setOnlineStatus(userCredential.user.uid, screenname);
        } catch (error) {
            console.log('Sign in error:', error.code, error.message);
            try {
                console.log('Trying to create new user...');
                const cred = await createUserWithEmailAndPassword(auth, email, password);
                console.log('Create user successful:', cred.user.uid);
                await setDoc(doc(db, "users", cred.user.uid), { screenname });
                // Set online status for new user
                await setOnlineStatus(cred.user.uid, screenname);
            } catch (err) {
                console.log('Create account error:', err.code, err.message);
                const msg = String(err?.message || "")
                    .includes("auth/email-already-in-use")
                    ? "Incorrect screen name or password."
                    : "Login/signup failed. Try a different screen name.";
                setError(msg);
                setShowErrorWindow(true);
                return;
            }
        }

        console.log('Login process completed, hiding login window');
        setLoginWindowVisible(false);
        setBuddyListVisible(true);
    };

    if (!loginWindowVisible) {
        return null;
    }

    return (
        <>
            <div
                ref={winRef}
                id="login-window"
                className={`window login-window w-[250px] h-[450px] absolute ${!isWindowActive('login') ? 'window-inactive' : ''}`}
                style={{
                    visibility: "hidden",
                    right: "auto",
                    bottom: "auto",
                    zIndex: getWindowZIndex('login')
                }}
                onMouseDown={() => bringToFront('login')}
            >
                <div className="title-bar login-header">
                    <div className="title-bar-text">
                        <img src="/login/running-man.svg" alt="" className="h-[16px] inline-block mb-1" /> Sign On
                    </div>
                    <div className="title-bar-controls">
                        <button
                            aria-label="Minimize"
                            onClick={() => setLoginWindowVisible(false)}
                        />
                        <button
                            aria-label="Maximize"
                            disabled
                            className="opacity-50"
                        />
                        <button
                            aria-label="Close"
                            onClick={() => {
                                setLoginWindowVisible(false);
                                restorePreviousFocus();
                            }}
                        />
                    </div>
                </div>

                <div className="window-body px-1 pt-2">
                    <div className="bg-[#00008f] py-4 px-7 relative">
                        <img src="/login/logo.svg" alt="AOL Instant Messenger logo" className="w-[90%] h-auto" />
                        <img src="/login/wordmark.svg" alt="AIM wordmark" className="w-full h-auto mt-4" />
                        <p className="text-[#fcce62] text-md italic font-bold absolute bottom-8 right-7">Revival</p>
                    </div>

                    <hr className="mt-2 border-1 border-t-[#9b9287] border-b-[#f9f7fe] border-r-0 border-l-0" />

                    <form onSubmit={handleLogin} className="px-3 py-2">
                        <div>
                            <label htmlFor="screenName" className="block">
                                <img src="/login/sn-label.png" alt="Screen Name" />
                            </label>
                            <input
                                id="screenName"
                                name="screenname"
                                value={screenname}
                                onChange={(e) => setScreenname(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        document.querySelector('form').requestSubmit();
                                    }
                                }}
                                className="w-full px-3 bg-white text-black text-sm focus:outline-none border-2 border-l-indigo-500 border-t-indigo-500"
                                type="text"
                            />
                            <div className="relative tooltip-container pixelated-font">
                                <p
                                    className="underline text-[#1d1272] cursor-pointer"
                                    onClick={() => setShowTooltip(!showTooltip)}
                                >
                                    Get a Screen Name
                                </p>
                                {showTooltip && (
                                    <div className="absolute top-[28px] left-8 bg-[#FFFFE1] border-1 border-black rounded-lg px-2 py-1 text-black z-50 w-[250px] shadow-lg tooltip-container box-shadow-lg pixelated-font">
                                        Just enter your desired screen name and password. You'll be automatically registered and can use them anytime to sign in!
                                        {/* SVG Arrow */}
                                        <svg className="absolute -top-3 left-3 w-3 h-3" viewBox="0 0 12 12">
                                            {/* Fill */}
                                            <path d="M0,0 L0,12 L12,12 Z" fill="#FFFFE1" />
                                            {/* Vertical border */}
                                            <line x1="0" y1="0" x2="0" y2="12" stroke="black" strokeWidth="2" />
                                            {/* Bottom horizontal border */}
                                            <line x1="0" y1="12" x2="12" y2="12" stroke="black" strokeWidth="0" />
                                            {/* Diagonal border */}
                                            <line x1="0" y1="0" x2="12" y2="12" stroke="black" strokeWidth="0.8" />
                                        </svg>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="field-row-stacked h-[47px]">
                            <label htmlFor="passWord" className="block text-black text-sm font-bold mt-2">
                                Password
                            </label>
                            <input
                                id="passWord"
                                name="password"
                                type="password"
                                placeholder="Password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        document.querySelector('form').requestSubmit();
                                    }
                                }}
                                className="w-full px-3 my-0! bg-white text-black text-sm focus:outline-none"
                            />
                        </div>

                        <p className="underline text-[#1d1272] mt-0 cursor-pointer pixelated-font">Forgot Password?</p>
                        <div className="flex items-center justify-between mt-2">
                            <input type="checkbox" id="savePass" />
                            <label htmlFor="savePass">Save password</label>
                            <input type="checkbox" id="autoLogin" />
                            <label htmlFor="autoLogin">Auto-login</label>
                        </div>
                        <div className="flex items-center justify-between mt-2">
                            <div className="flex items-center gap-2">
                                <img
                                    src="/login/help1.png"
                                    alt="Help"
                                    className="mt-2 cursor-pointer"
                                    onMouseEnter={(e) => e.target.src = "/login/help2.png"}
                                    onMouseLeave={(e) => e.target.src = "/login/help1.png"}
                                    onMouseDown={(e) => e.target.src = "/login/help3.png"}
                                    onMouseUp={(e) => e.target.src = "/login/help2.png"}
                                />

                                <img
                                    src="/login/setup1.png"
                                    alt="Setup"
                                    className="mt-2 cursor-pointer"
                                    onMouseEnter={(e) => e.target.src = "/login/setup2.png"}
                                    onMouseLeave={(e) => e.target.src = "/login/setup1.png"}
                                    onMouseDown={(e) => e.target.src = "/login/setup3.png"}
                                    onMouseUp={(e) => e.target.src = "/login/setup2.png"}
                                />
                            </div>

                            <img
                                src="/login/signon1.png"
                                alt="Sign On"
                                className="mt-2 cursor-pointer"
                                onClick={() => document.querySelector('form').requestSubmit()}
                                onMouseEnter={(e) => e.target.src = "/login/signon2.png"}
                                onMouseLeave={(e) => e.target.src = "/login/signon1.png"}
                                onMouseDown={(e) => e.target.src = "/login/signon3.png"}
                                onMouseUp={(e) => e.target.src = "/login/signon2.png"}
                            />
                        </div>
                    </form>

                </div>
            </div>

            {/* Error Window */}
            {showErrorWindow && (
                <div
                    ref={errorWinRef}
                    className={`window error-window absolute ${!isWindowActive('error') ? 'window-inactive' : ''}`}
                    style={{
                        visibility: 'hidden', // Will be set to visible by useEffect
                        zIndex: getWindowZIndex('error')
                    }}
                    onMouseDown={() => bringToFront('error')}
                >
                    <div className="title-bar error-title-bar">
                        <div className="title-bar-text">
                            Error
                        </div>
                        <div className="title-bar-controls pixelated-font">
                            <button
                                aria-label="Close"
                                onClick={() => {
                                    setShowErrorWindow(false);
                                    setError("");
                                    restorePreviousFocus();
                                    errorWindowPositionedRef.current = false; // Reset for next time
                                }}
                            />
                        </div>
                    </div>
                    <div className="window-body p-4 flex flex-col items-center justify-center">
                        <div className="mb-4 flex items-center gap-3">
                            <img src="/layout/icons/icon-red-x.png" alt="Error" className="w-6 h-6 flex-shrink-0" />
                            <p className="pixelated-font">{error}</p>
                        </div>
                        <button
                            className="px-4 py-2 bg-[#c0c0c0] border border-[#808080] pixelated-font hover:bg-[#d0d0d0]"
                            onClick={() => {
                                setShowErrorWindow(false);
                                setError("");
                                restorePreviousFocus();
                                errorWindowPositionedRef.current = false; // Reset for next time
                            }}
                        >
                            OK
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}
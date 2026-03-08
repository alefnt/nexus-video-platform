import React, { useState, useImperativeHandle, forwardRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface DoubleTapLikeHandle {
    trigger: (x: number, y: number) => void;
}

interface Heart {
    id: number;
    x: number;
    y: number;
    angle: number;
}

export const DoubleTapLike = forwardRef<DoubleTapLikeHandle>((_, ref) => {
    const [hearts, setHearts] = useState<Heart[]>([]);

    const trigger = useCallback((x: number, y: number) => {
        const id = Date.now();
        const angle = Math.random() * 40 - 20; // Random tilt between -20 and 20 deg
        setHearts(prev => [...prev, { id, x, y, angle }]);

        // Auto cleanup after animation
        setTimeout(() => {
            setHearts(prev => prev.filter(h => h.id !== id));
        }, 1000);
    }, []);

    useImperativeHandle(ref, () => ({
        trigger
    }));

    return (
        <div className="pointer-events-none absolute inset-0 overflow-hidden z-[50]">
            <AnimatePresence>
                {hearts.map(heart => (
                    <motion.div
                        key={heart.id}
                        initial={{ opacity: 0, scale: 0, x: heart.x - 40, y: heart.y - 40, rotate: 0 }}
                        animate={{
                            opacity: [0, 1, 1, 0],
                            scale: [0.5, 1.2, 1],
                            y: heart.y - 150,
                            rotate: heart.angle
                        }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                        className="absolute text-red-500 drop-shadow-lg"
                    >
                        <svg
                            width="80"
                            height="80"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                            className="filter drop-shadow-[0_0_10px_rgba(255,0,0,0.5)]"
                        >
                            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                        </svg>
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>
    );
});

DoubleTapLike.displayName = 'DoubleTapLike';

import React, { useRef, useState } from 'react';
import { motion, useMotionValue, useSpring, useTransform, HTMLMotionProps } from 'framer-motion';
import { cn } from '../../lib/utils';
import { Card } from './Card';

interface TiltCardProps extends Omit<HTMLMotionProps<"div">, "children"> {
    children: React.ReactNode;
    noPadding?: boolean;
}

export const TiltCard: React.FC<TiltCardProps> = ({ children, className, noPadding, onClick, ...props }) => {
    const ref = useRef<HTMLDivElement>(null);

    const x = useMotionValue(0);
    const y = useMotionValue(0);

    const mouseX = useSpring(x, { stiffness: 500, damping: 100 });
    const mouseY = useSpring(y, { stiffness: 500, damping: 100 });

    const rotateX = useTransform(mouseY, [-0.5, 0.5], ["7deg", "-7deg"]);
    const rotateY = useTransform(mouseX, [-0.5, 0.5], ["-7deg", "7deg"]);

    // Holographic sheen effect
    const sheenX = useTransform(mouseX, [-0.5, 0.5], ["0%", "100%"]);
    const sheenY = useTransform(mouseY, [-0.5, 0.5], ["0%", "100%"]);

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!ref.current) return;

        const rect = ref.current.getBoundingClientRect();

        const width = rect.width;
        const height = rect.height;

        const mouseXFromCenter = e.clientX - rect.left - width / 2;
        const mouseYFromCenter = e.clientY - rect.top - height / 2;

        x.set(mouseXFromCenter / width);
        y.set(mouseYFromCenter / height);
    };

    const handleMouseLeave = () => {
        x.set(0);
        y.set(0);
    };

    return (
        <motion.div
            ref={ref}
            style={{
                rotateX,
                rotateY,
                transformStyle: "preserve-3d",
            }}
            initial={{ scale: 1 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            onClick={onClick}
            className={cn("relative group perspective-1000 cursor-pointer", className)}
            {...props}
        >
            <Card
                variant="glass"
                noPadding={noPadding}
                className="h-full w-full overflow-hidden border-white/5 bg-nexus-elevated/50 backdrop-blur-md transition-shadow group-hover:shadow-[0_0_30px_rgba(162,103,255,0.2)]"
            >
                {/* Holographic Sheen Overlay */}
                <motion.div
                    style={{
                        background: `radial-gradient(circle at ${sheenX} ${sheenY}, rgba(255,255,255,0.15), transparent 60%)`,
                    }}
                    className="pointer-events-none absolute inset-0 z-10 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                />

                {children}
            </Card>
        </motion.div>
    );
};

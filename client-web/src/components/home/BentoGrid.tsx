import React from "react";
import { motion } from "framer-motion";
import { cn } from "../../lib/utils";

interface BentoGridProps {
    children: React.ReactNode;
    className?: string;
}

export const BentoGrid: React.FC<BentoGridProps> = ({ children, className }) => {
    return (
        <div
            className={cn(
                "grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 max-w-7xl mx-auto px-4 grid-flow-dense",
                className
            )}
        >
            {children}
        </div>
    );
};

interface BentoItemProps {
    children: React.ReactNode;
    className?: string;
    span?: "col-1" | "col-2" | "col-3" | "col-4" | "row-1" | "row-2" | "col-1-row-2" | "col-2-row-2";
}

export const BentoItem: React.FC<BentoItemProps> = ({ children, className, span }) => {
    const spanClass = {
        "col-1": "col-span-1",
        "col-2": "col-span-1 md:col-span-2",
        "col-3": "col-span-1 md:col-span-3",
        "col-4": "col-span-1 md:col-span-4",
        "row-1": "row-span-1",
        "row-2": "row-span-1 md:row-span-2",
        "col-1-row-2": "col-span-1 row-span-1 md:row-span-2",
        "col-2-row-2": "col-span-1 md:col-span-2 row-span-1 md:row-span-2",
    };

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            whileHover={{ y: -5 }}
            transition={{ duration: 0.3 }}
            className={cn(
                "group relative overflow-hidden rounded-3xl border border-white/10 bg-nexus-elevated/40 backdrop-blur-xl shadow-2xl",
                "hover:border-nexus-cyan/50 hover:shadow-[0_0_30px_rgba(0,245,212,0.2)] transition-all duration-300",
                span && spanClass[span],
                className
            )}
        >
            {/* Dynamic Glow Effect */}
            <div className="absolute inset-0 bg-gradient-to-br from-nexus-cyan/5 via-transparent to-nexus-purple/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

            {children}
        </motion.div>
    );
};

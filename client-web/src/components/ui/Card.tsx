import React from 'react';
import { cn } from '../../lib/utils';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
    variant?: 'glass' | 'solid' | 'interactive' | 'neon';
    noPadding?: boolean;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
    ({ className, variant = 'glass', noPadding = false, children, ...props }, ref) => {

        const variants = {
            glass: "glass-card hover:border-white/20 transition-colors",
            solid: "bg-nexus-surface border border-white/5 shadow-md",
            interactive: "glass-card hover:-translate-y-1 hover:shadow-[0_10px_30px_rgba(162,103,255,0.15)] hover:border-nexus-purple/30 transition-all cursor-pointer",
            neon: "glass-panel neon-border"
        };

        return (
            <div
                ref={ref}
                className={cn(
                    "rounded-[14px] overflow-hidden backdrop-blur-md",
                    variants[variant],
                    !noPadding && "p-6",
                    className
                )}
                {...props}
            >
                {children}
            </div>
        );
    }
);

Card.displayName = 'Card';


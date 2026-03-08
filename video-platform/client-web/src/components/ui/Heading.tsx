import React from 'react';
import { cn } from '../../lib/utils';

interface HeadingProps extends React.HTMLAttributes<HTMLHeadingElement> {
    level?: 1 | 2 | 3 | 4 | 5 | 6;
    gradient?: boolean;
}

export const Heading = React.forwardRef<HTMLHeadingElement, HeadingProps>(
    ({ className, level = 1, gradient = false, children, ...props }, ref) => {
        const Component = `h${level}` as any;

        const sizes = {
            1: "text-4xl md:text-6xl font-bold tracking-tight",
            2: "text-3xl md:text-4xl font-bold tracking-tight",
            3: "text-2xl font-semibold tracking-tight",
            4: "text-xl font-semibold",
            5: "text-lg font-medium",
            6: "text-base font-medium",
        };

        return (
            <Component
                ref={ref}
                className={cn(
                    "font-display text-text-primary",
                    sizes[level],
                    gradient && "bg-gradient-to-r from-nexus-purple to-nexus-cyan bg-clip-text text-transparent",
                    className
                )}
                {...props}
            >
                {children}
            </Component>
        );
    }
);

Heading.displayName = 'Heading';

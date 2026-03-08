import React from 'react';
import { cn } from '../../lib/utils';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline' | 'neon';
    size?: 'sm' | 'md' | 'lg';
    isLoading?: boolean;
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant = 'primary', size = 'md', isLoading, leftIcon, rightIcon, children, disabled, ...props }, ref) => {

        const baseStyles = "inline-flex items-center justify-center rounded-full font-display font-bold transition-all focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed active:scale-95";

        const variants = {
            primary: "text-black bg-nexus-cyan hover:bg-white hover:shadow-[0_0_20px_rgba(0,213,255,0.6)] border border-transparent",
            secondary: "text-white bg-gradient-to-r from-nexus-purple/20 to-nexus-cyan/20 border border-nexus-cyan/30 hover:border-nexus-cyan shadow-[0_0_15px_rgba(0,213,255,0.1)]",
            ghost: "bg-transparent text-gray-400 hover:text-white hover:bg-white/10 hover:border-nexus-cyan/30 border border-transparent",
            danger: "text-white bg-nexus-pink/20 border border-nexus-pink/50 shadow-[0_4px_15px_rgba(255,46,147,0.3)] hover:bg-nexus-pink hover:shadow-[0_0_20px_rgba(255,46,147,0.6)]",
            outline: "bg-transparent border border-white/20 text-white hover:border-nexus-cyan hover:text-nexus-cyan hover:bg-nexus-cyan/10 hover:shadow-[0_0_15px_rgba(0,213,255,0.2)]",
            neon: "glass-panel neon-border hover:neon-border-cyan hover:shadow-[0_0_20px_rgba(0,245,212,0.2)] text-white"
        };

        const sizes = {
            sm: "h-8 px-4 text-xs",
            md: "h-10 px-6 text-sm",
            lg: "h-12 px-8 text-base",
        };

        return (
            <button
                ref={ref}
                className={cn(baseStyles, variants[variant], sizes[size], className)}
                disabled={disabled || isLoading}
                {...props}
            >
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {!isLoading && leftIcon && <span className="mr-2">{leftIcon}</span>}
                {children}
                {!isLoading && rightIcon && <span className="ml-2">{rightIcon}</span>}
            </button>
        );
    }
);

Button.displayName = 'Button';


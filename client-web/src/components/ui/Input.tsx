import React from 'react';
import { cn } from '../../lib/utils';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    leftIcon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
    ({ className, label, error, leftIcon, id, ...props }, ref) => {
        return (
            <div className="w-full space-y-2">
                {label && (
                    <label htmlFor={id} className="text-sm font-medium text-text-secondary">
                        {label}
                    </label>
                )}
                <div className="relative">
                    {leftIcon && (
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted">
                            {leftIcon}
                        </div>
                    )}
                    <input
                        ref={ref}
                        id={id}
                        className={cn(
                            "w-full rounded-nexus-sm border bg-black/20 px-4 py-3 text-sm text-text-primary placeholder:text-text-muted transition-colors focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-50",
                            leftIcon ? "pl-10" : "",
                            error
                                ? "border-nexus-pink/50 focus:border-nexus-pink focus:ring-nexus-pink/20"
                                : "border-white/10 focus:border-nexus-purple focus:ring-nexus-purple/20 hover:border-white/20",
                            className
                        )}
                        {...props}
                    />
                </div>
                {error && (
                    <p className="text-xs text-nexus-pink animate-pulse">{error}</p>
                )}
            </div>
        );
    }
);

Input.displayName = 'Input';

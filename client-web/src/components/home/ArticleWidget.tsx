import React from "react";
import { BookOpen, ArrowUpRight, Clock } from "lucide-react";
import { Button } from "../ui";

import { useNavigate } from "react-router-dom";

export const ArticleWidget = () => {
    const navigate = useNavigate();

    return (
        <div className="h-full px-8 pt-14 pb-8 flex flex-col justify-between group relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-50">
                <BookOpen className="w-16 h-16 text-white/5 rotate-12" />
            </div>

            <div>
                <div className="flex items-center gap-2 mb-4">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-white/10 text-white border border-white/10">WEB3 PUBLISHING</span>
                    <span className="text-[10px] text-gray-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> 2h ago
                    </span>
                </div>

                <h3 className="text-lg font-bold text-white leading-snug mb-2 group-hover:text-nexus-cyan transition-colors cursor-pointer" onClick={() => navigate('/articles')}>
                    The Rise of Decentralized Media: Why Web3 Matters
                </h3>

                <p className="text-xs text-gray-400 line-clamp-2">
                    Explore how blockchain technology is reshaping content ownership and creator monetization in the digital age.
                </p>
            </div>

            <div className="flex items-center justify-between mt-4">
                <div className="flex -space-x-2">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="w-6 h-6 rounded-full border border-black bg-gray-600" />
                    ))}
                    <div className="w-6 h-6 rounded-full border border-black bg-nexus-cyan/20 text-[8px] flex items-center justify-center text-nexus-cyan font-bold">
                        +42
                    </div>
                </div>

                <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-[10px] border-white/10 hover:bg-white/10 group-hover:border-nexus-cyan/50 group-hover:text-nexus-cyan"
                    onClick={() => navigate('/articles')}
                >
                    Read <ArrowUpRight className="w-3 h-3 ml-1" />
                </Button>
            </div>
        </div>
    );
};

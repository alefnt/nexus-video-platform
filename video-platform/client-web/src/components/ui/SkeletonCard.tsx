/**
 * 列表骨架屏（F15）
 * 用于 Home、Explore、VideoList 等列表加载态
 */

import React from "react";

export interface SkeletonCardProps {
  /** 布局：horizontal 横向卡片，vertical 纵向（默认） */
  layout?: "vertical" | "horizontal";
  className?: string;
}

export function SkeletonCard({ layout = "vertical", className = "" }: SkeletonCardProps) {
  const base = "rounded-xl bg-white/5 animate-pulse";
  if (layout === "horizontal") {
    return (
      <div className={`flex gap-4 p-3 ${className}`}>
        <div className={`w-24 h-14 flex-shrink-0 ${base}`} />
        <div className="flex-1 min-w-0 space-y-2">
          <div className={`h-4 ${base}`} style={{ width: "80%" }} />
          <div className={`h-3 ${base}`} style={{ width: "50%" }} />
        </div>
      </div>
    );
  }
  return (
    <div className={`overflow-hidden ${className}`}>
      <div className={`aspect-video w-full ${base}`} />
      <div className="p-3 space-y-2">
        <div className={`h-4 ${base}`} style={{ width: "90%" }} />
        <div className={`h-3 ${base}`} style={{ width: "60%" }} />
      </div>
    </div>
  );
}

/** 占位多卡片，用于整行骨架 */
export function SkeletonCardRow({ count = 4 }: { count?: number }) {
  return (
    <div className="flex gap-4 overflow-hidden">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="min-w-[280px] flex-shrink-0">
          <SkeletonCard />
        </div>
      ))}
    </div>
  );
}

export default SkeletonCard;

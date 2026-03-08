/**
 * 图片懒加载组件（P1 优化）
 * - 使用原生 loading="lazy" + 占位背景，减少首屏请求与布局偏移
 */

import React from "react";

const PLACEHOLDER = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 225'%3E%3Crect fill='%231a1a2e' width='400' height='225'/%3E%3C/svg%3E";

export interface LazyImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  /** 占位背景色或 data URL，默认深色占位 */
  placeholder?: string;
  /** 是否使用 object-cover 填满容器（默认 true） */
  objectCover?: boolean;
}

export const LazyImage: React.FC<LazyImageProps> = ({
  src,
  alt,
  placeholder = PLACEHOLDER,
  objectCover = true,
  className = "",
  style,
  ...rest
}) => {
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      className={`${objectCover ? "object-cover" : ""} ${className}`.trim()}
      style={{
        backgroundColor: placeholder.startsWith("data:") ? undefined : placeholder || "#1a1a2e",
        ...style,
      }}
      {...rest}
    />
  );
};

export default LazyImage;

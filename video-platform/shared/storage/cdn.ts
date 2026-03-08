/**
 * CDN 管理工具
 * 
 * 支持多种 CDN:
 * - Cloudflare R2
 * - 又拍云
 * - 七牛 Kodo
 * - 自定义 (MinIO 源站)
 * 
 * 架构: 视频/图片 → MinIO (源站) → CDN (缓存分发)
 * Web3 确权: 内容哈希存 Arweave, 所有权存 CKB/Spore
 */

export type CDNProvider = "cloudflare" | "upyun" | "qiniu" | "minio";

interface CDNConfig {
    provider: CDNProvider;
    baseUrl: string;           // CDN 域名, e.g. https://cdn.yourdomain.com
    region?: string;           // 区域 (国内/海外)
    accessKey?: string;
    secretKey?: string;
    bucket?: string;
}

interface CDNUrl {
    global: string;            // 全球 CDN URL
    cn?: string;               // 国内加速 URL (可选)
}

// 从环境变量读取配置
const CDN_GLOBAL_BASE = process.env.CDN_GLOBAL_URL || "";
const CDN_CN_BASE = process.env.CDN_CN_URL || "";
const MINIO_PUBLIC_URL = process.env.MINIO_PUBLIC_URL || "http://localhost:9000";

/**
 * 将 MinIO 路径转换为 CDN URL
 */
export function toCDNUrl(minioPath: string): CDNUrl {
    // 如果已经是完整 URL, 直接返回
    if (minioPath.startsWith("http")) {
        return { global: minioPath };
    }

    // 移除前导 /
    const cleanPath = minioPath.replace(/^\/+/, "");

    return {
        global: CDN_GLOBAL_BASE
            ? `${CDN_GLOBAL_BASE}/${cleanPath}`
            : `${MINIO_PUBLIC_URL}/${cleanPath}`,
        cn: CDN_CN_BASE ? `${CDN_CN_BASE}/${cleanPath}` : undefined,
    };
}

/**
 * 根据用户区域选择最优 CDN URL
 */
export function selectBestCDN(urls: CDNUrl, isChina?: boolean): string {
    if (isChina && urls.cn) return urls.cn;
    return urls.global;
}

/**
 * 生成视频转码后的 CDN 播放地址
 * 
 * 输入: MinIO 中的 HLS master playlist 路径
 * 输出: 带 CDN 前缀的播放地址
 */
export function getPlaybackUrl(videoId: string, quality?: string): CDNUrl {
    const basePath = quality
        ? `videos/${videoId}/${quality}/index.m3u8`   // 特定码率
        : `videos/${videoId}/master.m3u8`;            // 自适应
    return toCDNUrl(basePath);
}

/**
 * 生成封面图 CDN 地址 (支持图片处理参数)
 * 
 * @param width  缩略图宽度
 * @param format WebP/AVIF 自动转换
 */
export function getCoverUrl(
    coverPath: string,
    options?: { width?: number; height?: number; format?: "webp" | "avif" | "jpg" }
): string {
    const cdnUrl = toCDNUrl(coverPath);
    const url = cdnUrl.global;

    // Cloudflare Image Resizing 参数
    if (CDN_GLOBAL_BASE?.includes("cloudflare")) {
        const params: string[] = [];
        if (options?.width) params.push(`width=${options.width}`);
        if (options?.height) params.push(`height=${options.height}`);
        if (options?.format) params.push(`format=${options.format}`);
        return params.length > 0 ? `${url}?${params.join("&")}` : url;
    }

    // 又拍云参数
    if (CDN_GLOBAL_BASE?.includes("upyun")) {
        const ops: string[] = [];
        if (options?.width) ops.push(`/fw/${options.width}`);
        if (options?.format === "webp") ops.push("/format/webp");
        return ops.length > 0 ? `${url}!/` + ops.join("") : url;
    }

    return url;
}

/**
 * 上传后推送到 CDN (预热)
 * 在 content service 上传完成后调用
 */
export async function preheatCDN(paths: string[]): Promise<void> {
    if (!CDN_GLOBAL_BASE) return;

    const urls = paths.map((p) => toCDNUrl(p).global);

    // Cloudflare: 使用 cache purge API (预热 = 清除缓存, 下次请求自动回源)
    // 实际预热需要调用各 CDN 供应商的 API
    console.log(`[CDN] Preheating ${urls.length} files`);

    // TODO: 根据 provider 调用对应 API
    // 这里仅打日志, 实际集成时替换
}

/**
 * 清除 CDN 缓存 (内容更新时调用)
 */
export async function purgeCDN(paths: string[]): Promise<void> {
    if (!CDN_GLOBAL_BASE) return;

    const urls = paths.map((p) => toCDNUrl(p).global);
    console.log(`[CDN] Purging ${urls.length} files from cache`);

    // TODO: 调用 CDN API 清除缓存
}

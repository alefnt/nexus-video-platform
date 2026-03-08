// FILE: /video-platform/client-web/src/lib/webtorrent.ts
/**
 * Nexus Video - WebTorrent P2P 视频流
 * 
 * 功能说明：
 * - 支持通过 WebTorrent 进行 P2P 视频分发
 * - 可选：将视频同时做种分享给其他观众
 * - 回退：如果 WebTorrent 失败，使用传统 HTTP 流
 * 
 * 依赖：webtorrent
 */

// WebTorrent 类型声明
declare global {
    interface Window {
        WebTorrent: any;
    }
}

export interface TorrentInfo {
    magnetURI: string;
    infoHash: string;
    name: string;
    files: TorrentFile[];
    progress: number;
    downloadSpeed: number;
    uploadSpeed: number;
    numPeers: number;
}

export interface TorrentFile {
    name: string;
    length: number;
    path: string;
}

export interface StreamOptions {
    magnetURI?: string;
    infoHash?: string;
    httpFallbackUrl?: string;
    onProgress?: (progress: number) => void;
    onReady?: (streamUrl: string, torrentInfo: TorrentInfo) => void;
    onError?: (error: Error) => void;
    onPeerUpdate?: (numPeers: number) => void;
}

// WebTorrent 客户端管理
let clientInstance: any = null;
const activeTorrents = new Map<string, any>();

/**
 * 获取或创建 WebTorrent 客户端
 */
async function getClient(): Promise<any> {
    if (clientInstance) return clientInstance;

    // 动态加载 WebTorrent
    if (typeof window !== "undefined" && !window.WebTorrent) {
        try {
            const WebTorrent = await import("webtorrent");
            window.WebTorrent = WebTorrent.default || WebTorrent;
        } catch (e) {
            console.warn("WebTorrent not available, using fallback mode");
            throw new Error("WebTorrent not available");
        }
    }

    if (!window.WebTorrent) {
        throw new Error("WebTorrent not available");
    }

    clientInstance = new window.WebTorrent();

    // 监听全局错误
    clientInstance.on("error", (err: Error) => {
        console.error("WebTorrent client error:", err);
    });

    return clientInstance;
}

/**
 * 通过磁力链接或 InfoHash 流式播放视频
 */
export async function streamFromTorrent(options: StreamOptions): Promise<{
    streamUrl: string;
    cleanup: () => void;
}> {
    const { magnetURI, infoHash, httpFallbackUrl, onProgress, onReady, onError, onPeerUpdate } = options;

    const torrentId = magnetURI || infoHash;
    if (!torrentId) {
        throw new Error("magnetURI or infoHash required");
    }

    try {
        const client = await getClient();

        // 检查是否已有此 torrent
        const existing = activeTorrents.get(torrentId);
        if (existing) {
            const videoFile = existing.files.find((f: any) =>
                /\.(mp4|webm|mkv|m3u8)$/i.test(f.name)
            );
            if (videoFile) {
                const streamUrl = await createStreamUrl(videoFile);
                return {
                    streamUrl,
                    cleanup: () => removeTorrent(torrentId),
                };
            }
        }

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                if (httpFallbackUrl) {
                    console.warn("WebTorrent timeout, falling back to HTTP");
                    resolve({
                        streamUrl: httpFallbackUrl,
                        cleanup: () => { },
                    });
                } else {
                    reject(new Error("Torrent timeout"));
                }
            }, 30000); // 30 秒超时

            client.add(torrentId, { announce: getTrackers() }, (torrent: any) => {
                clearTimeout(timeout);
                activeTorrents.set(torrentId, torrent);

                // 找到视频文件
                const videoFile = torrent.files.find((f: any) =>
                    /\.(mp4|webm|mkv|m3u8)$/i.test(f.name)
                );

                if (!videoFile) {
                    if (httpFallbackUrl) {
                        resolve({ streamUrl: httpFallbackUrl, cleanup: () => removeTorrent(torrentId) });
                    } else {
                        reject(new Error("No video file found in torrent"));
                    }
                    return;
                }

                // 优先加载视频文件
                videoFile.select();

                // 创建流 URL
                createStreamUrl(videoFile).then((streamUrl) => {
                    const torrentInfo: TorrentInfo = {
                        magnetURI: torrent.magnetURI,
                        infoHash: torrent.infoHash,
                        name: torrent.name,
                        files: torrent.files.map((f: any) => ({
                            name: f.name,
                            length: f.length,
                            path: f.path,
                        })),
                        progress: torrent.progress,
                        downloadSpeed: torrent.downloadSpeed,
                        uploadSpeed: torrent.uploadSpeed,
                        numPeers: torrent.numPeers,
                    };

                    if (onReady) onReady(streamUrl, torrentInfo);

                    resolve({
                        streamUrl,
                        cleanup: () => removeTorrent(torrentId),
                    });
                });

                // 进度更新
                torrent.on("download", () => {
                    if (onProgress) onProgress(torrent.progress);
                });

                // Peer 更新
                torrent.on("wire", () => {
                    if (onPeerUpdate) onPeerUpdate(torrent.numPeers);
                });

                // 错误处理
                torrent.on("error", (err: Error) => {
                    console.error("Torrent error:", err);
                    if (onError) onError(err);
                });
            });
        });
    } catch (e) {
        // WebTorrent 不可用，回退到 HTTP
        if (httpFallbackUrl) {
            console.warn("WebTorrent error, falling back to HTTP:", e);
            return {
                streamUrl: httpFallbackUrl,
                cleanup: () => { },
            };
        }
        throw e;
    }
}

/**
 * 创建视频文件的流 URL
 */
async function createStreamUrl(file: any): Promise<string> {
    return new Promise((resolve) => {
        file.getBlobURL((err: Error | null, url: string) => {
            if (err) {
                // 备选方案：使用 createReadStream
                const stream = file.createReadStream();
                const chunks: Uint8Array[] = [];
                stream.on("data", (chunk: Uint8Array) => chunks.push(chunk));
                stream.on("end", () => {
                    const blob = new Blob(chunks, { type: "video/mp4" });
                    resolve(URL.createObjectURL(blob));
                });
            } else {
                resolve(url);
            }
        });
    });
}

/**
 * 移除 torrent
 */
export function removeTorrent(torrentId: string): void {
    const torrent = activeTorrents.get(torrentId);
    if (torrent) {
        torrent.destroy();
        activeTorrents.delete(torrentId);
    }
}

/**
 * 销毁 WebTorrent 客户端
 */
export function destroyClient(): void {
    if (clientInstance) {
        clientInstance.destroy();
        clientInstance = null;
    }
    activeTorrents.clear();
}

/**
 * 获取当前活跃的 torrent 统计
 */
export function getStats(): {
    totalPeers: number;
    totalDownloadSpeed: number;
    totalUploadSpeed: number;
    activeTorrents: number;
} {
    let totalPeers = 0;
    let totalDownloadSpeed = 0;
    let totalUploadSpeed = 0;

    activeTorrents.forEach((torrent) => {
        totalPeers += torrent.numPeers || 0;
        totalDownloadSpeed += torrent.downloadSpeed || 0;
        totalUploadSpeed += torrent.uploadSpeed || 0;
    });

    return {
        totalPeers,
        totalDownloadSpeed,
        totalUploadSpeed,
        activeTorrents: activeTorrents.size,
    };
}

/**
 * 创建磁力链接从文件
 */
export async function createMagnetFromFile(file: File): Promise<{
    magnetURI: string;
    infoHash: string;
}> {
    const client = await getClient();

    return new Promise((resolve, reject) => {
        client.seed(file, { announce: getTrackers() }, (torrent: any) => {
            resolve({
                magnetURI: torrent.magnetURI,
                infoHash: torrent.infoHash,
            });
        });

        // 超时处理
        setTimeout(() => reject(new Error("Seed timeout")), 60000);
    });
}

/**
 * 获取 WebTorrent trackers
 */
function getTrackers(): string[] {
    return [
        "wss://tracker.openwebtorrent.com",
        "wss://tracker.btorrent.xyz",
        "wss://tracker.fastcast.nz",
        "wss://tracker.webtorrent.dev",
    ];
}

/**
 * 检查 WebTorrent 是否可用
 */
export function isWebTorrentSupported(): boolean {
    if (typeof window === "undefined") return false;

    // 检查必要的 API
    const hasRTC = !!(
        window.RTCPeerConnection ||
        (window as any).webkitRTCPeerConnection ||
        (window as any).mozRTCPeerConnection
    );

    const hasWebSocket = !!window.WebSocket;

    return hasRTC && hasWebSocket;
}

// 导出状态检查
export function getActiveConnections(): number {
    let total = 0;
    activeTorrents.forEach((torrent) => {
        total += torrent.numPeers || 0;
    });
    return total;
}

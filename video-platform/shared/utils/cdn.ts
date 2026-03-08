/**
 * Build CDN cover URL with optional format/size params.
 * Falls back to original URL if no CDN configured.
 */
export function getCoverUrl(originalUrl: string | undefined | null, opts?: { width?: number; format?: 'webp' | 'jpg' }): string {
    if (!originalUrl) return '';
    const cdnBase = typeof process !== 'undefined' ? process.env?.CDN_BASE_URL : undefined;
    if (!cdnBase) return originalUrl;
    const params = new URLSearchParams();
    if (opts?.width) params.set('w', String(opts.width));
    if (opts?.format) params.set('f', opts.format);
    const qs = params.toString();
    return `${cdnBase}/${encodeURIComponent(originalUrl)}${qs ? '?' + qs : ''}`;
}

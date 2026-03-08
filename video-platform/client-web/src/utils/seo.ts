/**
 * SEO 工具 - Open Graph / JSON-LD / Meta Tags
 *
 * 用法:
 *   import { setPageSEO, setVideoSEO } from '../utils/seo';
 *   setPageSEO({ title: '首页', description: '...' });
 *   setVideoSEO({ title: '视频标题', ... });
 */

interface PageSEOOptions {
    title: string;
    description?: string;
    url?: string;
    image?: string;
    type?: string;
    siteName?: string;
}

interface VideoSEOOptions {
    title: string;
    description?: string;
    thumbnailUrl: string;
    duration: number; // 秒
    uploadDate: string; // ISO
    contentUrl?: string;
    embedUrl?: string;
    creator?: string;
    views?: number;
    tags?: string[];
}

const SITE_NAME = "Nexus Video";
const DEFAULT_IMAGE = "/og-image.png";

/**
 * 设置页面 Meta 标签 + Open Graph
 */
export function setPageSEO(options: PageSEOOptions): void {
    const {
        title,
        description = "去中心化视频社交平台 - 创作者优先",
        url = typeof window !== "undefined" ? window.location.href : "",
        image = DEFAULT_IMAGE,
        type = "website",
        siteName = SITE_NAME,
    } = options;

    // Document title
    document.title = `${title} | ${siteName}`;

    // Meta tags
    setMeta("description", description);

    // Open Graph
    setMeta("og:title", title, "property");
    setMeta("og:description", description, "property");
    setMeta("og:type", type, "property");
    setMeta("og:url", url, "property");
    setMeta("og:image", image, "property");
    setMeta("og:site_name", siteName, "property");

    // Twitter Card
    setMeta("twitter:card", "summary_large_image");
    setMeta("twitter:title", title);
    setMeta("twitter:description", description);
    setMeta("twitter:image", image);
}

/**
 * 设置视频页 SEO (Open Graph Video + JSON-LD VideoObject)
 */
export function setVideoSEO(options: VideoSEOOptions): void {
    const {
        title,
        description = "",
        thumbnailUrl,
        duration,
        uploadDate,
        contentUrl,
        embedUrl,
        creator,
        views,
        tags = [],
    } = options;

    // 基础 SEO
    setPageSEO({
        title,
        description,
        image: thumbnailUrl,
        type: "video.other",
    });

    // OG Video
    if (contentUrl) setMeta("og:video", contentUrl, "property");
    setMeta("og:video:type", "text/html", "property");

    // JSON-LD VideoObject
    const jsonLd: Record<string, any> = {
        "@context": "https://schema.org",
        "@type": "VideoObject",
        name: title,
        description,
        thumbnailUrl,
        uploadDate,
        duration: `PT${Math.floor(duration / 60)}M${duration % 60}S`,
    };
    if (contentUrl) jsonLd.contentUrl = contentUrl;
    if (embedUrl) jsonLd.embedUrl = embedUrl;
    if (creator) jsonLd.author = { "@type": "Person", name: creator };
    if (views !== undefined) {
        jsonLd.interactionStatistic = {
            "@type": "InteractionCounter",
            interactionType: "https://schema.org/WatchAction",
            userInteractionCount: views,
        };
    }
    if (tags.length > 0) jsonLd.keywords = tags.join(", ");

    injectJsonLd(jsonLd);
}

/**
 * 设置创作者频道 SEO (JSON-LD Person)
 */
export function setCreatorSEO(options: {
    name: string;
    description?: string;
    image?: string;
    url?: string;
    followers?: number;
}): void {
    setPageSEO({
        title: `${options.name} 的频道`,
        description: options.description,
        image: options.image,
        type: "profile",
    });

    const jsonLd: Record<string, any> = {
        "@context": "https://schema.org",
        "@type": "Person",
        name: options.name,
        url: options.url,
    };
    if (options.description) jsonLd.description = options.description;
    if (options.image) jsonLd.image = options.image;
    if (options.followers !== undefined) {
        jsonLd.interactionStatistic = {
            "@type": "InteractionCounter",
            interactionType: "https://schema.org/FollowAction",
            userInteractionCount: options.followers,
        };
    }

    injectJsonLd(jsonLd);
}

// ============== 工具 ==============

function setMeta(name: string, content: string, attr: "name" | "property" = "name"): void {
    let el = document.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement | null;
    if (!el) {
        el = document.createElement("meta");
        el.setAttribute(attr, name);
        document.head.appendChild(el);
    }
    el.setAttribute("content", content);
}

function injectJsonLd(data: Record<string, any>): void {
    const id = "json-ld-seo";
    let el = document.getElementById(id) as HTMLScriptElement | null;
    if (!el) {
        el = document.createElement("script");
        el.id = id;
        el.type = "application/ld+json";
        document.head.appendChild(el);
    }
    el.textContent = JSON.stringify(data);
}

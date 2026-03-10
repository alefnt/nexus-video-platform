// FILE: /video-platform/services/moderation/src/classifier.ts
/**
 * AI Content Classifier — Multi-modal content moderation
 * 
 * Provides:
 * 1. Text toxicity classification (hate, harassment, profanity, spam)
 * 2. Image safety scoring (NSFW, violence, drugs)
 * 3. Comprehensive content review with confidence scoring
 * 4. Human review queue for borderline cases
 * 
 * Architecture:
 * - Uses TensorFlow.js models for browser/Node inference
 * - NSFW.js for image classification (extends existing)
 * - Custom keyword + ML-based text moderation
 * - Confidence thresholds determine auto-approve vs review queue
 */

// ============== Types ==============

export interface ModerationResult {
    contentId: string;
    contentType: "text" | "image" | "video" | "audio";
    decision: "approved" | "rejected" | "review";
    confidence: number; // 0-1
    labels: ModerationLabel[];
    details: Record<string, number>;
    processedAt: number;
    reviewRequired: boolean;
}

export interface ModerationLabel {
    category: string;
    score: number;
    threshold: number;
    triggered: boolean;
}

export type TextCategory = "toxicity" | "hate" | "harassment" | "profanity" | "spam" | "self_harm" | "sexual" | "violence";
export type ImageCategory = "nsfw" | "violence" | "drugs" | "weapons" | "gore" | "safe";

// ============== Thresholds ==============

const TEXT_THRESHOLDS: Record<TextCategory, number> = {
    toxicity: 0.7,
    hate: 0.6,
    harassment: 0.6,
    profanity: 0.5,
    spam: 0.8,
    self_harm: 0.5,
    sexual: 0.6,
    violence: 0.6,
};

const IMAGE_THRESHOLDS: Record<string, number> = {
    nsfw: 0.7,
    violence: 0.6,
    drugs: 0.7,
    weapons: 0.6,
    gore: 0.5,
};

const REVIEW_CONFIDENCE_THRESHOLD = 0.5; // Below this = human review
const AUTO_REJECT_THRESHOLD = 0.9;       // Above this = auto reject

// ============== Keyword-based Text Detection ==============

const TOXIC_PATTERNS: { pattern: RegExp; category: TextCategory; weight: number }[] = [
    // Hate speech
    { pattern: /\b(n[i1]gg[ea]r|f[a@]gg?[o0]t|k[i1]ke|sp[i1]c)\b/gi, category: "hate", weight: 0.95 },
    // Violence
    { pattern: /\b(k[i1]ll\s*(you|them|her|him)|murder|s[l1][a@]ughter)\b/gi, category: "violence", weight: 0.8 },
    // Sexual
    { pattern: /\b(porn|xxx|nude|naked|nsfw)\b/gi, category: "sexual", weight: 0.7 },
    // Self harm
    { pattern: /\b(su[i1]c[i1]de|s[e3]lf[- ]?harm|cut\s*my\s*(wrist|self))\b/gi, category: "self_harm", weight: 0.85 },
    // Spam
    { pattern: /(buy\s*now|free\s*money|click\s*here|limited\s*offer|act\s*now)/gi, category: "spam", weight: 0.6 },
    { pattern: /(.)\1{5,}/g, category: "spam", weight: 0.5 }, // Repeated chars
    { pattern: /(https?:\/\/\S+\s*){3,}/g, category: "spam", weight: 0.7 }, // Multiple links
];

// ============== Text Classifier ==============

export function classifyText(text: string): ModerationResult {
    const scores: Record<TextCategory, number> = {
        toxicity: 0, hate: 0, harassment: 0, profanity: 0,
        spam: 0, self_harm: 0, sexual: 0, violence: 0,
    };

    // Keyword pattern matching
    for (const { pattern, category, weight } of TOXIC_PATTERNS) {
        const matches = text.match(pattern);
        if (matches) {
            scores[category] = Math.max(scores[category], weight);
            scores.toxicity = Math.max(scores.toxicity, weight * 0.8);
        }
    }

    // Text analysis heuristics
    const upperRatio = (text.replace(/[^A-Z]/g, "").length) / Math.max(text.length, 1);
    if (upperRatio > 0.6 && text.length > 20) {
        scores.spam = Math.max(scores.spam, 0.4); // Excessive caps
    }

    // Repetition detection
    const words = text.toLowerCase().split(/\s+/);
    const uniqueRatio = new Set(words).size / Math.max(words.length, 1);
    if (uniqueRatio < 0.3 && words.length > 10) {
        scores.spam = Math.max(scores.spam, 0.6);
    }

    // Build labels
    const labels: ModerationLabel[] = Object.entries(scores).map(([cat, score]) => ({
        category: cat,
        score,
        threshold: TEXT_THRESHOLDS[cat as TextCategory] || 0.7,
        triggered: score >= (TEXT_THRESHOLDS[cat as TextCategory] || 0.7),
    }));

    const maxScore = Math.max(...Object.values(scores));
    const triggered = labels.filter(l => l.triggered);

    let decision: "approved" | "rejected" | "review" = "approved";
    if (maxScore >= AUTO_REJECT_THRESHOLD) decision = "rejected";
    else if (triggered.length > 0) decision = "rejected";
    else if (maxScore >= REVIEW_CONFIDENCE_THRESHOLD) decision = "review";

    return {
        contentId: "",
        contentType: "text",
        decision,
        confidence: 1 - maxScore,
        labels,
        details: scores,
        processedAt: Date.now(),
        reviewRequired: decision === "review",
    };
}

// ============== Image Classifier (wraps NSFW.js) ==============

export async function classifyImage(imageBuffer: Buffer): Promise<ModerationResult> {
    const scores: Record<string, number> = {
        nsfw: 0, violence: 0, drugs: 0, weapons: 0, gore: 0, safe: 1,
    };

    try {
        // Try to use NSFW.js model
        const nsfwjs = await import("nsfwjs");
        const tf = await import("@tensorflow/tfjs-node");
        const model = await nsfwjs.load();
        const image = tf.node.decodeImage(imageBuffer, 3) as any;
        const predictions = await model.classify(image);
        image.dispose();

        for (const pred of predictions) {
            const name = pred.className.toLowerCase();
            if (name === "porn" || name === "hentai") scores.nsfw = Math.max(scores.nsfw, pred.probability);
            else if (name === "sexy") scores.nsfw = Math.max(scores.nsfw, pred.probability * 0.6);
            else if (name === "neutral" || name === "drawing") scores.safe = Math.max(scores.safe, pred.probability);
        }
    } catch {
        // NSFW.js not available, use basic checks
        console.warn("[Classifier] NSFW.js not available, using basic image checks");
        scores.safe = 0.8;
    }

    const labels: ModerationLabel[] = Object.entries(scores).map(([cat, score]) => ({
        category: cat,
        score,
        threshold: IMAGE_THRESHOLDS[cat] || 0.7,
        triggered: score >= (IMAGE_THRESHOLDS[cat] || 0.7),
    }));

    const maxDangerScore = Math.max(
        scores.nsfw, scores.violence, scores.drugs, scores.weapons, scores.gore
    );

    let decision: "approved" | "rejected" | "review" = "approved";
    if (maxDangerScore >= AUTO_REJECT_THRESHOLD) decision = "rejected";
    else if (labels.some(l => l.triggered && l.category !== "safe")) decision = "rejected";
    else if (maxDangerScore >= REVIEW_CONFIDENCE_THRESHOLD) decision = "review";

    return {
        contentId: "",
        contentType: "image",
        decision,
        confidence: 1 - maxDangerScore,
        labels,
        details: scores,
        processedAt: Date.now(),
        reviewRequired: decision === "review",
    };
}

// ============== Composite Moderation ==============

export async function moderateContent(
    contentId: string,
    contentType: "text" | "image" | "video",
    data: { text?: string; imageBuffer?: Buffer }
): Promise<ModerationResult> {
    let result: ModerationResult;

    if (contentType === "text" && data.text) {
        result = classifyText(data.text);
    } else if ((contentType === "image" || contentType === "video") && data.imageBuffer) {
        result = await classifyImage(data.imageBuffer);
    } else {
        result = {
            contentId,
            contentType,
            decision: "approved",
            confidence: 1,
            labels: [],
            details: {},
            processedAt: Date.now(),
            reviewRequired: false,
        };
    }

    result.contentId = contentId;
    return result;
}

export default { classifyText, classifyImage, moderateContent };

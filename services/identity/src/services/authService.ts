// FILE: /video-platform/services/identity/src/services/authService.ts
/**
 * Authentication Service — Core logic for user creation, JWT issuance, and verification.
 * Extracted from monolithic server.ts for better testability and maintainability.
 */

import { PrismaClient } from "@video-platform/database";
import { v4 as uuidv4 } from "uuid";
import { createHash, randomBytes } from "crypto";
import type { AuthResponse, JWTClaims, OfflineToken } from "@video-platform/shared/types";

const prisma = new PrismaClient();

// ============== Constants ==============
export const NONCE_TTL_MS = 120_000; // 2 minutes
export const PKCE_TTL_MS = 600_000; // 10 minutes
export const EMAIL_CODE_TTL_MS = 600_000; // 10 minutes
export const MAGIC_LINK_TTL_MS = 600_000; // 10 minutes
export const SMS_CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes

// ============== Admin Config ==============
export const ADMIN_USER_IDS = (process.env.ADMIN_USER_IDS || "").split(",").map(s => s.trim()).filter(Boolean);
export const ADMIN_BIT_DOMAINS = (process.env.ADMIN_BIT_DOMAINS || "").split(",").map(s => s.trim().toLowerCase()).filter(Boolean);

// ============== OAuth Config ==============
export const TWITTER_CLIENT_ID = process.env.TWITTER_CLIENT_ID || "";
export const TWITTER_REDIRECT_URI = process.env.TWITTER_REDIRECT_URI || "http://localhost:5173/auth/twitter/callback";
export const TWITTER_SCOPE = process.env.TWITTER_SCOPE || "tweet.read users.read offline.access";
export const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
export const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";
export const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || "http://localhost:5173/auth/google/callback";
export const GOOGLE_SCOPE = "openid email profile";

// ============== Utility Functions ==============

export function base64url(buf: Buffer): string {
    return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function generateCodeVerifier(): string {
    return base64url(randomBytes(32));
}

export function computeCodeChallengeS256(verifier: string): string {
    const hash = createHash("sha256").update(verifier).digest();
    return base64url(hash);
}

export function generateNumericCode(length = 6): string {
    const buf = randomBytes(length);
    let out = "";
    for (let i = 0; i < buf.length; i++) {
        out += (buf[i] % 10).toString();
    }
    return out;
}

export function isAdmin(claims: any): boolean {
    const sub = String(claims?.sub || "");
    const dom = String(claims?.dom || "").toLowerCase();
    const roleStr = String(claims?.role || "").toLowerCase();
    const rolesArr = Array.isArray(claims?.roles) ? claims.roles.map((r: any) => String(r).toLowerCase()) : [];
    if (ADMIN_USER_IDS.includes(sub)) return true;
    if (dom && ADMIN_BIT_DOMAINS.includes(dom)) return true;
    if (roleStr === "admin") return true;
    if (rolesArr.includes("admin")) return true;
    if (claims?.isAdmin === true || claims?.adm === true || claims?.adm === 1) return true;
    return false;
}

// ============== JWT & User Helpers ==============

export function buildJWTClaims(userId: string, opts: { dom?: string; ckb?: string; dfp?: string; roles?: string[] }): JWTClaims {
    const now = Math.floor(Date.now() / 1000);
    return {
        sub: userId,
        dom: opts.dom || "",
        ckb: opts.ckb || "",
        dfp: opts.dfp || "",
        iat: now,
        exp: now + 60 * 60 * 12, // 12h
        jti: uuidv4(),
    };
}

export function buildOfflineToken(userId: string, dfp: string): OfflineToken {
    const now = Math.floor(Date.now() / 1000);
    return {
        token: Buffer.from(`${userId}|${dfp}|${now}`).toString("base64"),
        deviceFingerprint: dfp,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    };
}

export function buildAuthResponse(jwtToken: string, user: any, claims: JWTClaims, dfp: string, pubkeyHint?: string): AuthResponse {
    return {
        jwt: jwtToken,
        user: {
            id: user.id,
            bitDomain: user.did || "",
            joyIdPublicKey: pubkeyHint || "",
            ckbAddress: user.address || "",
            createdAt: (user.joinedAt || new Date()).toISOString(),
        },
        offlineToken: buildOfflineToken(user.id, dfp),
    };
}

// ============== User Persistence ==============

export async function findOrCreateUserByAddress(address: string, opts?: { did?: string; nickname?: string }): Promise<any> {
    let user = await prisma.user.findUnique({ where: { address } });
    if (!user) {
        user = await prisma.user.create({
            data: {
                address,
                did: opts?.did || undefined,
                nickname: opts?.nickname,
                role: "viewer",
                points: 0,
            },
        });
    }
    return user;
}

export async function findOrCreateUserByDid(did: string, opts?: { email?: string; nickname?: string; avatar?: string }): Promise<any> {
    return prisma.user.upsert({
        where: { did },
        update: { ...(opts?.nickname ? { nickname: opts.nickname } : {}), ...(opts?.avatar ? { avatar: opts.avatar } : {}) },
        create: {
            did,
            email: opts?.email,
            nickname: opts?.nickname,
            avatar: opts?.avatar,
            role: "viewer",
            points: 0,
        },
    });
}

export async function findOrCreateUserByEmail(email: string, opts?: { nickname?: string; avatar?: string }): Promise<any> {
    return prisma.user.upsert({
        where: { email: email.toLowerCase() },
        update: { ...(opts?.nickname ? { nickname: opts.nickname } : {}), ...(opts?.avatar ? { avatar: opts.avatar } : {}) },
        create: {
            email: email.toLowerCase(),
            did: email.toLowerCase(),
            nickname: opts?.nickname,
            avatar: opts?.avatar,
            role: "viewer",
            points: 0,
        },
    });
}

export async function findOrCreateUserByPhone(phone: string): Promise<any> {
    return prisma.user.upsert({
        where: { phone },
        update: {},
        create: { phone, did: phone, role: "viewer", points: 0 },
    });
}

export async function findOrCreateUserByNostr(pubkey: string): Promise<{ user: any; isNew: boolean }> {
    const normalized = pubkey.toLowerCase();
    let user = await prisma.user.findFirst({ where: { nostrPubkey: normalized } });
    if (!user) {
        user = await prisma.user.create({
            data: { nostrPubkey: normalized, nickname: `nostr_${normalized.slice(0, 8)}`, role: "viewer", points: 0 },
        });
        return { user, isNew: true };
    }
    return { user, isNew: false };
}

export async function findOrCreateUserByEVMAddress(address: string, chainId?: number): Promise<{ user: any; isNew: boolean }> {
    const normalized = address.toLowerCase();
    let user = await prisma.user.findFirst({
        where: { address: { equals: normalized, mode: "insensitive" } },
    });
    if (!user) {
        user = await prisma.user.create({
            data: { address: normalized, nickname: `User_${normalized.slice(2, 8)}`, role: "viewer", points: 0 },
        });
        return { user, isNew: true };
    }
    return { user, isNew: false };
}

// ============== Email / SMS Sending ==============

export async function trySendEmail(to: string, subject: string, text: string, html: string, logger?: any): Promise<boolean> {
    const host = process.env.SMTP_HOST || "";
    const port = Number(process.env.SMTP_PORT || 0);
    const user = process.env.SMTP_USER || "";
    const pass = process.env.SMTP_PASS || "";
    const secure = (process.env.SMTP_SECURE || "true").toLowerCase() === "true";
    const from = process.env.SMTP_FROM || user || "no-reply@localhost";
    if (!host || !port || !user || !pass) {
        logger?.warn({ host, port, userSet: !!user, passSet: !!pass }, "SMTP 未配置，跳过真实发信");
        return false;
    }
    try {
        const nodemailer: any = await import("nodemailer");
        const transporter = nodemailer.createTransport({ host, port, secure, auth: { user, pass } });
        const info = await transporter.sendMail({ from, to, subject, text, html });
        logger?.info({ to, messageId: info?.messageId }, "SMTP 邮件已发送");
        return true;
    } catch (e: any) {
        logger?.error({ to, err: e?.message }, "SMTP 发送失败");
        return false;
    }
}

export async function trySendSms(phone: string, code: string, countryCode: string): Promise<boolean> {
    const provider = process.env.SMS_PROVIDER || "";
    const isDev = process.env.NODE_ENV !== "production";
    if (!provider || isDev) {
        console.info(`[SMS] Sending code to ${phone} (country: +${countryCode}): ${code}`);
        return true;
    }
    try {
        switch (provider) {
            case "twilio": {
                const accountSid = process.env.TWILIO_ACCOUNT_SID || "";
                const authToken = process.env.TWILIO_AUTH_TOKEN || "";
                const from = process.env.TWILIO_FROM_NUMBER || "";
                if (!accountSid || !authToken || !from) return false;
                const resp = await fetch(
                    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/x-www-form-urlencoded",
                            Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
                        },
                        body: new URLSearchParams({
                            To: phone, From: from,
                            Body: `[Nexus] Your verification code is: ${code}. Valid for 10 minutes.`,
                        }).toString(),
                    }
                );
                return resp.ok;
            }
            case "aliyun": {
                console.info(`[SMS:Aliyun] Would send code ${code} to ${phone}`);
                return true;
            }
            default:
                console.warn(`[SMS] Unknown provider: ${provider}`);
                return false;
        }
    } catch (e: any) {
        console.error(`[SMS] Send failed:`, e?.message);
        return false;
    }
}

export { prisma };

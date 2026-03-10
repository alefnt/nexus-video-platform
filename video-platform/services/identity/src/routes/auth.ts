// FILE: /video-platform/services/identity/src/routes/auth.ts
/**
 * Authentication Routes
 * JoyID, MetaMask, Email, Magic Link, Phone SMS, Twitter OAuth2, Google OAuth2, Nostr, and wallet binding.
 */

import type { FastifyInstance } from "fastify";
import { v4 as uuidv4 } from "uuid";
import { verifySignature } from "@joyid/ckb";
import type { AuthRequest, JoyIDAuthRequest, JWTClaims, VideoMeta } from "@video-platform/shared/types";
import { resolveBitDomain, reverseResolveAddress, checkBitAvailability } from "@video-platform/shared/web3/das";
import {
    JoyIDAuthRequestSchema, LegacyAuthRequestSchema,
    EmailAuthStartSchema, EmailAuthVerifySchema,
    EmailMagicStartSchema, EmailMagicConsumeSchema,
    PhoneAuthStartSchema, PhoneAuthVerifySchema,
} from "@video-platform/shared/validation/schemas";
import {
    setJoyIdNonce, getNonceIssuedAt, deleteNonceById,
    revokeJti,
    setTwitterPkce, getTwitterPkce, deleteTwitterPkce,
    setGoogleOAuthState, getGoogleOAuthState, deleteGoogleOAuthState,
    setTikTokOAuthState, getTikTokOAuthState, deleteTikTokOAuthState,
    setYouTubeOAuthState, getYouTubeOAuthState, deleteYouTubeOAuthState,
    setBilibiliOAuthState, getBilibiliOAuthState, deleteBilibiliOAuthState,
    setEmailCode, getEmailCode, deleteEmailCode,
    setSmsCode, getSmsCode, deleteSmsCode,
    setMagicLink, getMagicLink, deleteMagicLink,
    setBitBinding, getBitByDomain, getBitByAddress, deleteBitBinding, deleteBitByAddress,
} from "@video-platform/shared/stores/redis";
import {
    NONCE_TTL_MS, PKCE_TTL_MS, EMAIL_CODE_TTL_MS, MAGIC_LINK_TTL_MS, SMS_CODE_TTL_MS,
    TWITTER_CLIENT_ID, TWITTER_REDIRECT_URI, TWITTER_SCOPE,
    GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI, GOOGLE_SCOPE,
    TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET, TIKTOK_REDIRECT_URI, TIKTOK_SCOPE,
    YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, YOUTUBE_REDIRECT_URI, YOUTUBE_SCOPE,
    BILIBILI_CLIENT_ID, BILIBILI_CLIENT_SECRET, BILIBILI_REDIRECT_URI,
    ADMIN_USER_IDS, ADMIN_BIT_DOMAINS,
    base64url, generateCodeVerifier, computeCodeChallengeS256, generateNumericCode, isAdmin,
    buildJWTClaims, buildAuthResponse,
    findOrCreateUserByEmail, findOrCreateUserByPhone, findOrCreateUserByDid, findOrCreateUserByEVMAddress, findOrCreateUserByNostr,
    trySendEmail, trySendSms,
    prisma,
} from "../services/authService";
import { randomBytes } from "crypto";

export function registerAuthRoutes(app: FastifyInstance) {

    // ============== JoyID Nonce ==============
    app.get("/auth/joyid/nonce", {
        config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
        handler: async (_req: any, reply: any) => {
            const nonceId = uuidv4();
            const challenge = `vp-login:${nonceId}`;
            await setJoyIdNonce(nonceId, Date.now());
            return reply.send({ nonceId, challenge });
        },
    });

    // ============== Ethereum/EVM Wallet Login ==============
    app.post<{ Body: { address: string; chainId: number } }>("/auth/ethereum", async (req, reply) => {
        try {
            const { address, chainId } = req.body || {};
            if (!address || typeof address !== "string") {
                return reply.status(400).send({ error: "缺少钱包地址", code: "invalid_address" });
            }
            const { user, isNew } = await findOrCreateUserByEVMAddress(address, chainId);
            if (isNew) app.log.info({ address: address.toLowerCase(), userId: user.id }, "新 EVM 用户创建");
            const jti = uuidv4();
            const jwt = await app.jwt.sign({
                sub: user.id, ckb: address.toLowerCase(), eth: address.toLowerCase(),
                chainId, roles: [user.role], jti,
            });
            return reply.send({ jwt, user: { id: user.id, address: address.toLowerCase(), nickname: user.nickname, chainId } });
        } catch (e: any) {
            app.log.error({ err: e?.message }, "EVM 登录失败");
            return reply.status(500).send({ error: "登录失败", code: "login_failed" });
        }
    });

    // ============== Email Magic Link ==============
    app.post<{ Body: { email: string; deviceFingerprint: string } }>("/auth/email/magic/start", async (req, reply) => {
        try {
            const parsed = EmailMagicStartSchema.safeParse(req.body);
            if (!parsed.success) return reply.status(400).send({ error: "参数错误", code: "bad_request", details: parsed.error.flatten() });
            const { email, deviceFingerprint } = parsed.data;
            const key = email.toLowerCase();
            const token = base64url(randomBytes(32));
            await setMagicLink(token, { email: key, dfp: deviceFingerprint, issuedAt: Date.now() });
            const safeBase = (process.env.FRONTEND_URL || "http://localhost:5174").replace(/\/+$/, "");
            const link = `${safeBase}/#/magic?token=${encodeURIComponent(token)}`;
            app.log.info({ email, link }, "Email magic link issued");
            const isDev = process.env.NODE_ENV !== "production";
            const sent = await trySendEmail(email, "Video Platform 登录魔法链接", `点击登录：${link}`, `<p>点击登录：<a href="${link}">${link}</a></p>`, app.log);
            return reply.send({ delivered: sent ? "email" : (isDev ? "dev" : "email_failed"), expiresInMs: MAGIC_LINK_TTL_MS, ...(isDev ? { token, link } : {}) });
        } catch (err: any) {
            return reply.status(500).send({ error: err?.message || "发送魔法链接失败", code: "email_magic_start_error" });
        }
    });

    app.post<{ Body: { token: string } }>("/auth/email/magic/consume", async (req, reply) => {
        try {
            const parsed = EmailMagicConsumeSchema.safeParse(req.body);
            if (!parsed.success) return reply.status(400).send({ error: "参数错误", code: "bad_request", details: parsed.error.flatten() });
            const { token } = parsed.data;
            const rec = await getMagicLink(token);
            if (!rec) return reply.status(400).send({ error: "链接不存在或已使用", code: "link_not_found" });
            if (Date.now() - rec.issuedAt > MAGIC_LINK_TTL_MS) {
                await deleteMagicLink(token);
                return reply.status(400).send({ error: "链接已过期", code: "link_expired" });
            }
            await deleteMagicLink(token);
            const user = await findOrCreateUserByEmail(rec.email);
            const claims = buildJWTClaims(user.id, { dom: rec.email, dfp: rec.dfp });
            const jwtToken = await reply.jwtSign(claims, { algorithm: "HS256" as any });
            return reply.send(buildAuthResponse(jwtToken, user, claims, rec.dfp, Buffer.from("email_magic").toString("base64").slice(0, 44)));
        } catch (err: any) {
            return reply.status(500).send({ error: err?.message || "魔法链接登录失败", code: "email_magic_consume_error" });
        }
    });

    // ============== Email Code Login ==============
    app.post<{ Body: { email: string; deviceFingerprint: string } }>("/auth/email/start", async (req, reply) => {
        try {
            const parsed = EmailAuthStartSchema.safeParse(req.body);
            if (!parsed.success) return reply.status(400).send({ error: "参数错误", code: "bad_request", details: parsed.error.flatten() });
            const { email, deviceFingerprint } = parsed.data;
            const key = email.toLowerCase();
            const code = generateNumericCode(6);
            await setEmailCode(key, { code, dfp: deviceFingerprint, issuedAt: Date.now() });
            app.log.info({ email, code }, "Email login code issued");
            const isDev = process.env.NODE_ENV !== "production";
            const sent = await trySendEmail(email, "Video Platform 验证码登录", `验证码：${code}，有效期10分钟`, `<p>验证码：<b>${code}</b>，有效期10分钟</p>`, app.log);
            return reply.send({ delivered: sent ? "email" : (isDev ? "dev" : "email_failed"), expiresInMs: EMAIL_CODE_TTL_MS, ...(isDev ? { code } : {}) });
        } catch (err: any) {
            return reply.status(500).send({ error: err?.message || "发送验证码失败", code: "email_start_error" });
        }
    });

    app.post<{ Body: { email: string; code: string } }>("/auth/email/verify", async (req, reply) => {
        try {
            const parsed = EmailAuthVerifySchema.safeParse(req.body);
            if (!parsed.success) return reply.status(400).send({ error: "参数错误", code: "bad_request", details: parsed.error.flatten() });
            const { email, code } = parsed.data;
            const key = email.toLowerCase();
            const rec = await getEmailCode(key);
            if (!rec) return reply.status(400).send({ error: "验证码会话不存在", code: "code_not_found" });
            if (Date.now() - rec.issuedAt > EMAIL_CODE_TTL_MS) { await deleteEmailCode(key); return reply.status(400).send({ error: "验证码已过期", code: "code_expired" }); }
            if (rec.code !== code) return reply.status(400).send({ error: "验证码错误", code: "code_invalid" });
            await deleteEmailCode(key);
            const user = await findOrCreateUserByEmail(email);
            const claims = buildJWTClaims(user.id, { dom: email, dfp: rec.dfp });
            const jwtToken = await reply.jwtSign(claims, { algorithm: "HS256" as any });
            return reply.send(buildAuthResponse(jwtToken, user, claims, rec.dfp, Buffer.from("email_login").toString("base64").slice(0, 44)));
        } catch (err: any) {
            return reply.status(500).send({ error: err?.message || "邮箱登录失败", code: "email_verify_error" });
        }
    });

    // ============== Phone SMS Login ==============
    app.post<{ Body: { phone: string; countryCode: string; deviceFingerprint: string } }>("/auth/phone/start", async (req, reply) => {
        try {
            const parsed = PhoneAuthStartSchema.safeParse(req.body);
            if (!parsed.success) return reply.status(400).send({ error: "参数错误", code: "bad_request", details: parsed.error.flatten() });
            const { phone, countryCode, deviceFingerprint } = parsed.data;
            const code = generateNumericCode(6);
            await setSmsCode(phone, { code, dfp: deviceFingerprint, issuedAt: Date.now() });
            app.log.info({ phone, code }, "SMS login code issued");
            const isDev = process.env.NODE_ENV !== "production";
            const sent = await trySendSms(phone, code, countryCode);
            return reply.send({ delivered: sent ? "sms" : (isDev ? "dev" : "sms_failed"), expiresInMs: SMS_CODE_TTL_MS, ...(isDev ? { code } : {}) });
        } catch (err: any) {
            return reply.status(500).send({ error: err?.message || "发送验证码失败", code: "phone_start_error" });
        }
    });

    app.post<{ Body: { phone: string; code: string } }>("/auth/phone/verify", async (req, reply) => {
        try {
            const parsed = PhoneAuthVerifySchema.safeParse(req.body);
            if (!parsed.success) return reply.status(400).send({ error: "参数错误", code: "bad_request", details: parsed.error.flatten() });
            const { phone, code } = parsed.data;
            const rec = await getSmsCode(phone);
            if (!rec) return reply.status(400).send({ error: "验证码会话不存在", code: "code_not_found" });
            if (Date.now() - rec.issuedAt > SMS_CODE_TTL_MS) { await deleteSmsCode(phone); return reply.status(400).send({ error: "验证码已过期", code: "code_expired" }); }
            if (rec.code !== code) return reply.status(400).send({ error: "验证码错误", code: "code_invalid" });
            await deleteSmsCode(phone);
            const user = await findOrCreateUserByPhone(phone);
            const claims = buildJWTClaims(user.id, { dom: phone, dfp: rec.dfp });
            const jwtToken = await reply.jwtSign(claims, { algorithm: "HS256" as any });
            return reply.send(buildAuthResponse(jwtToken, user, claims, rec.dfp, Buffer.from("phone_login").toString("base64").slice(0, 44)));
        } catch (err: any) {
            return reply.status(500).send({ error: err?.message || "手机号登录失败", code: "phone_verify_error" });
        }
    });

    // ============== Twitter OAuth2 ==============
    app.get("/auth/twitter/start", async (req, reply) => {
        try {
            const dfp = ((req as any).query?.dfp || "") as string;
            if (!dfp) return reply.status(400).send({ error: "缺少设备指纹", code: "bad_request" });
            if (!TWITTER_CLIENT_ID) return reply.status(500).send({ error: "Twitter 配置未设置", code: "twitter_config_missing" });
            const state = uuidv4();
            const codeVerifier = generateCodeVerifier();
            const codeChallenge = computeCodeChallengeS256(codeVerifier);
            await setTwitterPkce(state, { codeVerifier, dfp, issuedAt: Date.now() });
            const params = new URLSearchParams({
                response_type: "code", client_id: TWITTER_CLIENT_ID, redirect_uri: TWITTER_REDIRECT_URI,
                scope: TWITTER_SCOPE, state, code_challenge: codeChallenge, code_challenge_method: "S256",
            });
            return reply.send({ authUrl: `https://twitter.com/i/oauth2/authorize?${params.toString()}`, state });
        } catch (err: any) {
            return reply.status(500).send({ error: err?.message || "Twitter 启动失败", code: "twitter_start_error" });
        }
    });

    app.post<{ Body: { code: string; state: string } }>("/auth/twitter/callback", async (req, reply) => {
        try {
            const { code, state } = (req.body || {}) as { code: string; state: string };
            if (!code || !state) return reply.status(400).send({ error: "缺少 code 或 state", code: "bad_request" });
            const rec = await getTwitterPkce(state);
            if (!rec) return reply.status(400).send({ error: "state 无效或已过期", code: "invalid_state" });
            if (Date.now() - rec.issuedAt > PKCE_TTL_MS) { await deleteTwitterPkce(state); return reply.status(400).send({ error: "登录会话已过期", code: "pkce_expired" }); }
            const body = new URLSearchParams({ client_id: TWITTER_CLIENT_ID, grant_type: "authorization_code", code, redirect_uri: TWITTER_REDIRECT_URI, code_verifier: rec.codeVerifier });
            const tokenResp = await fetch("https://api.twitter.com/2/oauth2/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: body.toString() });
            if (!tokenResp.ok) return reply.status(400).send({ error: "Twitter 令牌交换失败", code: "token_exchange_failed", details: await tokenResp.text() });
            const tokenJson: any = await tokenResp.json();
            const accessToken = tokenJson?.access_token;
            if (!accessToken) return reply.status(400).send({ error: "缺少 access_token", code: "token_missing" });
            const meResp = await fetch("https://api.twitter.com/2/users/me", { headers: { Authorization: `Bearer ${accessToken}` } });
            if (!meResp.ok) return reply.status(400).send({ error: "获取 Twitter 用户信息失败", code: "user_info_failed", details: await meResp.text() });
            const meJson: any = await meResp.json();
            const displayDomain = `@${meJson?.data?.username || "twitter-user"}`;
            const user = await findOrCreateUserByDid(displayDomain);
            const claims = buildJWTClaims(user.id, { dom: displayDomain, dfp: rec.dfp });
            const jwtToken = await reply.jwtSign(claims, { algorithm: "HS256" as any });
            await deleteTwitterPkce(state);
            return reply.send(buildAuthResponse(jwtToken, user, claims, rec.dfp, Buffer.from("twitter_oauth").toString("base64").slice(0, 44)));
        } catch (err: any) {
            return reply.status(500).send({ error: err?.message || "Twitter 回调处理失败", code: "twitter_callback_error" });
        }
    });

    // ============== Google OAuth2 ==============
    app.get("/auth/google/start", async (req, reply) => {
        try {
            const dfp = ((req as any).query?.dfp || "browser") as string;
            if (!GOOGLE_CLIENT_ID) return reply.status(500).send({ error: "Google 配置未设置", code: "google_config_missing" });
            const state = uuidv4();
            const codeVerifier = generateCodeVerifier();
            const codeChallenge = computeCodeChallengeS256(codeVerifier);
            await setGoogleOAuthState(state, { codeVerifier, dfp, issuedAt: Date.now() });
            const params = new URLSearchParams({
                response_type: "code", client_id: GOOGLE_CLIENT_ID, redirect_uri: GOOGLE_REDIRECT_URI,
                scope: GOOGLE_SCOPE, state, code_challenge: codeChallenge, code_challenge_method: "S256",
                access_type: "offline", prompt: "consent",
            });
            return reply.send({ authUrl: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`, state });
        } catch (err: any) {
            return reply.status(500).send({ error: err?.message || "Google 启动失败", code: "google_start_error" });
        }
    });

    app.post<{ Body: { code: string; state: string } }>("/auth/google/callback", async (req, reply) => {
        try {
            const { code, state } = (req.body || {}) as { code: string; state: string };
            if (!code || !state) return reply.status(400).send({ error: "缺少 code 或 state", code: "bad_request" });
            const rec = await getGoogleOAuthState(state);
            if (!rec) return reply.status(400).send({ error: "state 无效或已过期", code: "invalid_state" });
            if (Date.now() - rec.issuedAt > PKCE_TTL_MS) { await deleteGoogleOAuthState(state); return reply.status(400).send({ error: "登录会话已过期", code: "pkce_expired" }); }
            const body = new URLSearchParams({ client_id: GOOGLE_CLIENT_ID, client_secret: GOOGLE_CLIENT_SECRET, grant_type: "authorization_code", code, redirect_uri: GOOGLE_REDIRECT_URI, code_verifier: rec.codeVerifier });
            const tokenResp = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: body.toString() });
            if (!tokenResp.ok) return reply.status(400).send({ error: "Google 令牌交换失败", code: "token_exchange_failed", details: await tokenResp.text() });
            const tokenJson: any = await tokenResp.json();
            const accessToken = tokenJson?.access_token;
            if (!accessToken) return reply.status(400).send({ error: "缺少 access_token", code: "token_missing" });
            const userInfoResp = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", { headers: { Authorization: `Bearer ${accessToken}` } });
            if (!userInfoResp.ok) return reply.status(400).send({ error: "获取 Google 用户信息失败", code: "user_info_failed", details: await userInfoResp.text() });
            const userInfo: any = await userInfoResp.json();
            const googleEmail = userInfo?.email || "";
            if (!googleEmail) return reply.status(400).send({ error: "Google 账户未提供邮箱", code: "no_email" });
            const user = await findOrCreateUserByEmail(googleEmail, { nickname: userInfo?.name, avatar: userInfo?.picture });
            const claims = buildJWTClaims(user.id, { dom: googleEmail, dfp: rec.dfp });
            const jwtToken = await reply.jwtSign(claims, { algorithm: "HS256" as any });
            await deleteGoogleOAuthState(state);
            return reply.send(buildAuthResponse(jwtToken, user, claims, rec.dfp, Buffer.from("google_oauth").toString("base64").slice(0, 44)));
        } catch (err: any) {
            return reply.status(500).send({ error: err?.message || "Google 回调处理失败", code: "google_callback_error" });
        }
    });

    // ============== TikTok OAuth2 ==============
    app.get("/auth/tiktok/start", async (req, reply) => {
        try {
            const dfp = ((req as any).query?.dfp || "browser") as string;
            if (!TIKTOK_CLIENT_KEY) return reply.status(500).send({ error: "TikTok 配置未设置", code: "tiktok_config_missing" });
            const state = uuidv4();
            const codeVerifier = generateCodeVerifier();
            const codeChallenge = computeCodeChallengeS256(codeVerifier);
            await setTikTokOAuthState(state, { codeVerifier, dfp, issuedAt: Date.now() });
            const params = new URLSearchParams({
                client_key: TIKTOK_CLIENT_KEY,
                response_type: "code",
                scope: TIKTOK_SCOPE,
                redirect_uri: TIKTOK_REDIRECT_URI,
                state,
                code_challenge: codeChallenge,
                code_challenge_method: "S256",
            });
            return reply.send({ authUrl: `https://www.tiktok.com/v2/auth/authorize/?${params.toString()}`, state });
        } catch (err: any) {
            return reply.status(500).send({ error: err?.message || "TikTok 启动失败", code: "tiktok_start_error" });
        }
    });

    app.post<{ Body: { code: string; state: string } }>("/auth/tiktok/callback", async (req, reply) => {
        try {
            const { code, state } = (req.body || {}) as { code: string; state: string };
            if (!code || !state) return reply.status(400).send({ error: "缺少 code 或 state", code: "bad_request" });
            const rec = await getTikTokOAuthState(state);
            if (!rec) return reply.status(400).send({ error: "state 无效或已过期", code: "invalid_state" });
            if (Date.now() - rec.issuedAt > PKCE_TTL_MS) { await deleteTikTokOAuthState(state); return reply.status(400).send({ error: "登录会话已过期", code: "pkce_expired" }); }

            // Exchange code for access token
            const tokenResp = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: new URLSearchParams({
                    client_key: TIKTOK_CLIENT_KEY,
                    client_secret: TIKTOK_CLIENT_SECRET,
                    code,
                    grant_type: "authorization_code",
                    redirect_uri: TIKTOK_REDIRECT_URI,
                    code_verifier: rec.codeVerifier,
                }).toString(),
            });
            if (!tokenResp.ok) return reply.status(400).send({ error: "TikTok 令牌交换失败", code: "token_exchange_failed", details: await tokenResp.text() });
            const tokenJson: any = await tokenResp.json();
            const accessToken = tokenJson?.data?.access_token;
            if (!accessToken) return reply.status(400).send({ error: "缺少 access_token", code: "token_missing" });

            // Fetch user info
            const userResp = await fetch("https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,avatar_url,username", {
                headers: { "Authorization": `Bearer ${accessToken}` },
            });
            const userJson: any = userResp.ok ? await userResp.json() : {};
            const tiktokUser = userJson?.data?.user || {};
            const displayName = tiktokUser.display_name || tiktokUser.username || "TikTok User";
            const tiktokId = tiktokUser.open_id || tokenJson?.data?.open_id || uuidv4();

            const user = await findOrCreateUserByDid(`tiktok:${tiktokId}`, { nickname: displayName, avatar: tiktokUser.avatar_url });
            const claims = buildJWTClaims(user.id, { dom: `tiktok:${displayName}`, dfp: rec.dfp });
            const jwtToken = await reply.jwtSign(claims, { algorithm: "HS256" as any });
            await deleteTikTokOAuthState(state);
            return reply.send(buildAuthResponse(jwtToken, user, claims, rec.dfp, Buffer.from("tiktok_oauth").toString("base64").slice(0, 44)));
        } catch (err: any) {
            return reply.status(500).send({ error: err?.message || "TikTok 回调处理失败", code: "tiktok_callback_error" });
        }
    });

    // ============== YouTube OAuth2 ==============
    app.get("/auth/youtube/start", async (req, reply) => {
        try {
            const dfp = ((req as any).query?.dfp || "browser") as string;
            if (!YOUTUBE_CLIENT_ID) return reply.status(500).send({ error: "YouTube 配置未设置", code: "youtube_config_missing" });
            const state = uuidv4();
            const codeVerifier = generateCodeVerifier();
            const codeChallenge = computeCodeChallengeS256(codeVerifier);
            await setYouTubeOAuthState(state, { codeVerifier, dfp, issuedAt: Date.now() });
            const params = new URLSearchParams({
                response_type: "code",
                client_id: YOUTUBE_CLIENT_ID,
                redirect_uri: YOUTUBE_REDIRECT_URI,
                scope: YOUTUBE_SCOPE,
                state,
                code_challenge: codeChallenge,
                code_challenge_method: "S256",
                access_type: "offline",
                prompt: "consent",
            });
            return reply.send({ authUrl: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`, state });
        } catch (err: any) {
            return reply.status(500).send({ error: err?.message || "YouTube 启动失败", code: "youtube_start_error" });
        }
    });

    app.post<{ Body: { code: string; state: string } }>("/auth/youtube/callback", async (req, reply) => {
        try {
            const { code, state } = (req.body || {}) as { code: string; state: string };
            if (!code || !state) return reply.status(400).send({ error: "缺少 code 或 state", code: "bad_request" });
            const rec = await getYouTubeOAuthState(state);
            if (!rec) return reply.status(400).send({ error: "state 无效或已过期", code: "invalid_state" });
            if (Date.now() - rec.issuedAt > PKCE_TTL_MS) { await deleteYouTubeOAuthState(state); return reply.status(400).send({ error: "登录会话已过期", code: "pkce_expired" }); }

            const tokenResp = await fetch("https://oauth2.googleapis.com/token", {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: new URLSearchParams({
                    client_id: YOUTUBE_CLIENT_ID,
                    client_secret: YOUTUBE_CLIENT_SECRET,
                    grant_type: "authorization_code",
                    code,
                    redirect_uri: YOUTUBE_REDIRECT_URI,
                    code_verifier: rec.codeVerifier,
                }).toString(),
            });
            if (!tokenResp.ok) return reply.status(400).send({ error: "YouTube 令牌交换失败", code: "token_exchange_failed", details: await tokenResp.text() });
            const tokenJson: any = await tokenResp.json();
            const accessToken = tokenJson?.access_token;
            if (!accessToken) return reply.status(400).send({ error: "缺少 access_token", code: "token_missing" });

            // Get YouTube channel info
            const channelResp = await fetch("https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true", {
                headers: { "Authorization": `Bearer ${accessToken}` },
            });
            let channelName = "YouTube User";
            let channelAvatar = "";
            let youtubeEmail = "";
            if (channelResp.ok) {
                const channelJson: any = await channelResp.json();
                const ch = channelJson?.items?.[0]?.snippet;
                if (ch) {
                    channelName = ch.title || channelName;
                    channelAvatar = ch.thumbnails?.default?.url || "";
                }
            }

            // Also get email from Google userinfo
            const userInfoResp = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", { headers: { Authorization: `Bearer ${accessToken}` } });
            if (userInfoResp.ok) {
                const userInfo: any = await userInfoResp.json();
                youtubeEmail = userInfo?.email || "";
            }

            const user = youtubeEmail
                ? await findOrCreateUserByEmail(youtubeEmail, { nickname: channelName, avatar: channelAvatar })
                : await findOrCreateUserByDid(`youtube:${channelName}`, { nickname: channelName, avatar: channelAvatar });
            const claims = buildJWTClaims(user.id, { dom: youtubeEmail || `youtube:${channelName}`, dfp: rec.dfp });
            const jwtToken = await reply.jwtSign(claims, { algorithm: "HS256" as any });
            await deleteYouTubeOAuthState(state);
            return reply.send(buildAuthResponse(jwtToken, user, claims, rec.dfp, Buffer.from("youtube_oauth").toString("base64").slice(0, 44)));
        } catch (err: any) {
            return reply.status(500).send({ error: err?.message || "YouTube 回调处理失败", code: "youtube_callback_error" });
        }
    });

    // ============== Bilibili OAuth2 ==============
    app.get("/auth/bilibili/start", async (req, reply) => {
        try {
            const dfp = ((req as any).query?.dfp || "browser") as string;
            if (!BILIBILI_CLIENT_ID) return reply.status(500).send({ error: "Bilibili 配置未设置", code: "bilibili_config_missing" });
            const state = uuidv4();
            const codeVerifier = generateCodeVerifier();
            await setBilibiliOAuthState(state, { codeVerifier, dfp, issuedAt: Date.now() });
            const params = new URLSearchParams({
                client_id: BILIBILI_CLIENT_ID,
                response_type: "code",
                redirect_uri: BILIBILI_REDIRECT_URI,
                state,
            });
            return reply.send({ authUrl: `https://passport.bilibili.com/register/verification.html?${params.toString()}`, state });
        } catch (err: any) {
            return reply.status(500).send({ error: err?.message || "Bilibili 启动失败", code: "bilibili_start_error" });
        }
    });

    app.post<{ Body: { code: string; state: string } }>("/auth/bilibili/callback", async (req, reply) => {
        try {
            const { code, state } = (req.body || {}) as { code: string; state: string };
            if (!code || !state) return reply.status(400).send({ error: "缺少 code 或 state", code: "bad_request" });
            const rec = await getBilibiliOAuthState(state);
            if (!rec) return reply.status(400).send({ error: "state 无效或已过期", code: "invalid_state" });
            if (Date.now() - rec.issuedAt > PKCE_TTL_MS) { await deleteBilibiliOAuthState(state); return reply.status(400).send({ error: "登录会话已过期", code: "pkce_expired" }); }

            // Exchange code for access token
            const tokenResp = await fetch("https://api.bilibili.com/x/account-oauth2/v1/token", {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: new URLSearchParams({
                    client_id: BILIBILI_CLIENT_ID,
                    client_secret: BILIBILI_CLIENT_SECRET,
                    grant_type: "authorization_code",
                    code,
                    redirect_uri: BILIBILI_REDIRECT_URI,
                }).toString(),
            });
            if (!tokenResp.ok) return reply.status(400).send({ error: "Bilibili 令牌交换失败", code: "token_exchange_failed", details: await tokenResp.text() });
            const tokenJson: any = await tokenResp.json();
            const accessToken = tokenJson?.data?.access_token || tokenJson?.access_token;
            if (!accessToken) return reply.status(400).send({ error: "缺少 access_token", code: "token_missing" });

            // Fetch Bilibili user info
            const userResp = await fetch("https://api.bilibili.com/x/space/v2/myinfo", {
                headers: { "Authorization": `Bearer ${accessToken}` },
            });
            let biliName = "Bilibili User";
            let biliAvatar = "";
            let biliMid = "";
            if (userResp.ok) {
                const userJson: any = await userResp.json();
                const profile = userJson?.data?.profile || userJson?.data || {};
                biliName = profile.name || profile.uname || biliName;
                biliAvatar = profile.face || "";
                biliMid = String(profile.mid || "");
            }

            const user = await findOrCreateUserByDid(`bilibili:${biliMid || uuidv4()}`, { nickname: biliName, avatar: biliAvatar });
            const claims = buildJWTClaims(user.id, { dom: `bilibili:${biliName}`, dfp: rec.dfp });
            const jwtToken = await reply.jwtSign(claims, { algorithm: "HS256" as any });
            await deleteBilibiliOAuthState(state);
            return reply.send(buildAuthResponse(jwtToken, user, claims, rec.dfp, Buffer.from("bilibili_oauth").toString("base64").slice(0, 44)));
        } catch (err: any) {
            return reply.status(500).send({ error: err?.message || "Bilibili 回调处理失败", code: "bilibili_callback_error" });
        }
    });

    // ============== JoyID Login (Primary) ==============
    app.post<{ Body: JoyIDAuthRequest | AuthRequest }>("/auth/joyid", async (req, reply) => {
        try {
            const body = req.body as JoyIDAuthRequest | AuthRequest;
            if ((body as any).signatureData) {
                const parsed = JoyIDAuthRequestSchema.safeParse(body);
                if (!parsed.success) return reply.status(400).send({ error: "参数错误", code: "bad_request", details: parsed.error.flatten() });
                const { signatureData, deviceFingerprint, bitDomain, address, authType } = parsed.data;
                const isCCCAuth = authType === "ccc";
                if (!signatureData || !deviceFingerprint) return reply.status(400).send({ error: "缺少参数", code: "bad_request" });

                const challenge = signatureData.challenge;
                const nonceId = challenge?.startsWith("vp-login:") ? challenge.slice("vp-login:".length) : "";
                const issuedAt = await getNonceIssuedAt(nonceId);
                if (!issuedAt) return reply.status(400).send({ error: "无效或已使用的挑战", code: "invalid_challenge" });
                if (Date.now() - issuedAt > NONCE_TTL_MS) { await deleteNonceById(nonceId); return reply.status(400).send({ error: "挑战已过期", code: "challenge_expired" }); }

                if (isCCCAuth) {
                    if (!address) return reply.status(400).send({ error: "CCC 登录需要提供地址", code: "missing_address" });
                    app.log.info({ address, authType: "ccc" }, "CCC wallet login accepted");
                } else {
                    const ok = await verifySignature(signatureData as any);
                    if (!ok) return reply.status(401).send({ error: "签名验证失败", code: "verify_failed" });
                }

                const isDev = ADMIN_USER_IDS.includes(address || "") || ADMIN_BIT_DOMAINS.includes((bitDomain || "").toLowerCase());
                if (address && bitDomain && !isDev) {
                    const byDomain = await resolveBitDomain(bitDomain);
                    if ((byDomain.ckbAddress || "") !== address) {
                        return reply.status(400).send({ error: `域名 ${bitDomain} 解析地址与提交地址不一致`, code: "address_domain_mismatch" });
                    }
                }
                await deleteNonceById(nonceId);

                const resolved = address ? { ckbAddress: address } : (bitDomain ? await resolveBitDomain(bitDomain) : { ckbAddress: "" });
                if (!resolved.ckbAddress) return reply.status(400).send({ error: "缺少 CKB 地址", code: "missing_ckb" });
                const rev = (!bitDomain && resolved.ckbAddress) ? await reverseResolveAddress(resolved.ckbAddress) : { domain: null };
                const finalDomain = bitDomain || rev.domain || "";

                let user = await prisma.user.findUnique({ where: { address: resolved.ckbAddress } });
                if (user) {
                    if (user.did && finalDomain && user.did !== finalDomain) {
                        return reply.status(400).send({ error: `此钱包已绑定 ${user.did}，与当前输入的 ${finalDomain} 不一致`, code: "did_mismatch", existingDid: user.did, requestedDid: finalDomain });
                    }
                    if (!user.did && finalDomain) {
                        const didTaken = await prisma.user.findUnique({ where: { did: finalDomain } });
                        if (didTaken) return reply.status(400).send({ error: `${finalDomain} 已被其他钱包绑定`, code: "did_taken", requestedDid: finalDomain });
                        user = await prisma.user.update({ where: { id: user.id }, data: { did: finalDomain } });
                    }
                } else {
                    if (finalDomain) {
                        const existingDidUser = await prisma.user.findUnique({ where: { did: finalDomain } });
                        if (existingDidUser) return reply.status(400).send({ error: `${finalDomain} 已被其他钱包绑定`, code: "did_taken", requestedDid: finalDomain });
                    }
                    user = await prisma.user.create({ data: { address: resolved.ckbAddress, did: finalDomain || undefined, role: "viewer", points: 0 } });
                }

                const claims = buildJWTClaims(user.id, { dom: finalDomain, ckb: resolved.ckbAddress, dfp: deviceFingerprint });
                const jwtToken = await reply.jwtSign(claims, { algorithm: "HS256" as any });
                const pubkey = signatureData.pubkey ? Buffer.from(signatureData.pubkey).toString("base64").slice(0, 44) : "";
                return reply.send(buildAuthResponse(jwtToken, user, claims, deviceFingerprint, pubkey));
            }

            // Legacy mock login
            const legacyParsed = LegacyAuthRequestSchema.safeParse(body);
            if (!legacyParsed.success) return reply.status(400).send({ error: "参数错误", code: "bad_request", details: legacyParsed.error.flatten() });
            const { bitDomain, joyIdAssertion, deviceFingerprint } = legacyParsed.data;
            const resolved = await resolveBitDomain(bitDomain);
            let user: any;
            if (resolved.ckbAddress) {
                user = await prisma.user.upsert({ where: { address: resolved.ckbAddress }, update: { did: bitDomain }, create: { address: resolved.ckbAddress, did: bitDomain, role: "viewer", points: 0 } });
            } else {
                user = await prisma.user.upsert({ where: { did: bitDomain }, update: {}, create: { did: bitDomain, role: "viewer", points: 0 } });
            }
            const claims = buildJWTClaims(user.id, { dom: bitDomain, ckb: resolved.ckbAddress, dfp: deviceFingerprint });
            const jwtToken = await reply.jwtSign(claims, { algorithm: "HS256" as any });
            return reply.send(buildAuthResponse(jwtToken, user, claims, deviceFingerprint, Buffer.from(joyIdAssertion).toString("base64").slice(0, 44)));
        } catch (err: any) {
            console.error("[AUTH JOYID ERROR]", err, err?.stack);
            return reply.status(500).send({ error: err?.message || "登录错误", code: "auth_error" });
        }
    });

    // ============== Token Refresh ==============
    app.post("/auth/refresh", async (req, reply) => {
        try { await req.jwtVerify(); } catch { return reply.status(401).send({ error: "未授权", code: "unauthorized" }); }
        const claims = (req.user || {}) as JWTClaims;
        const now = Math.floor(Date.now() / 1000);
        const newClaims: JWTClaims = { ...claims, iat: now, exp: now + 60 * 60, jti: uuidv4() };
        const token = await reply.jwtSign(newClaims, { algorithm: "HS256" as any });
        return reply.send({ jwt: token, exp: newClaims.exp });
    });

    // ============== Wallet Binding ==============
    app.post<{ Body: { ckbAddress: string; nostrPubkey?: string } }>("/auth/bind-wallet", async (req, reply) => {
        try { await req.jwtVerify(); } catch { return reply.status(401).send({ error: "Not authenticated", code: "unauthorized" }); }
        const claims = (req.user || {}) as JWTClaims;
        const userId = claims?.sub;
        if (!userId) return reply.status(400).send({ error: "Invalid token", code: "bad_token" });
        const { ckbAddress, nostrPubkey } = req.body || {};
        if (!ckbAddress || typeof ckbAddress !== "string") return reply.status(400).send({ error: "Missing CKB address", code: "bad_request" });
        const existing = await prisma.user.findFirst({ where: { address: ckbAddress } });
        if (existing && existing.id !== userId) return reply.status(409).send({ error: "Address already bound to another account", code: "address_taken" });
        await prisma.user.update({ where: { id: userId }, data: { address: ckbAddress, ...(nostrPubkey ? { nostrPubkey } : {}) } });
        const now = Math.floor(Date.now() / 1000);
        const jti = uuidv4();
        const newClaims: JWTClaims = { sub: userId, dom: claims.dom || "", ckb: ckbAddress, dfp: claims.dfp || "", iat: now, exp: now + 60 * 60 * 12, jti };
        const newToken = await reply.jwtSign(newClaims, { algorithm: "HS256" as any });
        app.log.info({ userId, ckbAddress, nostrPubkey: !!nostrPubkey }, "Wallet bound to account");
        return reply.send({ jwt: newToken, walletBound: true, ckbAddress, nostrPubkey: nostrPubkey || null });
    });

    // ============== Nostr Login ==============
    app.post<{ Body: { pubkey: string; signature: string; event: any } }>("/auth/nostr", async (req, reply) => {
        try {
            const { pubkey, signature } = req.body || {};
            if (!pubkey || !signature) return reply.status(400).send({ error: "Missing pubkey or signature", code: "bad_request" });
            const { user, isNew } = await findOrCreateUserByNostr(pubkey);
            if (isNew) app.log.info({ pubkey: pubkey.toLowerCase(), userId: user.id }, "New Nostr user created");
            const claims = buildJWTClaims(user.id, { dom: `nostr:${pubkey.toLowerCase().slice(0, 16)}`, ckb: user.address || "" });
            const jwtToken = await reply.jwtSign(claims, { algorithm: "HS256" as any });
            return reply.send(buildAuthResponse(jwtToken, user, claims, "nostr", pubkey.toLowerCase()));
        } catch (err: any) {
            return reply.status(500).send({ error: err?.message || "Nostr login failed", code: "nostr_auth_error" });
        }
    });

    // ============== Token Revocation ==============
    app.post("/auth/revoke", async (req, reply) => {
        try { await req.jwtVerify(); } catch { return reply.status(401).send({ error: "未授权", code: "unauthorized" }); }
        const claims = (req.user || {}) as JWTClaims;
        if (!claims?.jti) return reply.status(400).send({ error: "缺少 jti", code: "bad_request" });
        await revokeJti(claims.jti);
        return reply.send({ revoked: true, jti: claims.jti });
    });

    // ============== .bit Domain Management ==============
    app.get("/auth/bit/check", async (req, reply) => {
        const qs = (req.query || {}) as any;
        const domain = String(qs.domain || "").trim().toLowerCase();
        if (!domain.endsWith(".bit")) return reply.status(400).send({ error: "域名格式不正确", code: "bad_domain" });
        const boundTo = await getBitByDomain(domain);
        let registered = false;
        try { const r = await checkBitAvailability(domain); registered = !!r.registered; } catch { registered = false; }
        return reply.send({ domain, unique: !boundTo, registered, boundTo });
    });

    app.post("/auth/bit/bind", async (req, reply) => {
        try { await req.jwtVerify(); } catch { return reply.status(401).send({ error: "未授权", code: "unauthorized" }); }
        const claims = (req.user || {}) as JWTClaims;
        const body: any = req.body || {};
        const domain = String(body.domain || "").trim().toLowerCase();
        if (!domain.endsWith(".bit")) return reply.status(400).send({ error: "域名格式不正确", code: "bad_domain" });
        const addr = claims.ckb || "";
        if (!addr) return reply.status(400).send({ error: "请先使用 JoyID 登录", code: "require_joyid_login" });
        const existing = await getBitByDomain(domain);
        if (existing && existing !== addr) return reply.status(400).send({ error: "域名已被其他地址绑定", code: "domain_taken", details: { domain, boundTo: existing } });
        await setBitBinding(domain, addr);
        return reply.send({ domain, boundTo: addr, ok: true });
    });

    app.post("/auth/bit/unbind", async (req, reply) => {
        try { await req.jwtVerify(); } catch { return reply.status(401).send({ error: "未授权", code: "unauthorized" }); }
        const claims = (req.user || {}) as JWTClaims;
        const body: any = req.body || {};
        const domainRaw = String(body.domain || "").trim().toLowerCase();
        const addr = claims.ckb || "";
        if (!addr) return reply.status(400).send({ error: "请先使用 JoyID 登录", code: "require_joyid_login" });
        if (domainRaw && domainRaw.endsWith(".bit")) {
            const boundAddr = await getBitByDomain(domainRaw);
            await deleteBitBinding(domainRaw, boundAddr || undefined);
            return reply.send({ domain: domainRaw, ok: true });
        }
        const boundDomain = await getBitByAddress(addr);
        if (boundDomain) { await deleteBitBinding(boundDomain, addr); return reply.send({ domain: boundDomain, ok: true }); }
        return reply.send({ ok: true });
    });

    app.get("/auth/bit/reverse", async (req, reply) => {
        const qs = (req.query || {}) as any;
        const address = String(qs.address || "").trim();
        if (!address) return reply.status(400).send({ error: "Missing address", code: "bad_request" });
        let domain: string | null = null;
        try { domain = await getBitByAddress(address); } catch { /* ignore */ }
        if (!domain) { try { const user = await prisma.user.findUnique({ where: { address } }); if (user?.did && user.did.endsWith(".bit")) domain = user.did; } catch { /* ignore */ } }
        if (!domain) { try { const rev = await reverseResolveAddress(address); if (rev?.domain) domain = rev.domain; } catch { /* ignore */ } }
        return reply.send({ address, domain });
    });

    // ============== Creator Stats ==============
    app.get("/creator/stats", async (req, reply) => {
        try { await req.jwtVerify(); } catch { return reply.status(401).send({ error: "未授权", code: "unauthorized" }); }
        const claims = (req.user || {}) as JWTClaims;
        try {
            const metadataBase = process.env.METADATA_URL || "http://localhost:8093";
            const contentBase = process.env.CONTENT_URL || "http://localhost:8092";
            const metasResp = await fetch(`${metadataBase}/metadata/list`);
            if (!metasResp.ok) return reply.status(500).send({ error: "元数据服务不可用", code: "metadata_unavailable" });
            const metas = (await metasResp.json()) as VideoMeta[];
            let filtered = metas;
            if (claims.ckb) filtered = metas.filter(m => m.creatorCkbAddress === claims.ckb);
            else if (claims.dom) filtered = metas.filter(m => m.creatorBitDomain === claims.dom);
            const totalUploads = filtered.length;
            const now = Date.now();
            const sevenDays = 7 * 24 * 60 * 60 * 1000;
            const uploads7d = filtered.filter(m => { const t = new Date(m.createdAt).getTime(); return Number.isFinite(t) && now - t <= sevenDays; }).length;
            const cfMetas = filtered.filter(m => (m.cdnUrl || "").includes("videodelivery.net"));
            const uids = cfMetas.map(m => { try { return new URL(m.cdnUrl).pathname.split("/").filter(Boolean)[0]; } catch { return undefined; } }).filter(Boolean) as string[];
            const cfTotal = uids.length;
            const authHeader = (req.headers["authorization"] || "") as string;
            const results = await Promise.all(uids.map(uid => fetch(`${contentBase}/content/cf/status/${uid}`, { headers: { Authorization: authHeader } }).then(r => r.ok ? r.json() : { uid, readyToStream: true }).catch(() => ({ uid, readyToStream: true }))));
            const cfReady = results.filter(r => r?.readyToStream === true).length;
            const cfTranscoding = results.filter(r => r?.readyToStream === false).length;
            const completionRate = cfTotal ? Math.round((cfReady / cfTotal) * 100) : 100;
            return reply.send({ totalUploads, uploads7d, cfTotal, cfTranscoding, cfReady, completionRate });
        } catch (err: any) {
            return reply.status(500).send({ error: err?.message || "统计聚合失败", code: "creator_stats_error" });
        }
    });
}

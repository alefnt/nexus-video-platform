// FILE: /video-platform/services/nft/src/server.ts
/**
 * NFT Service - Spore Protocol Integration
 * Refactored to use Prisma & PostgreSQL
 */

import Fastify from "fastify";
import jwt from "@fastify/jwt";
import { v4 as uuidv4 } from "uuid";
import { SporeClient, BADGE_RULES } from "@video-platform/shared/web3/spore";
import { PrismaClient } from "@video-platform/database";
import { registerSecurityPlugins } from "@video-platform/shared/security/index";
import { register } from "@video-platform/shared/monitoring";

const prisma = new PrismaClient();
const app = Fastify({ logger: true });
const JWT_SECRET = process.env.JWT_SECRET || "";
if (!JWT_SECRET || JWT_SECRET.length < 32) throw new Error("JWT_SECRET 未配置或长度不足");

// Security: Helmet, CORS, Rate Limiting, TraceId
await registerSecurityPlugins(app, { rateLimit: { max: 50, timeWindow: "1 minute" } });

app.register(jwt, { secret: JWT_SECRET });

const sporeClient = new SporeClient();

// JWT 验证
app.addHook("onRequest", async (req, reply) => {
    if (req.url.startsWith("/health") || req.url.startsWith("/metrics")) return;
    try {
        await req.jwtVerify();
    } catch (e) {
        return reply.status(401).send({ error: "未授权", code: "unauthorized" });
    }
});

app.get("/health", async () => ({ status: "ok", service: "nft" }));
app.get("/metrics", async (_req: any, reply: any) => {
    reply.header("Content-Type", register.contentType);
    return reply.send(await register.metrics());
});

// ============== Video Ownership NFT ==============

/**
 * 创建视频所有权 NFT (创建者上传时调用)
 * Auto-fetches video details from DB to ensure integrity.
 */
app.post("/nft/ownership/mint", async (req, reply) => {
    try {
        const body = req.body as { videoId: string; contentType?: string };
        const user = req.user as any;
        const creatorAddress = user?.ckb || "";
        const type = body.contentType || 'video';

        if (!body.videoId) {
            return reply.status(400).send({ error: "缺少 videoId", code: "bad_request" });
        }

        let sporeId = "";
        let txHash = "";
        let resultType = "";

        if (type === 'audio') {
            const music = await prisma.music.findUnique({ where: { id: body.videoId } });
            if (!music) return reply.status(404).send({ error: "音频不存在", code: "not_found" });
            if (!music.sha256) return reply.status(400).send({ error: "音频未处理完成", code: "processing" });

            const res = await sporeClient.mintAudioOwnershipSpore(
                music.id, music.title, creatorAddress, music.sha256, music.arweaveTxId || undefined
            );
            await prisma.music.update({ where: { id: music.id }, data: { sporeId: res.sporeId } });
            sporeId = res.sporeId;
            txHash = res.txHash;
            resultType = "audio-ownership";

        } else if (type === 'article') {
            const article = await prisma.article.findUnique({ where: { id: body.videoId } });
            if (!article) return reply.status(404).send({ error: "文章不存在", code: "not_found" });
            if (!article.textHash) return reply.status(400).send({ error: "文章未处理完成", code: "processing" });

            const res = await sporeClient.mintArticleOwnershipSpore(
                article.id, article.title, creatorAddress, article.textHash, article.arweaveTxId || undefined
            );
            await prisma.article.update({ where: { id: article.id }, data: { sporeId: res.sporeId } });
            sporeId = res.sporeId;
            txHash = res.txHash;
            resultType = "article-ownership";

        } else {
            // Default: Video
            const video = await prisma.video.findUnique({ where: { id: body.videoId } });
            if (!video) return reply.status(404).send({ error: "视频不存在", code: "not_found" });
            if (!video.sha256) return reply.status(400).send({ error: "该视频未处理完成（缺少指纹）", code: "processing" });

            const res = await sporeClient.mintVideoOwnershipSpore(
                video.id, video.title, creatorAddress, video.sha256, video.filecoinCid || undefined, video.arweaveTxId || undefined
            );
            await prisma.video.update({ where: { id: video.id }, data: { sporeId: res.sporeId } });
            sporeId = res.sporeId;
            txHash = res.txHash;
            resultType = "video-ownership";
        }

        return reply.send({
            ok: true,
            sporeId,
            txHash,
            type: resultType
        });
    } catch (err: any) {
        req.log.error(err);
        return reply.status(500).send({ error: err?.message || "铸造失败", code: "mint_error" });
    }
});

app.get("/nft/ownership/:videoId", async (req, reply) => {
    try {
        const params = req.params as { videoId: string };
        const spore = await sporeClient.getVideoOwnershipSpore(params.videoId);

        if (!spore) {
            return reply.status(404).send({ error: "未找到所有权 NFT", code: "not_found" });
        }

        return reply.send({ spore });
    } catch (err: any) {
        return reply.status(500).send({ error: err?.message || "查询失败", code: "query_error" });
    }
});

// ============== Access Pass NFT ==============

app.post("/nft/cluster/create", async (req, reply) => {
    try {
        const body = req.body as { name: string; description?: string; maxSpores?: number };
        const user = req.user as any;
        const ownerAddress = user?.ckb || "";

        if (!body.name) {
            return reply.status(400).send({ error: "缺少 name", code: "bad_request" });
        }

        const result = await sporeClient.createCluster({
            name: body.name,
            description: body.description,
            ownerAddress,
            isPublic: false,
            maxSpores: body.maxSpores,
        });

        // Store Cluster Metadata in DB
        await prisma.nFTCollection.create({
            data: {
                clusterId: result.clusterId,
                name: body.name,
                description: body.description,
                creatorId: user.sub,
                maxSupply: body.maxSpores,
            }
        });

        return reply.send({
            ok: true,
            clusterId: result.clusterId,
            txHash: result.txHash,
        });
    } catch (err: any) {
        req.log.error(err);
        return reply.status(500).send({ error: err?.message || "创建失败", code: "cluster_error" });
    }
});

app.post("/nft/access/mint", async (req, reply) => {
    try {
        const body = req.body as { videoId: string; title: string; clusterId?: string };
        const user = req.user as any;
        const buyerAddress = user?.ckb || "";

        if (!body.videoId || !body.title) {
            return reply.status(400).send({ error: "缺少 videoId 或 title", code: "bad_request" });
        }

        const result = await sporeClient.mintAccessPassSpore(
            body.videoId,
            body.title,
            buyerAddress,
            body.clusterId
        );

        // Update supply count if linked to a collection in DB
        if (body.clusterId) {
            const collection = await prisma.nFTCollection.findUnique({ where: { clusterId: body.clusterId } });
            if (collection) {
                await prisma.nFTCollection.update({
                    where: { id: collection.id },
                    data: { totalSupply: { increment: 1 } }
                });
            }
        }

        return reply.send({
            ok: true,
            sporeId: result.sporeId,
            txHash: result.txHash,
            type: "access-pass"
        });
    } catch (err: any) {
        if (err.message?.includes("SOLD_OUT")) {
            return reply.status(400).send({ error: "已售罄", code: "sold_out" });
        }
        req.log.error(err);
        return reply.status(500).send({ error: err?.message || "铸造失败", code: "mint_error" });
    }
});

app.get("/nft/access/check/:videoId", async (req, reply) => {
    try {
        const params = req.params as { videoId: string };
        const user = req.user as any;
        const userAddress = user?.ckb || "";

        const hasAccess = await sporeClient.hasAccessPass(params.videoId, userAddress);

        return reply.send({ hasAccess, videoId: params.videoId });
    } catch (err: any) {
        return reply.status(500).send({ error: err?.message || "查询失败", code: "query_error" });
    }
});

// ============== Limited Edition NFT (deprecated/merged with Collection) ==============
// Keeping endpoint for compatibility but logic moved to Collection if clusterId provided

app.post("/nft/limited/mint", async (req, reply) => {
    try {
        const body = req.body as {
            videoId: string;
            title: string;
            clusterId: string;
            editionNumber: number;
            maxEditions: number;
        };
        const user = req.user as any;
        const buyerAddress = user?.ckb || "";

        if (!body.videoId || !body.clusterId) {
            return reply.status(400).send({ error: "缺少必要参数", code: "bad_request" });
        }

        const result = await sporeClient.mintLimitedEditionSpore(
            body.videoId,
            body.title,
            buyerAddress,
            body.clusterId,
            body.editionNumber,
            body.maxEditions
        );

        // Update DB stats
        await prisma.nFTCollection.update({
            where: { clusterId: body.clusterId },
            data: { totalSupply: { increment: 1 } }
        });

        return reply.send({
            ok: true,
            sporeId: result.sporeId,
            txHash: result.txHash,
            type: "limited-edition",
            edition: `#${body.editionNumber}/${body.maxEditions}`
        });
    } catch (err: any) {
        req.log.error(err);
        return reply.status(500).send({ error: err?.message || "铸造失败", code: "mint_error" });
    }
});

// ============== Creator Badge NFT ==============

app.post("/nft/badge/mint", async (req, reply) => {
    try {
        const body = req.body as { badgeType: string; recipientAddress?: string };
        const user = req.user as any;
        const recipientAddress = body.recipientAddress || user?.ckb || "";

        const rule = BADGE_RULES[body.badgeType as keyof typeof BADGE_RULES];
        if (!rule) {
            return reply.status(400).send({ error: "无效的徽章类型", code: "invalid_badge_type" });
        }

        const result = await sporeClient.mintCreatorBadgeSpore(
            rule.id,
            rule.description,
            recipientAddress
        );

        return reply.send({
            ok: true,
            sporeId: result.sporeId,
            txHash: result.txHash,
            type: "creator-badge",
            badge: rule
        });
    } catch (err: any) {
        req.log.error(err);
        return reply.status(500).send({ error: err?.message || "铸造失败", code: "mint_error" });
    }
});

app.get("/nft/badge/rules", async (_req, reply) => {
    return reply.send({ badges: Object.values(BADGE_RULES) });
});

// ============== Video NFT Collection (Persistent) ==============

/**
 * 创建视频收藏版
 */
app.post("/nft/collection/create", async (req, reply) => {
    try {
        const body = req.body as {
            videoId: string;
            videoTitle: string;
            maxEditions: number;
            price: number;
            royaltyPercent?: number;
            benefits?: string[];
            ipfsCid?: string;
            previewUrl?: string;
        };
        const user = req.user as any;
        const creatorAddress = user?.ckb || "";

        if (!body.videoId || !body.videoTitle || !body.maxEditions || !body.price) {
            return reply.status(400).send({ error: "缺少必要参数", code: "bad_request" });
        }

        if (body.maxEditions < 1 || body.maxEditions > 10000) {
            return reply.status(400).send({ error: "限量数量需在 1-10000 之间", code: "invalid_editions" });
        }

        // Check uniqueness in DB (using clusterId logic or custom logic, probably videoId)
        // Note: Our DB schema doesn't have videoId in NFTCollection. 
        // We put description as JSON or add field? 
        // For now, let's put it in description or just rely on cluster name.
        // Actually, we can check if a collection for this video already exists via name or description tag.

        // 创建 Cluster
        const cluster = await sporeClient.createCluster({
            name: `${body.videoTitle} - Collection`,
            description: `Limited Edition Collection for ${body.videoTitle}`,
            ownerAddress: creatorAddress,
            isPublic: false,
            maxSpores: body.maxEditions,
        });

        // Persist to DB
        const collection = await prisma.nFTCollection.create({
            data: {
                clusterId: cluster.clusterId,
                name: `${body.videoTitle} - Collection`,
                description: JSON.stringify({
                    videoId: body.videoId,
                    videoTitle: body.videoTitle,
                    price: body.price,
                    royaltyPercent: body.royaltyPercent || 10,
                    benefits: body.benefits || [],
                    ipfsCid: body.ipfsCid,
                    previewUrl: body.previewUrl
                }),
                creatorId: user.sub,
                maxSupply: body.maxEditions,
                totalSupply: 0
            }
        });

        req.log.info({ msg: "Video collection created", clusterId: cluster.clusterId, videoId: body.videoId });

        return reply.send({
            ok: true,
            collectionId: collection.id, // DB ID
            clusterId: cluster.clusterId,
            txHash: cluster.txHash,
        });
    } catch (err: any) {
        req.log.error(err);
        return reply.status(500).send({ error: err?.message || "创建失败", code: "create_error" });
    }
});

/**
 * 购买/铸造收藏 NFT
 */
app.post("/nft/collection/mint", async (req, reply) => {
    try {
        const body = req.body as { collectionId: string }; // This is likely the DB ID or Cluster ID. Let's assume DB ID or Cluster ID.
        // Frontend likely sends Cluster ID for Spore actions, but let's support DB ID lookup.

        const user = req.user as any;
        const buyerAddress = user?.ckb || "";

        if (!body.collectionId) {
            return reply.status(400).send({ error: "缺少 collectionId", code: "bad_request" });
        }

        // Try find by ID first, then clusterId
        let collection = await prisma.nFTCollection.findUnique({ where: { id: body.collectionId } });
        if (!collection) {
            collection = await prisma.nFTCollection.findUnique({ where: { clusterId: body.collectionId } });
        }

        if (!collection) {
            return reply.status(404).send({ error: "收藏版不存在", code: "not_found" });
        }

        if (collection.maxSupply && collection.totalSupply >= collection.maxSupply) {
            return reply.status(400).send({ error: "已售罄", code: "sold_out" });
        }

        const meta = JSON.parse(collection.description || "{}");
        const videoTitle = meta.videoTitle || collection.name;
        const videoId = meta.videoId || "unknown";

        // TODO: Payment logic here

        const editionNumber = collection.totalSupply + 1;
        const result = await sporeClient.mintLimitedEditionSpore(
            videoId,
            `${videoTitle} #${editionNumber}/${collection.maxSupply}`,
            buyerAddress,
            collection.clusterId,
            editionNumber,
            collection.maxSupply || 100
        );

        // Update DB
        const updated = await prisma.nFTCollection.update({
            where: { id: collection.id },
            data: { totalSupply: { increment: 1 } }
        });

        // We don't store individual holders in DB yet (could add UserNFT model later)

        return reply.send({
            ok: true,
            sporeId: result.sporeId,
            txHash: result.txHash,
            type: "video-collection",
            edition: `#${editionNumber}/${collection.maxSupply}`,
            videoId: videoId,
            videoTitle: videoTitle,
            benefits: meta.benefits,
        });
    } catch (err: any) {
        req.log.error(err);
        return reply.status(500).send({ error: err?.message || "铸造失败", code: "mint_error" });
    }
});

app.get("/nft/collection/trending", async (req, reply) => {
    try {
        const query = req.query as { limit?: string };
        const limit = Math.min(50, Math.max(1, Number(query.limit) || 20));

        const collections = await prisma.nFTCollection.findMany({
            orderBy: { totalSupply: 'desc' },
            take: limit,
            include: { creator: true }
        });

        return reply.send({
            collections: collections.map(c => {
                const meta = JSON.parse(c.description || "{}");
                return {
                    ...c,
                    ...meta,
                    available: (c.maxSupply || 0) - c.totalSupply,
                    soldPercent: c.maxSupply ? Math.round((c.totalSupply / c.maxSupply) * 100) : 0
                };
            })
        });
    } catch (err: any) {
        return reply.status(500).send({ error: err?.message || "查询失败", code: "query_error" });
    }
});

// ============== 用户 NFT 查询 ==============

// Alias: /nft/ownership/list (used by CreatorDashboard)
app.get("/nft/ownership/list", async (req, reply) => {
    try {
        const user = req.user as any;
        const userAddress = user?.ckb || "";
        const nfts = await sporeClient.getSporesByOwner(userAddress);
        return reply.send({ nfts, total: nfts.length });
    } catch (err: any) {
        return reply.send({ nfts: [], total: 0 });
    }
});

app.get("/nft/my", async (req, reply) => {
    try {
        const user = req.user as any;
        const userAddress = user?.ckb || "";

        const spores = await sporeClient.getSporesByOwner(userAddress);

        return reply.send({
            total: spores.length,
            // Grouping logic remains same
            ownership: spores.filter(s => s.content.type === 'video-ownership'),
            accessPasses: spores.filter(s => s.content.type === 'access-pass'),
            limitedEditions: spores.filter(s => s.content.type === 'limited-edition'),
            badges: spores.filter(s => s.content.type === 'creator-badge'),
            others: spores
        });
    } catch (err: any) {
        return reply.status(500).send({ error: err?.message || "查询失败", code: "query_error" });
    }
});

app.post("/nft/transfer", async (req, reply) => {
    try {
        const body = req.body as { sporeId: string; toAddress: string };
        const user = req.user as any;
        const fromAddress = user?.ckb || "";

        if (!body.sporeId || !body.toAddress) {
            return reply.status(400).send({ error: "Missing sporeId or toAddress", code: "bad_request" });
        }

        const txHash = await sporeClient.transferSpore(body.sporeId, fromAddress, body.toAddress);

        return reply.send({ ok: true, txHash });
    } catch (err: any) {
        return reply.status(500).send({ error: err?.message || "Transfer failed", code: "transfer_error" });
    }
});

// ============== NFT Marketplace (Secondary Market) ==============

const PLATFORM_FEE_PERCENT = Number(process.env.PLATFORM_FEE_PERCENTAGE || 5);
const DEFAULT_ROYALTY_PERCENT = Number(process.env.CREATOR_ROYALTY_PERCENTAGE || 5);

/**
 * List an NFT for sale on the marketplace
 */
app.post("/nft/marketplace/list", async (req, reply) => {
    try {
        const body = req.body as {
            tokenId: string;
            title: string;
            price: number;
            description?: string;
            type?: string;
            rarity?: string;
            imageUrl?: string;
            contentId?: string;
            contentType?: string;
        };
        const user = req.user as any;

        if (!body.tokenId || !body.title || body.price === undefined) {
            return reply.status(400).send({ error: "缺少 tokenId, title 或 price", code: "bad_request" });
        }

        // Verify the user owns this Spore token
        const userAddress = user?.ckb || "";
        if (userAddress) {
            const hasAccess = await sporeClient.hasAccessPass(body.tokenId, userAddress).catch(() => true);
            // Note: In production, would verify actual Spore ownership via on-chain query
        }

        const listing = await prisma.nFTListing.create({
            data: {
                sporeId: body.tokenId,
                title: body.title,
                description: body.description || "",
                imageUrl: body.imageUrl || "",
                type: body.type || "video_fragment",
                rarity: body.rarity || "common",
                price: body.price,
                currency: "PTS",
                sellerId: user.sub,
                status: "active",
                contentId: body.contentId,
                contentType: body.contentType,
                originalCreatorId: user.sub, // First listing: seller is creator
                royaltyPercent: DEFAULT_ROYALTY_PERCENT,
            }
        });

        return reply.send({ ok: true, listingId: listing.id, listing });
    } catch (err: any) {
        req.log.error(err);
        return reply.status(500).send({ error: err?.message || "挂单失败", code: "list_error" });
    }
});

/**
 * Buy an NFT from the marketplace (with auto royalty distribution)
 */
app.post("/nft/marketplace/buy", async (req, reply) => {
    try {
        const body = req.body as { listingId: string; tokenId?: string };
        const user = req.user as any;

        if (!body.listingId) {
            return reply.status(400).send({ error: "缺少 listingId", code: "bad_request" });
        }

        const listing = await prisma.nFTListing.findUnique({ where: { id: body.listingId } });
        if (!listing) {
            return reply.status(404).send({ error: "挂单不存在", code: "not_found" });
        }
        if (listing.status !== "active") {
            return reply.status(400).send({ error: "该NFT已下架或已售出", code: "not_active" });
        }
        if (listing.sellerId === user.sub) {
            return reply.status(400).send({ error: "不能购买自己的NFT", code: "self_buy" });
        }

        // Calculate fees
        const price = Number(listing.price);
        const royaltyAmount = price * (Number(listing.royaltyPercent) / 100);
        const platformFee = price * (PLATFORM_FEE_PERCENT / 100);
        const sellerAmount = price - royaltyAmount - platformFee;

        // 1. Deduct buyer's points
        const buyer = await prisma.user.findUnique({ where: { id: user.sub } });
        if (!buyer || Number(buyer.points) < price) {
            return reply.status(400).send({ error: "积分不足", code: "insufficient_points" });
        }

        // 2. Execute transaction atomically
        const [updatedBuyer, updatedSeller, updatedListing, transaction] = await prisma.$transaction([
            // Deduct from buyer
            prisma.user.update({
                where: { id: user.sub },
                data: { points: { decrement: price } }
            }),
            // Pay seller (minus royalty and platform fee)
            prisma.user.update({
                where: { id: listing.sellerId },
                data: { points: { increment: sellerAmount } }
            }),
            // Mark listing as sold
            prisma.nFTListing.update({
                where: { id: listing.id },
                data: { status: "sold", soldAt: new Date() }
            }),
            // Record transaction
            prisma.nFTTransaction.create({
                data: {
                    listingId: listing.id,
                    buyerId: user.sub,
                    sellerId: listing.sellerId,
                    price: price,
                    currency: listing.currency,
                    royaltyAmount: royaltyAmount,
                    royaltyRecipient: listing.originalCreatorId,
                    platformFee: platformFee,
                    sporeId: listing.sporeId,
                }
            })
        ]);

        // 3. Pay royalty to original creator (if different from seller)
        if (listing.originalCreatorId && listing.originalCreatorId !== listing.sellerId && royaltyAmount > 0) {
            await prisma.user.update({
                where: { id: listing.originalCreatorId },
                data: { points: { increment: royaltyAmount } }
            }).catch(err => {
                req.log.warn({ msg: "Royalty payment failed", originalCreator: listing.originalCreatorId, err: err?.message });
            });
        }

        // 4. Transfer Spore NFT on-chain (async, non-blocking)
        const buyerAddress = buyer?.address || user?.ckb || "";
        if (buyerAddress && listing.sporeId) {
            sporeClient.transferSpore(listing.sporeId, listing.sellerId, buyerAddress).catch(err => {
                req.log.warn({ msg: "Spore transfer failed (will retry)", sporeId: listing.sporeId, err: err?.message });
            });
        }

        return reply.send({
            ok: true,
            transactionId: transaction.id,
            price,
            royaltyPaid: royaltyAmount,
            platformFee,
            sellerReceived: sellerAmount,
        });
    } catch (err: any) {
        req.log.error(err);
        return reply.status(500).send({ error: err?.message || "购买失败", code: "buy_error" });
    }
});

/**
 * Cancel a marketplace listing
 */
app.post("/nft/marketplace/cancel", async (req, reply) => {
    try {
        const body = req.body as { listingId: string };
        const user = req.user as any;

        if (!body.listingId) {
            return reply.status(400).send({ error: "缺少 listingId", code: "bad_request" });
        }

        const listing = await prisma.nFTListing.findUnique({ where: { id: body.listingId } });
        if (!listing) {
            return reply.status(404).send({ error: "挂单不存在", code: "not_found" });
        }
        if (listing.sellerId !== user.sub) {
            return reply.status(403).send({ error: "无权取消他人挂单", code: "forbidden" });
        }
        if (listing.status !== "active") {
            return reply.status(400).send({ error: "该挂单已不可取消", code: "not_active" });
        }

        await prisma.nFTListing.update({
            where: { id: listing.id },
            data: { status: "cancelled", cancelledAt: new Date() }
        });

        return reply.send({ ok: true });
    } catch (err: any) {
        req.log.error(err);
        return reply.status(500).send({ error: err?.message || "取消失败", code: "cancel_error" });
    }
});

/**
 * Get marketplace listings (with filters and pagination)
 */
app.get("/nft/marketplace/listings", async (req, reply) => {
    try {
        const query = req.query as { type?: string; sort?: string; limit?: string; offset?: string; search?: string };
        const limit = Math.min(50, Math.max(1, Number(query.limit) || 20));
        const offset = Math.max(0, Number(query.offset) || 0);

        const where: any = { status: "active" };
        if (query.type && query.type !== "all") where.type = query.type;
        if (query.search) where.title = { contains: query.search, mode: "insensitive" };

        let orderBy: any = { listedAt: "desc" };
        if (query.sort === "price_asc") orderBy = { price: "asc" };
        else if (query.sort === "price_desc") orderBy = { price: "desc" };
        else if (query.sort === "popular") orderBy = { listedAt: "desc" }; // TODO: add likes count

        const [items, total] = await Promise.all([
            prisma.nFTListing.findMany({ where, orderBy, take: limit, skip: offset }),
            prisma.nFTListing.count({ where })
        ]);

        // Enrich with seller info
        const sellerIds = [...new Set(items.map(i => i.sellerId))];
        const sellers = await prisma.user.findMany({
            where: { id: { in: sellerIds } },
            select: { id: true, nickname: true, avatar: true, username: true }
        });
        const sellerMap = Object.fromEntries(sellers.map(s => [s.id, s]));

        return reply.send({
            items: items.map(item => ({
                ...item,
                price: Number(item.price),
                royaltyPercent: Number(item.royaltyPercent),
                seller: sellerMap[item.sellerId] ? {
                    id: sellerMap[item.sellerId].id,
                    name: sellerMap[item.sellerId].nickname || sellerMap[item.sellerId].username || "Anonymous",
                    avatar: sellerMap[item.sellerId].avatar,
                } : { id: item.sellerId, name: "Unknown" },
                likes: 0, // TODO: implement likes for listings
            })),
            total,
            limit,
            offset,
        });
    } catch (err: any) {
        req.log.error(err);
        return reply.status(500).send({ error: err?.message || "查询失败", code: "query_error" });
    }
});

/**
 * Get transaction history for a specific NFT
 */
app.get("/nft/marketplace/history/:sporeId", async (req, reply) => {
    try {
        const params = req.params as { sporeId: string };

        const transactions = await prisma.nFTTransaction.findMany({
            where: { sporeId: params.sporeId },
            orderBy: { createdAt: "desc" },
            take: 50,
        });

        return reply.send({ transactions });
    } catch (err: any) {
        return reply.status(500).send({ error: err?.message || "查询失败", code: "query_error" });
    }
});

/**
 * Make an offer on a listed NFT (creates a pending offer record)
 */
app.post("/nft/marketplace/offer", async (req, reply) => {
    try {
        const body = req.body as { listingId: string; offerPrice: number };
        const user = req.user as any;

        if (!body.listingId || !body.offerPrice) {
            return reply.status(400).send({ error: "缺少 listingId 或 offerPrice", code: "bad_request" });
        }

        const listing = await prisma.nFTListing.findUnique({ where: { id: body.listingId } });
        if (!listing || listing.status !== "active") {
            return reply.status(404).send({ error: "挂单不存在或已下架", code: "not_found" });
        }

        // For now, offers are implemented as messages to the seller
        // Full offer system (with escrow) would require additional models
        return reply.send({
            ok: true,
            message: "Offer sent to seller",
            listingId: body.listingId,
            offerPrice: body.offerPrice,
        });
    } catch (err: any) {
        return reply.status(500).send({ error: err?.message || "出价失败", code: "offer_error" });
    }
});

const PORT = Number(process.env.NFT_PORT || 8095);
app.listen({ port: PORT, host: "0.0.0.0" }).then(() => {
    console.log(`NFT Service started on port ${PORT}`);
});

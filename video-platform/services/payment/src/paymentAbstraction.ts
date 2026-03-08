/**
 * 统一支付抽象层 — JoyID-First 架构
 *
 * 设计原则:
 * - JoyID (Passkey 钱包) 是面向 Web2 用户的钱包抽象方案
 * - 无托管钱包，所有链上操作通过用户自己的 JoyID/CCC/MetaMask 签名
 * - 积分 (Points) 作为链下中间货币，可用 CKB 充值
 * - 链上操作对用户尽量透明，但签名权永远在用户手中
 *
 * 支付路由:
 * - 积分支付 → 链下直接扣减 (零摩擦)
 * - JoyID 签名购买 → 验证签名后积分入账
 *
 * 全站分佣 (Universal Revenue Split):
 * - 计算平台抽成 (Platform Fee)
 * - 读取通用分账规则 (RevenueSplitRule) 并按比例拆分剩余金额
 */

import { PrismaClient } from "@video-platform/database";

const prisma = new PrismaClient();

// ============== 类型 ==============

export type PaymentCurrency = "points" | "ckb";
export type PaymentType = "tip" | "stream" | "purchase" | "mint" | "gift";

export interface PaymentRequest {
    fromUserId: string;
    toUserId?: string;          // 打赏/购买接收方
    toAddress?: string;         // CKB 地址 (如果 toUserId 为空)
    amount: number;             // 数量
    currency: PaymentCurrency;
    type: PaymentType;
    videoId?: string;           // 关联的视频
    metadata?: Record<string, any>;
}

export interface PaymentResponse {
    success: boolean;
    /** 积分支付直接完成 */
    completed?: boolean;
    /** CKB 支付需要前端签名 */
    needsSignature?: boolean;
    /** 需要签名的未签名交易 (Lumos skeleton or raw tx) */
    unsignedTx?: any;
    /** 完成后的交易哈希 */
    txHash?: string;
    /** 新余额 */
    newBalance?: number;
    /** 错误信息 */
    error?: string;
}

// ============== 核心路由 ==============

/**
 * 统一支付入口
 * 根据 currency 决定走链下(积分)还是链上(CKB) 路径
 */
export async function processPayment(req: PaymentRequest): Promise<PaymentResponse> {
    const { fromUserId, currency } = req;

    // 检查用户存在
    const user = await prisma.user.findUnique({
        where: { id: fromUserId },
        select: { id: true, address: true, points: true },
    });

    if (!user) {
        return { success: false, error: "用户不存在" };
    }

    // 路由到对应支付方式
    switch (currency) {
        case "points":
            return processPointsPayment(user, req);
        case "ckb":
            return prepareCkbPayment(user, req);
        default:
            return { success: false, error: `不支持的支付方式: ${currency}` };
    }
}

// ============== 积分支付 (链下, 零摩擦) ==============

async function processPointsPayment(
    user: { id: string; points: any },
    req: PaymentRequest
): Promise<PaymentResponse> {
    const balance = Number(user.points);
    if (balance < req.amount) {
        return {
            success: false,
            error: "积分不足",
            newBalance: balance,
        };
    }

    try {
        const result = await prisma.$transaction(async (tx) => {
            // 扣除发送方
            await tx.user.update({
                where: { id: req.fromUserId },
                data: { points: { decrement: req.amount } },
            });

            // 入账接收方
            if (req.toUserId) {
                await tx.user.update({
                    where: { id: req.toUserId },
                    data: { points: { increment: req.amount } },
                });
            }

            // 记录发送方扣款
            await tx.pointsTransaction.create({
                data: {
                    userId: req.fromUserId,
                    type: req.type === "tip" ? "redeem" : "redeem",
                    amount: -req.amount,
                    reason: buildReason(req),
                },
            });

            // 记录接收方入账
            if (req.toUserId) {
                await tx.pointsTransaction.create({
                    data: {
                        userId: req.toUserId,
                        type: "earn",
                        amount: req.amount,
                        reason: `收到${req.type === "tip" ? "打赏" : "付款"} ${req.amount} 积分`,
                    },
                });
            }

            // 返回新余额
            const updated = await tx.user.findUnique({
                where: { id: req.fromUserId },
                select: { points: true },
            });
            return Number(updated?.points || 0);
        });

        return {
            success: true,
            completed: true,
            newBalance: result,
        };
    } catch (err: any) {
        return { success: false, error: err?.message || "支付失败" };
    }
}

// ============== CKB 链上支付 (需要前端签名) ==============

/**
 * 准备 CKB 交易
 * 后端只构建未签名交易，签名由前端的 JoyID/CCC SDK 完成
 */
async function prepareCkbPayment(
    user: { id: string; address: string | null },
    req: PaymentRequest
): Promise<PaymentResponse> {
    if (!user.address) {
        return {
            success: false,
            error: "请先连接 JoyID 或 CCC 钱包",
        };
    }

    // 获取接收方地址
    let toAddress = req.toAddress || "";
    if (!toAddress && req.toUserId) {
        const receiver = await prisma.user.findUnique({
            where: { id: req.toUserId },
            select: { address: true },
        });
        toAddress = receiver?.address || "";
    }

    if (!toAddress) {
        return { success: false, error: "找不到接收方地址" };
    }

    // 返回前端所需信息，让前端通过 CKB build_tx API 构建并签名
    // 这里不构建交易，因为前端已有 /payment/ckb/build_tx 接口
    return {
        success: true,
        needsSignature: true,
        unsignedTx: {
            from: user.address,
            to: toAddress,
            amountCKB: req.amount,
            type: req.type,
            videoId: req.videoId,
            metadata: req.metadata,
        },
    };
}

// ============== 辅助函数 ==============

function buildReason(req: PaymentRequest): string {
    const typeNames: Record<PaymentType, string> = {
        tip: "打赏",
        stream: "流支付",
        purchase: "购买",
        mint: "铸造",
        gift: "礼物",
    };
    const typeName = typeNames[req.type] || req.type;
    const target = req.videoId ? ` 视频 ${req.videoId}` : "";
    return `${typeName}${target}: ${req.amount} 积分`;
}

/**
 * 检查用户是否有可用钱包 (JoyID/CCC/MetaMask)
 * Web2 用户没有钱包 → 引导连接 JoyID
 */
export async function checkWalletStatus(userId: string): Promise<{
    hasWallet: boolean;
    address: string | null;
    needsJoyIdSetup: boolean;
}> {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { address: true },
    });

    return {
        hasWallet: !!user?.address,
        address: user?.address || null,
        needsJoyIdSetup: !user?.address,
    };
}

// ============== 全站通用收益切分引擎 ==============

/**
 * 通用分账计算器 (Universal Split Calculator)
 * @param amount 总金额 (Points 或 CKB shannons)
 * @param targetType 实体类型 ("video", "live", "article")
 * @param targetId 实体 ID
 * @param ownerId 回落账户 (如果没配置切分则 100% 给此人)
 */
export async function calculateUniversalSplits(
    amount: number,
    targetType: string,
    targetId: string,
    ownerId?: string
): Promise<{
    platformFeeAmount: number;
    splits: { userId: string; amount: number; fiberAddress?: string; percentage: number }[]
}> {
    // 1. 获取平台全局手续费比例 (默认 5%)
    const feeSetting = await prisma.platformSetting.findUnique({ where: { key: "PLATFORM_FEE_PERCENTAGE" } });
    const feePercent = feeSetting ? Number(feeSetting.value) : 5;
    const initialPlatformFee = Math.floor(amount * (feePercent / 100));

    const distributableAmount = amount - initialPlatformFee;

    // 2. 取出此内容绑定的所有协作者规则
    const rules = await prisma.revenueSplitRule.findMany({
        where: { targetType, targetId }
    });

    if (rules.length === 0 && ownerId) {
        // 无协作设置: (100-N)% 全给上传者
        // 尝试获取上传者的地址，以便触发单人的 Fiber 自动打款
        const owner = await prisma.user.findUnique({
            where: { id: ownerId },
            select: { address: true }
        });

        return {
            platformFeeAmount: initialPlatformFee,
            splits: [{ userId: ownerId, amount: distributableAmount, percentage: 100, fiberAddress: owner?.address || undefined }]
        };
    } else if (rules.length === 0) {
        // 如果实在找不到owner，把钱都收归国库避免资金卡死
        return { platformFeeAmount: amount, splits: [] };
    }

    // 3. 按比例精确切分
    const splits = rules.map((rule: any) => {
        const rulePercent = Number(rule.percentage);
        const splitAmount = Math.floor(distributableAmount * (rulePercent / 100));
        return {
            userId: rule.userId,
            amount: splitAmount,
            fiberAddress: rule.fiberAddress || undefined,
            percentage: rulePercent,
        };
    });

    // 抹平因除法导致的精度余数，防止金额凭空蒸发 (余数并入平台费)
    const totalSplit = splits.reduce((sum: number, s: any) => sum + s.amount, 0);
    const remainder = distributableAmount - totalSplit;
    const finalPlatformFee = initialPlatformFee + remainder;

    return { platformFeeAmount: finalPlatformFee, splits };
}

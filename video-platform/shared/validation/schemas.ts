// FILE: /video-platform/shared/validation/schemas.ts
/**
 * 功能说明：
 * - 定义平台通用 DTO 的 Zod 校验 Schema，用于服务端入参验证。
 */

import { z } from "zod";

export const JoyIDSignatureDataSchema = z.object({
  challenge: z.string().min(1),
  message: z.string().min(1),
  signature: z.string().min(1),
  pubkey: z.string().optional(),
  alg: z.number().optional(),
  keyType: z.string().optional(),
});

export const JoyIDAuthRequestSchema = z.object({
  bitDomain: z.string().min(1).optional(),
  deviceFingerprint: z.string().min(1),
  signatureData: JoyIDSignatureDataSchema,
  address: z.string().min(1).optional(),
  /** When "ccc", backend trusts CCC wallet connection and only validates nonce; address is required */
  authType: z.enum(["ccc"]).optional(),
});

export const LegacyAuthRequestSchema = z.object({
  bitDomain: z.string().min(1),
  joyIdAssertion: z.string().min(1),
  deviceFingerprint: z.string().min(1),
});

// 邮箱登录（验证码）请求与验证
export const EmailAuthStartSchema = z.object({
  email: z.string().email(),
  deviceFingerprint: z.string().min(1),
});

export const EmailAuthVerifySchema = z.object({
  email: z.string().email(),
  code: z.string().min(4).max(8),
});

// 魔法链接登录：启动与消费
export const EmailMagicStartSchema = z.object({
  email: z.string().email(),
  deviceFingerprint: z.string().min(1),
});

export const EmailMagicConsumeSchema = z.object({
  token: z.string().min(16),
});

// 手机号登录（验证码 SMS）
// phone 格式: E.164, 例如 +8613812345678, +14155551234
export const PhoneAuthStartSchema = z.object({
  phone: z.string().regex(/^\+[1-9]\d{4,14}$/, "手机号需为 E.164 格式，如 +8613800138000"),
  countryCode: z.string().min(1).max(5),  // 如 "86", "1", "81", "44"
  deviceFingerprint: z.string().min(1),
});

export const PhoneAuthVerifySchema = z.object({
  phone: z.string().regex(/^\+[1-9]\d{4,14}$/),
  code: z.string().min(4).max(8),
});

export const UploadRequestSchema = z.object({
  videoId: z.string().min(1),
  creatorCkbAddress: z.string().min(1),
  buyerCkbAddress: z.string().min(1).optional(),
  base64Content: z.string().min(1),
  contentType: z.enum(['video', 'audio', 'article']).optional(),
  enableArweave: z.boolean().optional(),
});

export const DirectUploadInitRequestSchema = z.object({
  videoId: z.string().min(1),
  creatorCkbAddress: z.string().min(1),
});

export const VideoMetaSchema = z.object({
  id: z.string().min(1),
  contentType: z.enum(['video', 'audio', 'article']).optional(),
  title: z.string().min(1),
  description: z.string().min(1),
  creatorBitDomain: z.string(),  // may be empty if user has no .bit domain
  creatorCkbAddress: z.string().min(1),
  priceUSDI: z.string().regex(/^\d+(?:\.\d{1,6})?$/),
  pointsPrice: z.number().int().nonnegative().optional(),
  cdnUrl: z.string(),  // may be empty for articles
  posterUrl: z.string().url().optional(),
  cfStreamUid: z.string().optional(),
  filecoinCid: z.string().optional(),
  arweaveTxId: z.string().optional(),
  sha256: z.string().optional(),
  createdAt: z.string().min(1),
  // 合集/多集可选字段
  seriesId: z.string().optional(),
  seriesTitle: z.string().optional(),
  episodeIndex: z.number().int().min(1).optional(),
  // 分类字段（可选）
  region: z.string().optional(),
  language: z.string().optional(),
  genre: z.string().optional(),
  durationSeconds: z.number().int().positive().optional(),
  releaseYear: z.number().int().min(1900).max(2100).optional(),
  tags: z.array(z.string()).optional(),
  textContent: z.string().optional(),
  // Remix & Scarcity fields
  allowRemix: z.boolean().optional(),
  parentVideoId: z.string().optional(),
  limitType: z.enum(['none', 'views', 'time']).optional(),
  limitValue: z.number().optional(),
  currentViews: z.number().optional(),
  // === Streaming Payment 流支付 ===
  priceMode: z.enum(['free', 'buy_once', 'stream', 'both']).optional(),
  buyOncePrice: z.number().nonnegative().optional(),
  streamPricePerMinute: z.number().nonnegative().optional(),
  // === Spore NFT ===
  ownershipSporeId: z.string().optional(),
  accessClusterId: z.string().optional(),
  maxAccessPasses: z.number().optional(),
  mintedAccessPasses: z.number().optional(),
});

export const MetadataWriteRequestSchema = z.object({
  meta: VideoMetaSchema,
});

export const OfflinePlayGrantSchema = z.object({
  videoId: z.string().min(1),
  deviceFingerprint: z.string().min(1),
});

export const EntitlementGrantSchema = z.object({
  videoId: z.string().min(1),
  userId: z.string().min(1),
});

export const PaymentCreateSchema = z.object({
  videoId: z.string().min(1),
  amountUSDI: z.string().regex(/^\d+(?:\.\d{1,6})?$/),
});

export const PaymentRedeemSchema = z.object({
  intentId: z.string().min(1),
});

// 积分相关 DTO
export const PointsRedeemSchema = z.object({
  videoId: z.string().min(1),
  pointsPrice: z.number().int().positive().optional(),
});

export const PointsEarnSchema = z.object({
  amount: z.number().int().positive(),
  reason: z.string().optional(),
});

// 新增：指定账户发放积分（用于点赞奖励给创作者）
export const PointsEarnToSchema = z
  .object({
    amount: z.number().int().positive(),
    reason: z.string().optional(),
    targetCkbAddress: z.string().min(1).optional(),
    targetBitDomain: z.string().min(1).optional(),
  })
  .refine((d) => !!d.targetCkbAddress || !!d.targetBitDomain, { message: "至少提供 targetCkbAddress 或 targetBitDomain" });

// 新增：用 USDI 购买积分（前端 P0）
export const PointsBuySchema = z.object({
  usdiAmount: z.string().regex(/^\d+(?:\.\d{1,6})?$/).optional(),
  pointsAmount: z.number().int().positive().optional(),
}).refine((d) => !!d.usdiAmount || !!d.pointsAmount, { message: "至少提供 usdiAmount 或 pointsAmount" });

// 新增：用 CKB 购买积分（JoyID 支付）
export const PointsBuyCKBSchema = z.object({
  ckbAmount: z.string().regex(/^\d+(?:\.\d{1,8})?$/).optional(),
  pointsAmount: z.number().int().positive().optional(),
}).refine((d) => !!d.ckbAmount || !!d.pointsAmount, { message: "至少提供 ckbAmount 或 pointsAmount" });

// 新增：Fiber 发票创建与状态查询
export const FiberInvoiceCreateSchema = z.object({
  amount: z.string().regex(/^\d+(?:\.\d{1,8})?$/),
  asset: z.string().min(1),
  memo: z.string().optional(),
  payeePubKey: z.string().min(1).optional(),
  expirySeconds: z.number().int().positive().max(86400).optional(),
  pointsPreview: z.number().int().positive().optional(),
});
export const FiberInvoiceStatusSchema = z
  .object({
    invoice: z.string().min(1).optional(),
    invoiceId: z.string().min(1).optional(),
    paymentHash: z.string().min(1).optional(),
    signatureData: z.any().optional(),
    address: z.string().min(1).optional(),
  })
  .refine((d) => !!d.invoice || !!d.invoiceId || !!d.paymentHash, { message: "至少提供 invoice 或 invoiceId 或 paymentHash" });
// ===== 新增：CKB 链上转账型积分购买（MVP） =====
export const CkbPurchaseIntentSchema = z.object({
  ckbAmount: z.string().regex(/^\d+(?:\.\d{1,8})?$/).optional(),
  pointsAmount: z.number().int().positive().optional(),
  payerAddress: z.string().regex(/^(ckb|ckt)[0-9a-zA-Z]+$/).optional(),
}).refine((d) => !!d.ckbAmount || !!d.pointsAmount, { message: "至少提供 ckbAmount 或 pointsAmount" });

export const CkbPurchaseConfirmSchema = z.object({
  orderId: z.string().min(1),
  txHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
});

export type CkbPurchaseIntentDTO = z.infer<typeof CkbPurchaseIntentSchema>;
export type CkbPurchaseConfirmDTO = z.infer<typeof CkbPurchaseConfirmSchema>;
export type JoyIDAuthRequestDTO = z.infer<typeof JoyIDAuthRequestSchema>;
export type LegacyAuthRequestDTO = z.infer<typeof LegacyAuthRequestSchema>;
export type UploadRequestDTO = z.infer<typeof UploadRequestSchema>;
export type DirectUploadInitRequestDTO = z.infer<typeof DirectUploadInitRequestSchema>;
export type MetadataWriteRequestDTO = z.infer<typeof MetadataWriteRequestSchema>;
export type OfflinePlayGrantDTO = z.infer<typeof OfflinePlayGrantSchema>;
export type EntitlementGrantDTO = z.infer<typeof EntitlementGrantSchema>;
export type PaymentCreateDTO = z.infer<typeof PaymentCreateSchema>;
export type PaymentRedeemDTO = z.infer<typeof PaymentRedeemSchema>;
export type PointsRedeemDTO = z.infer<typeof PointsRedeemSchema>;
export type PointsEarnDTO = z.infer<typeof PointsEarnSchema>;
export type EmailAuthStartDTO = z.infer<typeof EmailAuthStartSchema>;
export type EmailAuthVerifyDTO = z.infer<typeof EmailAuthVerifySchema>;
export type EmailMagicStartDTO = z.infer<typeof EmailMagicStartSchema>;
export type EmailMagicConsumeDTO = z.infer<typeof EmailMagicConsumeSchema>;
export type PointsBuyDTO = z.infer<typeof PointsBuySchema>;
export type PointsBuyCKBDTO = z.infer<typeof PointsBuyCKBSchema>;
export type FiberInvoiceCreateDTO = z.infer<typeof FiberInvoiceCreateSchema>;
export type FiberInvoiceStatusDTO = z.infer<typeof FiberInvoiceStatusSchema>;
export type PointsEarnToDTO = z.infer<typeof PointsEarnToSchema>;
export type PhoneAuthStartDTO = z.infer<typeof PhoneAuthStartSchema>;
export type PhoneAuthVerifyDTO = z.infer<typeof PhoneAuthVerifySchema>;

// ===== 打赏系统 Schema =====
export const TipRequestSchema = z.object({
  videoId: z.string().min(1),
  creatorAddress: z.string().min(1),
  amount: z.number().int().positive(),
  message: z.string().max(200).optional(),
  showDanmaku: z.boolean().optional(),
});

export type TipRequestDTO = z.infer<typeof TipRequestSchema>;
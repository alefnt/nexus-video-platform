// FILE: /video-platform/shared/types/index.ts
/**
 * 功能说明：
 * - 定义平台通用类型（用户、视频元数据、加密记录、支付、JWT、错误等）。
 * - 约束前后端交互结构以保证可维护性与可审计性。
 *
 * 依赖声明（package.json 片段）：
 * {
 *   "name": "@video-platform/shared",
 *   "version": "0.1.0",
 *   "type": "module",
 *   "devDependencies": {
 *     "typescript": "^5.5.0"
 *   }
 * }
 *
 * 必要环境变量占位符：
 * - process.env.JWT_SECRET (HS256 密钥，>= 32 字节)
 * - process.env.API_GATEWAY_URL (统一入口网关地址)
 */

export type USDI = string; // 十进制字符串，避免浮点误差

// 新增：USDI 余额结构（前端展示）
export interface USDIBalance {
  balance: USDI;
  token: "USDI";
  updatedAt: string;
}

// 新增：CKB 金额十进制字符串与余额结构
export type CKB = string; // 十进制字符串，使用 8 位小数精度
export interface CKBBalance {
  balance: CKB;
  token: "CKB";
  updatedAt: string;
}
export interface User {
  id: string;
  bitDomain: string; // .bit 域名
  joyIdPublicKey: string; // JoyID Passkey 公钥（Base64）
  ckbAddress: string; // Nervos CKB 地址
  createdAt: string;
}

export interface AuthRequest {
  bitDomain: string;
  joyIdAssertion: string; // WebAuthn/JoyID 断言（Base64）
  deviceFingerprint: string; // 设备指纹（绑定离线 Token）
}

export interface AuthResponse {
  jwt: string; // HS256 签名
  user: User;
  offlineToken: OfflineToken; // 用于离线播放的令牌
}

export interface OfflineToken {
  token: string; // Base64
  deviceFingerprint: string; // 与设备绑定
  expiresAt: string; // ISO 时间
}

export interface VideoMeta {
  id: string;
  contentType?: 'video' | 'audio' | 'article'; // 默认 undefined 为 video
  title: string;
  description: string;
  creatorBitDomain: string;
  creatorCkbAddress: string;
  priceUSDI: USDI;
  /**
   * 可选：视频的积分价格（整数点数）。
   * 若未设置，后端可通过 `POINTS_PER_USDI` 按 `priceUSDI` 动态换算。
   */
  pointsPrice?: number;
  cdnUrl: string; // Cloudflare Stream HLS 或其他 CDN 地址
  cfStreamUid?: string; // Cloudflare Stream 视频 UID
  filecoinCid?: string; // Web3.Storage/Filecoin CID
  arweaveTxId?: string; // Arweave (Irys) TX ID
  sha256?: string; // 原始内容哈希（用于校验/锚定）
  /**
   * 可选：封面图片 URL（jpg/png/webp）。
   * 注意：Prisma schema 中对应字段为 `coverUrl`。
   * 前端使用时应优先 posterUrl，映射到数据库的 coverUrl。
   */
  posterUrl?: string;
  /** @alias posterUrl — 与 Prisma Video.coverUrl 对齐 */
  coverUrl?: string;
  createdAt: string;
  // Fronend Aliases (Compatibility)
  thumbnailUrl?: string;
  poster?: string;
  uploadTime?: string;
  // 合集/多集支持（可选字段）：当存在 seriesId 时表示隶属于某一合集
  seriesId?: string;
  seriesTitle?: string;
  episodeIndex?: number; // 从 1 开始的集序号
  // 分类字段（可选）：用于视频列表筛选与展示
  // priceUSDI?: string; // 价格 (Moved below)

  // Remix & Scarcity
  allowRemix?: boolean;
  parentVideoId?: string; // If this is a remix
  limitType?: 'none' | 'views' | 'time';
  limitValue?: number; // Max views count or Expiry timestamp
  currentViews?: number;
  region?: string; // 地区/国家，例如 "中国大陆"、"美国"、"日本"
  language?: string; // 语言，例如 "中文"、"英语"、"日语"
  genre?: string; // 类型/题材，例如 "动作"、"纪录片"
  durationSeconds?: number; // 时长（秒）
  releaseYear?: number; // 发布/拍摄年份
  tags?: string[]; // 其他标签

  // Articles Specific
  textContent?: string; // Markdown content or short summary

  // === Streaming Payment 流支付 ===
  priceMode?: 'free' | 'buy_once' | 'stream' | 'both';
  buyOncePrice?: number;         // 一次性购买价格 (Points)
  streamPricePerMinute?: number; // @deprecated — use streamPricePerSecond
  streamPricePerSecond?: number; // 流支付每秒价格 (Points)
  oneTimePrice?: number;
  streamUrl?: string;

  // === Watch Party / Premiere ===
  premiereTime?: number;         // Unix Timestamp (ms) for scheduled release

  // === Spore NFT ===
  ownershipSporeId?: string;     // Video Ownership Spore Cell OutPoint
  accessClusterId?: string;       // Access Pass Cluster ID
  maxAccessPasses?: number;       // Limited edition max count
  mintedAccessPasses?: number;    // Current minted count

  // === Co-creation / Revenue Splits ===
  collaborators?: { userId: string; percentage: number; fiberAddress?: string; role?: string }[];
}

// === Streaming Payment Session ===
export interface StreamSession {
  sessionId: string;
  videoId: string;
  userId: string;
  startedAt: string;
  lastMeterAt: string;
  totalSeconds: number;
  totalPaid: number;           // Points charged so far
  invoices: string[];          // Fiber payment_hash list (for real Fiber)
  status: 'active' | 'paused' | 'stopped';
}

// === Spore NFT Types ===
export interface SporeNFT {
  sporeId: string;            // On-chain Spore ID (Cell OutPoint: txHash:index)
  clusterId?: string;         // Parent Cluster ID
  contentType: string;        // MIME type (e.g., application/json)
  content: string;            // Spore content (video metadata JSON)
  ownerAddress: string;
  createdAt: string;
  txHash: string;
}

export interface SporeCluster {
  clusterId: string;
  name: string;
  description?: string;
  ownerAddress: string;
  isPublic: boolean;          // Public or Private Cluster
  maxSpores?: number;         // Max Spores in this cluster (for limited editions)
  createdAt: string;
  txHash: string;
}

export interface RoyaltyRule {
  address: string;
  share: number; // 比例，0-1 之间
}

export interface RoyaltyRules {
  rules: RoyaltyRule[];
}

// 可选：在视频元数据中包含分账规则，供 Royalty Service 查询
export interface VideoMetaWithRoyalty extends VideoMeta {
  royaltyRules?: RoyaltyRules;
}

/** 推荐接口 GET /metadata/recommendations 返回类型（数组） */
export type RecommendationsResponse = VideoMeta[];

/** 热门接口 GET /metadata/trending 返回类型（数组） */
export type TrendingResponse = VideoMeta[];

/** 直播房间（Live 服务列表与详情） */
export interface LiveRoom {
  roomId: string;
  title: string;
  description?: string;
  creatorId: string;
  creatorAddress: string;
  creatorName: string;
  creatorAvatar?: string;
  creatorUsername?: string;
  status: string;
  category?: string;
  coverUrl?: string;
  viewerCount: number;
  isPrivate?: boolean;
  paymentMode?: "ticket" | "stream";
  ticketPrice?: number;
  pricePerMinute?: number; // @deprecated — use pricePerSecond
  pricePerSecond?: number;
}

export interface EncryptedVideoRecord {
  videoId: string;
  encryptionKeyHash: string; // sha256(user_ckb + video_id)
  filecoinCid?: string; // Web3.Storage 返回的 CID（真实或 Mock）
  arweaveTxId?: string; // Arweave 返回的 TX（真实或 Mock）
  cfStreamUid?: string; // Cloudflare Stream 视频 UID（真实或 Mock）
  cfPlaybackHls?: string; // Cloudflare Stream HLS 播放地址
  sha256?: string; // 原始内容哈希（用于校验/锚定）
}

export interface PaymentIntent {
  intentId: string;
  videoId: string;
  buyerCkbAddress: string;
  amountUSDI: USDI;
  status: PaymentStatus;
  createdAt: string;
}

export type PaymentStatus =
  | "created"
  | "htlc_locked"
  | "htlc_redeemed"
  | "settled"
  | "failed";

export interface JWTClaims {
  sub: string; // user id
  dom: string; // .bit 域名
  ckb: string; // CKB 地址
  dfp: string; // 设备指纹
  iat: number;
  exp: number;
  jti?: string; // 可选：JWT 唯一标识，用于吊销
}

export interface ApiError {
  error: string;
  code: string;
  details?: unknown;
  /** HTTP status when thrown from ApiClient (for 401/403/5xx handling) */
  status?: number;
}

// JoyID CKB 实际签名登录数据结构
export interface JoyIDSignatureData {
  challenge: string; // 签名挑战明文
  message: string; // WebAuthn 客户端/认证器数据（base64url，无 padding）
  signature: string; // ES256 签名（base64url，无 padding）
  pubkey?: string; // 可选：P-256 未压缩公钥 hex（部分 SDK 会返回）
  alg?: number; // 可选：COSE 算法标识（通常 -7 代表 ES256）
  keyType?: string; // 可选："main_key" 等
}

export interface JoyIDAuthRequest {
  bitDomain?: string; // 可选：用于解析 .bit -> CKB 地址
  deviceFingerprint: string; // 设备指纹，用于绑定离线 Token
  signatureData: JoyIDSignatureData; // JoyID SDK 返回的签名数据
  address?: string; // 可选：JoyID connect 或 CCC 返回的 CKB 地址（优先使用）
  authType?: "ccc"; // 可选：当为 "ccc" 时后端信任 CCC 钱包连接，仅校验 nonce
}

export interface RoyaltyDistributionRequest {
  videoId: string;
  totalUSDI: USDI;
  participants: Array<{ address: string; ratio: number }>;
}

export interface RoyaltyDistributionResult {
  videoId: string;
  outputs: Array<{ address: string; amountUSDI: USDI }>;
  txId: string; // RGB++ 合约执行返回（Mock）
}

export interface UploadRequest {
  videoId: string;
  creatorCkbAddress: string;
  buyerCkbAddress?: string;
  base64Content: string; // 为简化测试，使用 Base64 输入
  contentType?: 'video' | 'audio' | 'article';
  enableArweave?: boolean; // 新增：是否上传到 Arweave 永久存储
}

export interface UploadResponse {
  record: EncryptedVideoRecord;
}

// 直传初始化请求/响应
export interface DirectUploadInitRequest {
  videoId: string;
  creatorCkbAddress: string;
}
export interface DirectUploadInitResponse {
  uploadURL: string;
  cfStreamUid: string;
}

// Cloudflare 视频状态查询响应
export interface CloudflareStatusResponse {
  uid: string;
  readyToStream?: boolean;
  status?: any;
}

// 分发授权请求
export interface EntitlementGrantRequest {
  videoId: string;
  userId: string;
}

export interface MetadataWriteRequest {
  meta: VideoMeta;
}

export interface MetadataWriteResponse {
  txHash: string;
}

export interface ResolveBitResponse {
  domain: string;
  ckbAddress: string;
}

export interface StreamTicket {
  videoId: string;
  jwt: string;
  signedAt: string;
}

export interface RateLimitConfig {
  requestsPerMinute: number;
}

export interface MonitoringMetrics {
  uptimeSeconds: number;
  requests: number;
  errors: number;
}

// 积分系统类型定义
export interface PointsBalance {
  balance: number; // 当前积分余额（整数）
  pointsPerUSDI: number; // 1 USDI 对应多少积分（例如 1000）
  updatedAt: string;
}

export type PointsTxnType = "earn" | "redeem" | "buy";

export interface PointsTransaction {
  id: string;
  userId: string;
  type: PointsTxnType;
  amount: number; // 变动的积分数量（正整数）
  reason?: string; // 可选：来源/说明
  videoId?: string; // 可选：关联视频
  createdAt: string;
}

// 恢复：积分兑换与发放请求类型
export interface PointsRedeemRequest { videoId: string; }
export interface PointsEarnRequest { amount: number; reason?: string; }

// 新增：用 USDI 购买积分请求/响应
export interface PointsBuyRequest {
  usdiAmount?: USDI;
  pointsAmount?: number;
}

export interface PointsBuyResult {
  ok: boolean;
  creditedPoints: number;
  pointsBalance: number;
  usdiAmount: USDI;
  pointsPerUSDI: number;
}

// 新增：用 CKB 购买积分请求/响应
export interface PointsBuyCKBRequest {
  ckbAmount?: CKB;
  pointsAmount?: number;
}

export interface PointsBuyCKBResult {
  ok: boolean;
  creditedPoints: number;
  pointsBalance: number;
  ckbAmount: CKB;
  pointsPerCKB: number;
}

export const isUSDI = (v: string): boolean => /^\d+(?:\.\d{1,6})?$/.test(v);
// 新增：CKB 金额格式校验（最多 8 位小数）
export const isCKB = (v: string): boolean => /^\d+(?:\.\d{1,8})?$/.test(v);

// 新增：Fiber 发票与状态相关类型
export type FiberAsset = "CKB" | "USDI" | string;
export interface FiberInvoiceCreateRequest {
  amount: string; // 十进制字符串
  asset: FiberAsset; // 资产类型，默认 CKB
  memo?: string;
  expirySeconds?: number; // 默认 300 秒
  pointsPreview?: number; // 前端预估积分（可选）
}
export interface FiberInvoiceCreateResponse {
  invoiceId?: string; // 链端返回或内部生成
  invoice: string; // 发票字符串（供复制/扫码）
  paymentHash?: string; // 可选：支付哈希
  expiresAt?: string; // ISO 时间
  amount: string;
  asset: FiberAsset;
  pointsToCredit: number;
  confirmChallenge?: string; // 可选：用于 JoyID 二次确认签名的挑战串
  payUrl?: string; // 可选：支付链接（通常等同于 invoice）
}
export interface FiberInvoiceStatusRequest {
  invoice?: string;
  invoiceId?: string;
  paymentHash?: string;
  signatureData?: any;
  address?: string;
}
export type FiberInvoiceStatus = "unpaid" | "paid" | "expired" | "canceled" | string;
export interface FiberInvoiceStatusResponse {
  invoiceId?: string;
  status: FiberInvoiceStatus;
  paidAt?: string;
  amountReceived?: string;
  paymentHash?: string;
  creditedPoints?: number;
}

export interface CkbPurchaseIntentRequest {
  ckbAmount?: string; // 十进制字符串，最多 8 位小数
  pointsAmount?: number; // 目标积分数量
}

export interface CkbPurchaseIntentResponse {
  orderId: string;
  depositAddress: string;
  expectedAmountCKB: string; // 十进制字符串
  expectedAmountShannons: string; // 以 Shannons 表示的整数字符串
  pointsToCredit: number;
  expiresAt: string; // ISO
}

export type CkbIntentStatus = "pending" | "confirmed" | "expired" | "failed";

export interface CkbIntentStatusResponse {
  orderId: string;
  status: CkbIntentStatus;
  confirmations?: number;
  creditedPoints?: number;
  expectedAmountShannons?: string;
  txHash?: string;
}

export interface CkbPurchaseConfirmRequest {
  orderId: string;
  txHash: string;
}

// ===== 打赏系统类型定义 =====
export interface TipRequest {
  videoId: string;           // 目标视频ID
  creatorAddress: string;    // 创作者CKB地址
  amount: number;            // 打赏积分数量
  message?: string;          // 可选：打赏留言
  showDanmaku?: boolean;     // 是否以弹幕形式展示
}

export interface TipRecord {
  id: string;
  videoId: string;
  fromUserId: string;
  fromAddress?: string;
  toCreatorAddress: string;
  amount: number;
  message?: string;
  showDanmaku: boolean;
  createdAt: string;
  txHash?: string;           // 可选：链上交易哈希（纯积分打赏可能无）
}

export interface TipLeaderboardEntry {
  rank: number;
  userId: string;
  displayName?: string;
  totalAmount: number;
  tipCount: number;
}
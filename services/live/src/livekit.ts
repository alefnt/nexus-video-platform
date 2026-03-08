// FILE: /video-platform/services/live/src/livekit.ts
/**
 * LiveKit WebRTC Server SDK 集成封装
 * 
 * 功能：
 * - 创建/管理直播间
 * - 生成访问 Token
 * - 录制控制
 * - 房间状态查询
 * 
 * 依赖: livekit-server-sdk
 */

import {
    AccessToken,
    RoomServiceClient,
    EgressClient,
    Room,
    ParticipantInfo,
    VideoGrant,
    TrackSource,
    DataPacket_Kind,
} from 'livekit-server-sdk';

// 配置
const LIVEKIT_URL = process.env.LIVEKIT_URL || 'ws://localhost:7880';
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || 'API7G63Reip94z9';
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || 'g7BEIVLH21JoHX2flUaeuAq7eBtDbqIwKXGIVPQDhepC';

// 检查配置
export function isConfigured(): boolean {
    return !!(LIVEKIT_API_KEY && LIVEKIT_API_SECRET && LIVEKIT_URL);
}

// 获取 HTTP URL（用于 RoomService API）
function getHttpUrl(): string {
    return LIVEKIT_URL
        .replace('wss://', 'https://')
        .replace('ws://', 'http://');
}

// Room Service Client
let roomService: RoomServiceClient | null = null;
function getRoomService(): RoomServiceClient {
    if (!roomService) {
        roomService = new RoomServiceClient(getHttpUrl(), LIVEKIT_API_KEY, LIVEKIT_API_SECRET);
    }
    return roomService;
}

// Egress Client (用于录制)
let egressClient: EgressClient | null = null;
function getEgressClient(): EgressClient {
    if (!egressClient) {
        egressClient = new EgressClient(getHttpUrl(), LIVEKIT_API_KEY, LIVEKIT_API_SECRET);
    }
    return egressClient;
}

/**
 * 直播间配置
 */
export interface RoomOptions {
    // 基本信息
    name: string;
    title?: string;
    creatorId: string;
    creatorAddress?: string;

    // 房间设置
    maxParticipants?: number;
    emptyTimeout?: number;  // 空房间自动关闭时间（秒）

    // 直播设置
    enableRecording?: boolean;
    category?: string;
    coverUrl?: string;
}

/**
 * Token 权限配置
 */
export interface TokenGrants {
    roomName: string;
    identity: string;
    name?: string;

    // 权限
    canPublish?: boolean;      // 可发布音视频（主播）
    canSubscribe?: boolean;    // 可订阅音视频（观众）
    canPublishData?: boolean;  // 可发送数据消息（弹幕）
    canPublishSources?: TrackSource[];  // 可发布的轨道类型

    // Token 有效期（秒）
    ttl?: number;
}

/**
 * 房间信息
 */
export interface RoomInfo {
    roomId: string;
    name: string;
    title: string;
    creatorId: string;
    creatorAddress?: string;
    status: 'live' | 'ended' | 'scheduled';
    participantCount: number;
    createdAt: string;
    category?: string;
    coverUrl?: string;
    isRecording?: boolean;
}

// 内存存储房间元数据（生产环境应使用数据库）
const roomMetadata = new Map<string, {
    title: string;
    creatorId: string;
    creatorAddress?: string;
    category?: string;
    coverUrl?: string;
    createdAt: string;
    egressId?: string;
}>();

/**
 * 创建直播间
 */
export async function createRoom(options: RoomOptions): Promise<RoomInfo> {
    const roomService = getRoomService();
    const roomName = `live-${options.creatorId}-${Date.now()}`;

    try {
        // 创建 LiveKit Room
        const room = await roomService.createRoom({
            name: roomName,
            emptyTimeout: options.emptyTimeout || 300, // 默认5分钟空房间超时
            maxParticipants: options.maxParticipants || 10000,
            metadata: JSON.stringify({
                title: options.title || '直播中',
                creatorId: options.creatorId,
                category: options.category,
            }),
        });

        // 保存元数据
        const metadata = {
            title: options.title || '直播中',
            creatorId: options.creatorId,
            creatorAddress: options.creatorAddress,
            category: options.category,
            coverUrl: options.coverUrl,
            createdAt: new Date().toISOString(),
        };
        roomMetadata.set(roomName, metadata);

        return {
            roomId: roomName,
            name: room.name,
            title: metadata.title,
            creatorId: metadata.creatorId,
            creatorAddress: metadata.creatorAddress,
            status: 'live',
            participantCount: 0,
            createdAt: metadata.createdAt,
            category: metadata.category,
            coverUrl: metadata.coverUrl,
        };
    } catch (err: any) {
        console.error('[LiveKit] Create room failed:', err);
        throw new Error(`创建直播间失败: ${err?.message || String(err)}`);
    }
}

/**
 * 生成访问 Token
 */
export async function generateToken(grants: TokenGrants): Promise<string> {
    const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
        identity: grants.identity,
        name: grants.name || grants.identity,
        ttl: grants.ttl ? `${grants.ttl}s` : '4h',
    });

    // 设置视频权限
    const videoGrant: VideoGrant = {
        room: grants.roomName,
        roomJoin: true,
        canPublish: grants.canPublish ?? false,
        canSubscribe: grants.canSubscribe ?? true,
        canPublishData: grants.canPublishData ?? true,
    };

    if (grants.canPublishSources) {
        videoGrant.canPublishSources = grants.canPublishSources;
    }

    at.addGrant(videoGrant);

    return await at.toJwt();
}

/**
 * 生成主播 Token
 */
export async function generateHostToken(
    roomName: string,
    identity: string,
    name?: string
): Promise<string> {
    return generateToken({
        roomName,
        identity,
        name,
        canPublish: true,
        canSubscribe: true,
        canPublishData: true,
        canPublishSources: [
            TrackSource.CAMERA,
            TrackSource.MICROPHONE,
            TrackSource.SCREEN_SHARE,
            TrackSource.SCREEN_SHARE_AUDIO,
        ],
        ttl: 3600 * 8, // 8小时
    });
}

/**
 * 生成观众 Token
 */
export async function generateViewerToken(
    roomName: string,
    identity: string,
    name?: string
): Promise<string> {
    return generateToken({
        roomName,
        identity,
        name,
        canPublish: false,
        canSubscribe: true,
        canPublishData: true, // 允许发送弹幕
        ttl: 3600 * 4, // 4小时
    });
}

/**
 * 获取房间信息
 */
export async function getRoom(roomName: string): Promise<RoomInfo | null> {
    const roomService = getRoomService();

    try {
        const rooms = await roomService.listRooms([roomName]);
        if (rooms.length === 0) {
            return null;
        }

        const room = rooms[0];
        const metadata = roomMetadata.get(roomName);

        return {
            roomId: roomName,
            name: room.name,
            title: metadata?.title || '直播中',
            creatorId: metadata?.creatorId || '',
            creatorAddress: metadata?.creatorAddress,
            status: 'live',
            participantCount: room.numParticipants,
            createdAt: metadata?.createdAt || new Date().toISOString(),
            category: metadata?.category,
            coverUrl: metadata?.coverUrl,
            isRecording: !!metadata?.egressId,
        };
    } catch (err: any) {
        console.error('[LiveKit] Get room failed:', err);
        return null;
    }
}

/**
 * 列出所有活跃房间
 */
export async function listRooms(): Promise<RoomInfo[]> {
    const roomService = getRoomService();

    try {
        const rooms = await roomService.listRooms();

        return rooms.map(room => {
            const metadata = roomMetadata.get(room.name);
            return {
                roomId: room.name,
                name: room.name,
                title: metadata?.title || '直播中',
                creatorId: metadata?.creatorId || '',
                creatorAddress: metadata?.creatorAddress,
                status: 'live' as const,
                participantCount: room.numParticipants,
                createdAt: metadata?.createdAt || new Date().toISOString(),
                category: metadata?.category,
                coverUrl: metadata?.coverUrl,
            };
        });
    } catch (err: any) {
        console.error('[LiveKit] List rooms failed:', err);
        return [];
    }
}

/**
 * 获取房间参与者列表
 */
export async function getParticipants(roomName: string): Promise<ParticipantInfo[]> {
    const roomService = getRoomService();

    try {
        return await roomService.listParticipants(roomName);
    } catch (err: any) {
        console.error('[LiveKit] Get participants failed:', err);
        return [];
    }
}

/**
 * 开始录制
 */
export async function startRecording(roomName: string): Promise<string> {
    const egressClient = getEgressClient();

    try {
        // Use room composite egress with file output
        // The LiveKit SDK expects the output as direct parameters, not nested objects
        const filepath = `/recordings/${roomName}-${Date.now()}.mp4`;

        const egressInfo = await egressClient.startRoomCompositeEgress(
            roomName,
            {
                file: {
                    filepath,
                    // Do NOT set fileType as string — the SDK infers it from filepath extension
                },
            },
            {
                layout: 'speaker',
                audioOnly: false,
            }
        );

        // 保存 egress ID
        const metadata = roomMetadata.get(roomName);
        if (metadata) {
            metadata.egressId = egressInfo.egressId;
        }

        return egressInfo.egressId;
    } catch (err: any) {
        console.error('[LiveKit] Start recording failed:', err);
        throw new Error(`开始录制失败: ${err?.message || String(err)}`);
    }
}

/**
 * 停止录制
 */
export async function stopRecording(roomName: string): Promise<{ egressId: string; filePath?: string }> {
    const egressClient = getEgressClient();
    const metadata = roomMetadata.get(roomName);

    if (!metadata?.egressId) {
        throw new Error('该房间未开始录制');
    }

    try {
        const egressInfo = await egressClient.stopEgress(metadata.egressId);

        // 清除 egress ID
        delete metadata.egressId;

        return {
            egressId: egressInfo.egressId,
            filePath: (egressInfo as any).file?.filename || (egressInfo as any).fileResults?.[0]?.filename,
        };
    } catch (err: any) {
        console.error('[LiveKit] Stop recording failed:', err);
        throw new Error(`停止录制失败: ${err?.message || String(err)}`);
    }
}

/**
 * 结束直播间
 */
export async function deleteRoom(roomName: string): Promise<boolean> {
    const roomService = getRoomService();

    try {
        await roomService.deleteRoom(roomName);
        roomMetadata.delete(roomName);
        return true;
    } catch (err: any) {
        console.error('[LiveKit] Delete room failed:', err);
        return false;
    }
}

/**
 * 发送数据消息到房间（用于系统通知、礼物广播等）
 */
export async function sendRoomMessage(
    roomName: string,
    message: string,
    topic: string = 'chat',  // 默认使用 'chat' topic 以匹配前端 useDataChannel
    destinationIdentities?: string[]
): Promise<void> {
    const roomService = getRoomService();

    try {
        await roomService.sendData(
            roomName,
            new TextEncoder().encode(message),
            DataPacket_Kind.RELIABLE,
            {
                topic,  // 指定 topic 以确保前端能正确接收
                destinationIdentities
            }
        );
        console.log(`[LiveKit] Message sent to room ${roomName} with topic '${topic}'`);
    } catch (err: any) {
        console.error('[LiveKit] Send message failed:', err);
    }
}

/**
 * 踢出参与者
 */
export async function removeParticipant(roomName: string, identity: string): Promise<void> {
    const roomService = getRoomService();

    try {
        await roomService.removeParticipant(roomName, identity);
    } catch (err: any) {
        console.error('[LiveKit] Remove participant failed:', err);
        throw new Error(`踢出参与者失败: ${err?.message || String(err)}`);
    }
}

/**
 * 静音参与者
 */
export async function muteParticipant(
    roomName: string,
    identity: string,
    muteAudio: boolean,
    muteVideo: boolean
): Promise<void> {
    const roomService = getRoomService();

    try {
        await roomService.mutePublishedTrack(
            roomName,
            identity,
            '', // trackSid - 空字符串表示所有轨道
            muteAudio
        );
    } catch (err: any) {
        console.error('[LiveKit] Mute participant failed:', err);
    }
}

// 导出配置信息
export const config = {
    url: LIVEKIT_URL,
    apiKey: LIVEKIT_API_KEY,
    isConfigured: isConfigured(),
};

// ============== 兼容性别名 (用于 server.ts 的 PK/录制功能) ==============

/**
 * 发送数据消息到房间 (别名)
 * 用于 PK 通知、礼物广播等
 */
export async function sendDataMessage(roomName: string, message: any): Promise<void> {
    const data = typeof message === 'string' ? message : JSON.stringify(message);
    await sendRoomMessage(roomName, data, 'system');
}

/**
 * 开始房间复合录制 (Egress)
 * 返回 egress 信息
 */
export async function startRoomCompositeEgress(
    roomName: string,
    options?: { file?: { fileType: string; filepath: string } }
): Promise<{ egressId: string } | null> {
    try {
        const egressId = await startRecording(roomName);
        return { egressId };
    } catch (e: any) {
        console.error('[LiveKit] startRoomCompositeEgress failed:', e.message);
        return null;
    }
}

/**
 * 停止 Egress 录制
 */
export async function stopEgress(egressId: string): Promise<void> {
    const egressClient = getEgressClient();
    try {
        await egressClient.stopEgress(egressId);
    } catch (e: any) {
        console.error('[LiveKit] stopEgress failed:', e.message);
    }
}

// FILE: /video-platform/client-mobile/screens/LiveViewScreen.tsx
/**
 * 直播观看页 - 使用 LiveKit
 */

import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    FlatList,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';

const API_BASE = 'http://localhost:8080';

interface ChatMessage {
    id: string;
    nickname: string;
    content: string;
    type: 'chat' | 'gift';
    giftIcon?: string;
}

export default function LiveViewScreen() {
    const route = useRoute<any>();
    const navigation = useNavigation();
    const { roomId } = route.params;

    const [room, setRoom] = useState<any>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputText, setInputText] = useState('');
    const [token, setToken] = useState('');

    useEffect(() => {
        fetchRoomInfo();
        joinRoom();
    }, [roomId]);

    const fetchRoomInfo = async () => {
        try {
            const res = await fetch(`${API_BASE}/live/room/${roomId}`);
            const data = await res.json();
            if (data.room) {
                setRoom(data.room);
                navigation.setOptions({ title: data.room.title });
            }
        } catch (e) {
            console.error('Fetch room failed', e);
        }
    };

    const joinRoom = async () => {
        try {
            const jwt = ''; // TODO: 从存储获取
            const res = await fetch(`${API_BASE}/live/room/${roomId}/join`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${jwt}`,
                },
            });
            const data = await res.json();
            if (data.token) {
                setToken(data.token);
                // TODO: 使用 LiveKit SDK 连接
            }
        } catch (e) {
            console.error('Join room failed', e);
        }
    };

    const sendMessage = () => {
        if (!inputText.trim()) return;

        // TODO: 通过 LiveKit DataChannel 发送
        const msg: ChatMessage = {
            id: Date.now().toString(),
            nickname: 'Me',
            content: inputText,
            type: 'chat',
        };
        setMessages(prev => [...prev, msg]);
        setInputText('');
    };

    const renderMessage = ({ item }: { item: ChatMessage }) => (
        <View style={styles.messageItem}>
            <Text style={styles.nickname}>{item.nickname}: </Text>
            {item.type === 'gift' && <Text>{item.giftIcon} </Text>}
            <Text style={styles.messageContent}>{item.content}</Text>
        </View>
    );

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            {/* 视频区域 */}
            <View style={styles.videoContainer}>
                {token ? (
                    <View style={styles.videoPlaceholder}>
                        <Text style={styles.placeholderText}>
                            🎬 LiveKit 视频流{'\n'}Token: {token.substring(0, 20)}...
                        </Text>
                    </View>
                ) : (
                    <View style={styles.videoPlaceholder}>
                        <Text style={styles.placeholderText}>加载中...</Text>
                    </View>
                )}

                {/* 直播信息覆盖层 */}
                <View style={styles.overlay}>
                    <View style={styles.topBar}>
                        <View style={styles.liveIndicator}>
                            <View style={styles.liveDot} />
                            <Text style={styles.liveText}>直播中</Text>
                        </View>
                        <Text style={styles.viewerCount}>
                            👁 {room?.viewerCount || 0}
                        </Text>
                    </View>
                </View>
            </View>

            {/* 聊天区域 */}
            <View style={styles.chatContainer}>
                <FlatList
                    data={messages}
                    renderItem={renderMessage}
                    keyExtractor={(item) => item.id}
                    style={styles.messageList}
                    inverted={false}
                />

                {/* 输入框 */}
                <View style={styles.inputContainer}>
                    <TextInput
                        style={styles.input}
                        placeholder="发送弹幕..."
                        placeholderTextColor="#666"
                        value={inputText}
                        onChangeText={setInputText}
                        onSubmitEditing={sendMessage}
                    />
                    <TouchableOpacity style={styles.sendButton} onPress={sendMessage}>
                        <Text style={styles.sendText}>发送</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.giftButton}>
                        <Text>🎁</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0d0d0d' },

    // 视频
    videoContainer: {
        width: '100%',
        aspectRatio: 16 / 9,
        backgroundColor: '#000',
    },
    videoPlaceholder: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#1a1a1a',
    },
    placeholderText: { color: '#666', textAlign: 'center' },

    // 覆盖层
    overlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        padding: 10,
    },
    topBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    liveIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 0, 0, 0.8)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
    },
    liveDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#fff',
        marginRight: 5,
    },
    liveText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
    viewerCount: { color: '#fff', fontSize: 14 },

    // 聊天
    chatContainer: { flex: 1 },
    messageList: { flex: 1, paddingHorizontal: 10 },
    messageItem: {
        flexDirection: 'row',
        paddingVertical: 5,
        flexWrap: 'wrap',
    },
    nickname: { color: '#66ccff', fontWeight: 'bold' },
    messageContent: { color: '#fff' },

    // 输入
    inputContainer: {
        flexDirection: 'row',
        padding: 10,
        borderTopWidth: 1,
        borderTopColor: '#333',
        alignItems: 'center',
    },
    input: {
        flex: 1,
        height: 40,
        backgroundColor: '#222',
        borderRadius: 20,
        paddingHorizontal: 15,
        color: '#fff',
    },
    sendButton: {
        marginLeft: 10,
        backgroundColor: '#9333ea',
        paddingHorizontal: 15,
        paddingVertical: 10,
        borderRadius: 20,
    },
    sendText: { color: '#fff', fontWeight: 'bold' },
    giftButton: {
        marginLeft: 10,
        padding: 10,
    },
});

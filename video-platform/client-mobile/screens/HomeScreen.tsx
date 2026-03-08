// FILE: /video-platform/client-mobile/screens/HomeScreen.tsx
/**
 * 首页 - 显示推荐视频和直播
 */

import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    FlatList,
    TouchableOpacity,
    Image,
    StyleSheet,
    RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';

const API_BASE = 'http://localhost:8080'; // 替换为实际API地址

interface Video {
    id: string;
    title: string;
    coverUrl?: string;
    views: number;
    creator: { nickname: string };
}

interface LiveRoom {
    roomId: string;
    title: string;
    coverUrl?: string;
    viewerCount: number;
    creatorName: string;
}

export default function HomeScreen() {
    const navigation = useNavigation<any>();
    const [videos, setVideos] = useState<Video[]>([]);
    const [liveRooms, setLiveRooms] = useState<LiveRoom[]>([]);
    const [refreshing, setRefreshing] = useState(false);

    const fetchData = async () => {
        try {
            // 获取推荐视频
            const videoRes = await fetch(`${API_BASE}/search/recommendations?limit=10`);
            const videoData = await videoRes.json();
            setVideos(videoData.recommendations || []);

            // 获取正在直播
            const liveRes = await fetch(`${API_BASE}/live/list`);
            const liveData = await liveRes.json();
            setLiveRooms(liveData.rooms || []);
        } catch (e) {
            console.error('Fetch failed', e);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchData();
        setRefreshing(false);
    };

    const renderLiveRoom = ({ item }: { item: LiveRoom }) => (
        <TouchableOpacity
            style={styles.liveCard}
            onPress={() => navigation.navigate('LiveView', { roomId: item.roomId })}
        >
            <Image
                source={{ uri: item.coverUrl || 'https://via.placeholder.com/150' }}
                style={styles.liveThumbnail}
            />
            <View style={styles.liveIndicator}>
                <Text style={styles.liveText}>🔴 LIVE</Text>
                <Text style={styles.viewerText}>{item.viewerCount} 观看</Text>
            </View>
            <Text style={styles.liveTitle} numberOfLines={1}>{item.title}</Text>
            <Text style={styles.creatorName}>{item.creatorName}</Text>
        </TouchableOpacity>
    );

    const renderVideo = ({ item }: { item: Video }) => (
        <TouchableOpacity
            style={styles.videoCard}
            onPress={() => navigation.navigate('Player', { videoId: item.id })}
        >
            <Image
                source={{ uri: item.coverUrl || 'https://via.placeholder.com/200x120' }}
                style={styles.videoThumbnail}
            />
            <Text style={styles.videoTitle} numberOfLines={2}>{item.title}</Text>
            <Text style={styles.videoMeta}>
                {item.creator?.nickname} · {item.views} 次观看
            </Text>
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            <FlatList
                data={[]}
                renderItem={() => null}
                ListHeaderComponent={
                    <>
                        {/* 正在直播 */}
                        {liveRooms.length > 0 && (
                            <View style={styles.section}>
                                <Text style={styles.sectionTitle}>🔴 正在直播</Text>
                                <FlatList
                                    horizontal
                                    data={liveRooms}
                                    renderItem={renderLiveRoom}
                                    keyExtractor={(item) => item.roomId}
                                    showsHorizontalScrollIndicator={false}
                                />
                            </View>
                        )}

                        {/* 推荐视频 */}
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>📺 推荐视频</Text>
                        </View>
                    </>
                }
                ListFooterComponent={
                    <FlatList
                        data={videos}
                        renderItem={renderVideo}
                        keyExtractor={(item) => item.id}
                        numColumns={2}
                        columnWrapperStyle={styles.videoRow}
                        scrollEnabled={false}
                    />
                }
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0d0d0d' },
    section: { marginBottom: 20 },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#fff',
        marginHorizontal: 15,
        marginBottom: 10,
    },

    // Live cards
    liveCard: { width: 160, marginLeft: 15 },
    liveThumbnail: {
        width: 160,
        height: 100,
        borderRadius: 8,
        backgroundColor: '#222',
    },
    liveIndicator: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 5,
    },
    liveText: { color: '#ff4444', fontSize: 12, fontWeight: 'bold' },
    viewerText: { color: '#888', fontSize: 12 },
    liveTitle: { color: '#fff', fontSize: 14, marginTop: 5 },
    creatorName: { color: '#888', fontSize: 12 },

    // Video cards
    videoRow: { justifyContent: 'space-between', paddingHorizontal: 10 },
    videoCard: { width: '48%', marginBottom: 15 },
    videoThumbnail: {
        width: '100%',
        aspectRatio: 16 / 9,
        borderRadius: 8,
        backgroundColor: '#222',
    },
    videoTitle: { color: '#fff', fontSize: 13, marginTop: 8 },
    videoMeta: { color: '#888', fontSize: 11, marginTop: 3 },
});

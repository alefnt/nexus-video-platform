// VideoPlayer.tsx 流支付集成代码片段
// 将以下代码添加到 VideoPlayer 组件中

// 1. 在组件顶部初始化流支付处理器（已完成）
// const streamHandlerRef = useRef<StreamPaymentHandler | null>(null);

// 2. 在组件挂载时初始化处理器（添加到某个 useEffect 中）
useEffect(() => {
    // 初始化流支付处理器
    const handler = new StreamPaymentHandler(
        client,
        setStatus,
        () => {
            if (playerRef.current) {
                playerRef.current.pause();
            }
        }
    );
    streamHandlerRef.current = handler;

    // 清理
    return () => {
        if (streamHandlerRef.current) {
            streamHandlerRef.current.cleanup();
        }
    };
}, []);

// 3. 在播放器初始化后设置 player 引用（添加到播放器创建的 useEffect 中）
useEffect(() => {
    // ... 现有的播放器初始化代码 ...

    // 设置流支付处理器的 player 引用
    if (streamHandlerRef.current && playerRef.current) {
        streamHandlerRef.current.setPlayer(playerRef.current);
    }
}, [/* 播放器依赖 */]);

// 4. 添加流支付按钮处理函数（在其他 handler 函数附近）
async function handleStreamPayment() {
    if (!streamHandlerRef.current || !meta || !id) {
        setStatus('流支付功能未就绪');
        return;
    }

    try {
        setStatus('正在初始化流支付...');

        const success = await streamHandlerRef.current.initStreamPayment({
            videoId: id,
            videoDuration: meta.durationSeconds || 0,
            pricePerMinute: meta.streamPricePerMinute || 1
        });

        if (success) {
            // 会话已初始化，可以播放
            setStatus('流支付已激活');

            // 如果播放器已准备好，开始播放
            if (playerRef.current) {
                playerRef.current.play();
            }
        } else {
            setStatus('流支付初始化失败');
        }
    } catch (err: any) {
        setStatus(`流支付错误: ${err?.message || String(err)}`);
        console.error('Stream payment error:', err);
    }
}

// 5. 在 UI 中添加流支付按钮（在支付按钮区域）
// 示例位置：在现有的购买按钮附近
{
    meta?.priceMode === 'stream' || meta?.priceMode === 'both' ? (
        <button
            className="button"
            onClick={handleStreamPayment}
            disabled={!meta || !id}
            style={{ marginLeft: 10 }}
        >
            流支付观看
        </button>
    ) : null
}

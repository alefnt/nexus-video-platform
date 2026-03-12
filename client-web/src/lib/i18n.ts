// FILE: /video-platform/client-web/src/lib/i18n.ts
/**
 * Internationalization (i18n) — Lightweight translation system
 * 
 * No external dependencies. Uses React context + JSON locale files.
 * Supports: en, zh, ja
 */

export type Locale = 'en' | 'zh' | 'ja';

const translations: Record<Locale, Record<string, string>> = {
    en: {
        // Navigation
        'nav.home': 'Home',
        'nav.explore': 'Explore',
        'nav.videos': 'Videos',
        'nav.music': 'Music',
        'nav.articles': 'Articles',
        'nav.live': 'Live',
        'nav.messages': 'Messages',
        'nav.notifications': 'Notifications',
        'nav.points': 'Points Center',
        'nav.marketplace': 'AI Marketplace',
        'nav.settings': 'Settings',
        'nav.profile': 'Profile',

        // Auth
        'auth.login': 'Login',
        'auth.logout': 'Logout',
        'auth.connect_wallet': 'Connect Wallet',
        'auth.joyid_login': 'Login with JoyID',

        // Payment
        'payment.balance': 'Balance',
        'payment.buy_once': 'One-Time Buy',
        'payment.stream_pay': 'Stream Pay',
        'payment.fiber_pay': 'Fiber Network',
        'payment.fiber_connected': 'Fiber Network Connected',
        'payment.fiber_onchain': 'On-chain settlement via CKB L2',
        'payment.pts_per_sec': 'PTS/SEC',
        'payment.pts_per_ch': 'PTS/CH',
        'payment.insufficient': 'Insufficient Balance',
        'payment.top_up': 'Top Up',
        'payment.cancel': 'Cancel',

        // Content
        'content.video': 'Video',
        'content.music': 'Music',
        'content.article': 'Article',
        'content.views': 'views',
        'content.likes': 'likes',
        'content.comments': 'Comments',
        'content.share': 'Share',
        'content.upload': 'Upload',

        // Search
        'search.placeholder': 'Search videos, music, articles...',
        'search.no_results': 'No results found',
        'search.try_different': 'Try different keywords',

        // Creator
        'creator.dashboard': 'Creator Dashboard',
        'creator.analytics': 'Analytics',
        'creator.earnings': 'Earnings',
        'creator.withdraw': 'Withdraw',
        'creator.nft_mint': 'Mint NFT',

        // Common
        'common.loading': 'Loading...',
        'common.error': 'Something went wrong',
        'common.retry': 'Retry',
        'common.save': 'Save',
        'common.close': 'Close',
        'common.confirm': 'Confirm',
        'common.back': 'Back',
        'common.next': 'Next',
        'common.skip': 'Skip',
        'common.done': 'Done',
    },
    zh: {
        // 导航
        'nav.home': '首页',
        'nav.explore': '发现',
        'nav.videos': '视频',
        'nav.music': '音乐',
        'nav.articles': '文章',
        'nav.live': '直播',
        'nav.messages': '消息',
        'nav.notifications': '通知',
        'nav.points': '积分中心',
        'nav.marketplace': 'AI 市场',
        'nav.settings': '设置',
        'nav.profile': '个人中心',

        // 认证
        'auth.login': '登录',
        'auth.logout': '退出',
        'auth.connect_wallet': '连接钱包',
        'auth.joyid_login': 'JoyID 登录',

        // 支付
        'payment.balance': '余额',
        'payment.buy_once': '一次购买',
        'payment.stream_pay': '流支付',
        'payment.fiber_pay': 'Fiber 网络',
        'payment.fiber_connected': 'Fiber 网络已连接',
        'payment.fiber_onchain': '通过 CKB L2 链上结算',
        'payment.pts_per_sec': '积分/秒',
        'payment.pts_per_ch': '积分/章',
        'payment.insufficient': '余额不足',
        'payment.top_up': '充值',
        'payment.cancel': '取消',

        // 内容
        'content.video': '视频',
        'content.music': '音乐',
        'content.article': '文章',
        'content.views': '观看',
        'content.likes': '点赞',
        'content.comments': '评论',
        'content.share': '分享',
        'content.upload': '上传',

        // 搜索
        'search.placeholder': '搜索视频、音乐、文章...',
        'search.no_results': '未找到结果',
        'search.try_different': '试试不同的关键词',

        // 创作者
        'creator.dashboard': '创作者面板',
        'creator.analytics': '数据分析',
        'creator.earnings': '收益',
        'creator.withdraw': '提现',
        'creator.nft_mint': '铸造 NFT',

        // 通用
        'common.loading': '加载中...',
        'common.error': '出了点问题',
        'common.retry': '重试',
        'common.save': '保存',
        'common.close': '关闭',
        'common.confirm': '确认',
        'common.back': '返回',
        'common.next': '下一步',
        'common.skip': '跳过',
        'common.done': '完成',
    },
    ja: {
        'nav.home': 'ホーム',
        'nav.explore': '探索',
        'nav.videos': '動画',
        'nav.music': '音楽',
        'nav.articles': '記事',
        'nav.live': 'ライブ',
        'nav.messages': 'メッセージ',
        'nav.notifications': '通知',
        'nav.points': 'ポイントセンター',
        'nav.marketplace': 'AIマーケット',
        'nav.settings': '設定',
        'nav.profile': 'プロフィール',
        'auth.login': 'ログイン',
        'auth.logout': 'ログアウト',
        'auth.connect_wallet': 'ウォレット接続',
        'auth.joyid_login': 'JoyIDでログイン',
        'payment.balance': '残高',
        'payment.buy_once': '一括購入',
        'payment.stream_pay': 'ストリーム支払い',
        'payment.fiber_pay': 'Fiberネットワーク',
        'payment.fiber_connected': 'Fiberネットワーク接続済み',
        'payment.insufficient': '残高不足',
        'payment.top_up': 'チャージ',
        'payment.cancel': 'キャンセル',
        'content.video': '動画',
        'content.music': '音楽',
        'content.article': '記事',
        'search.placeholder': '動画、音楽、記事を検索...',
        'search.no_results': '結果が見つかりません',
        'common.loading': '読み込み中...',
        'common.error': 'エラーが発生しました',
        'common.retry': '再試行',
        'common.save': '保存',
        'common.close': '閉じる',
        'common.confirm': '確認',
        'common.back': '戻る',
        'common.next': '次へ',
        'common.skip': 'スキップ',
        'common.done': '完了',
    },
};

// Get stored locale or detect from browser
export function getLocale(): Locale {
    const stored = localStorage.getItem('nexus.locale');
    if (stored && (stored === 'en' || stored === 'zh' || stored === 'ja')) return stored;
    const browser = navigator.language.slice(0, 2);
    if (browser === 'zh') return 'zh';
    if (browser === 'ja') return 'ja';
    return 'en';
}

export function setLocale(locale: Locale): void {
    localStorage.setItem('nexus.locale', locale);
    window.dispatchEvent(new CustomEvent('nexus-locale-change', { detail: locale }));
}

// Translation function
export function t(key: string, locale?: Locale): string {
    const l = locale || getLocale();
    return translations[l]?.[key] || translations.en[key] || key;
}

// React hook for i18n
import { useState, useEffect } from 'react';

export function useI18n() {
    const [locale, setLocaleState] = useState<Locale>(getLocale());

    useEffect(() => {
        const handler = (e: CustomEvent) => setLocaleState(e.detail);
        window.addEventListener('nexus-locale-change', handler as any);
        return () => window.removeEventListener('nexus-locale-change', handler as any);
    }, []);

    return {
        locale,
        t: (key: string) => t(key, locale),
        setLocale: (l: Locale) => {
            setLocale(l);
            setLocaleState(l);
        },
        locales: ['en', 'zh', 'ja'] as Locale[],
        localeLabels: { en: 'English', zh: '中文', ja: '日本語' } as Record<Locale, string>,
    };
}

/**
 * i18n 国际化配置
 * 
 * 支持语言: 中文 (zh), 英文 (en)
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import zh from './zh.json';
import en from './en.json';

const resources = {
    zh: { translation: zh },
    en: { translation: en },
};

i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        resources,
        fallbackLng: 'zh',
        supportedLngs: ['zh', 'en'],
        interpolation: {
            escapeValue: false, // React 已经做了 XSS 防护
        },
        detection: {
            order: ['localStorage', 'navigator', 'htmlTag'],
            caches: ['localStorage'],
            lookupLocalStorage: 'vp.lang',
        },
    });

export default i18n;

// 语言切换函数
export function changeLanguage(lang: 'zh' | 'en') {
    i18n.changeLanguage(lang);
    localStorage.setItem('vp.lang', lang);
}

// 获取当前语言
export function getCurrentLanguage(): 'zh' | 'en' {
    return (i18n.language?.startsWith('zh') ? 'zh' : 'en') as 'zh' | 'en';
}

// 支持的语言列表
export const supportedLanguages = [
    { code: 'zh', name: '中文', flag: '🇨🇳' },
    { code: 'en', name: 'English', flag: '🇺🇸' },
];

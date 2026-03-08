import React from 'react';
import ParticleBackground from '../components/ParticleBackground';
import { motion } from 'framer-motion';
import { FileText, ChevronRight, Zap, Shield, Layers, Users, Rocket, Music, Newspaper, Bot } from 'lucide-react';
import { useTranslation, Trans } from 'react-i18next';

const Section = ({ title, children, delay = 0 }: { title: string, children: React.ReactNode, delay?: number }) => (
    <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, delay }}
        className="mb-12"
    >
        <h2 className="text-3xl font-bold mb-6 flex items-center gap-3">
            <span className="w-1 h-8 bg-nexus-cyan rounded-full shadow-[0_0_10px_rgba(0,245,255,0.8)]"></span>
            <span className="text-white">{title}</span>
        </h2>
        <div className="text-gray-300 leading-relaxed text-lg space-y-4">
            {children}
        </div>
    </motion.div>
);

const Card = ({ title, icon: Icon, children }: { title: string, icon: any, children: React.ReactNode }) => (
    <div className="bg-white/5 border border-white/10 rounded-xl p-6 hover:border-nexus-cyan/50 transition-colors group">
        <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-nexus-cyan/10 rounded-lg group-hover:bg-nexus-cyan/20 transition-colors">
                <Icon className="text-nexus-cyan" size={24} />
            </div>
            <h3 className="text-xl font-bold text-white">{title}</h3>
        </div>
        <div className="text-gray-400">
            {children}
        </div>
    </div>
);

export default function Whitepaper() {
    const { t } = useTranslation();

    return (
        <div className="min-h-full text-white pb-20 relative overflow-x-hidden">
            <ParticleBackground particleCount={80} colors={["rgba(0,245,255,0.2)", "rgba(168,85,247,0.2)"]} />

            {/* Header */}
            <div className="relative pt-32 pb-20 container mx-auto px-6 text-center z-10">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.8 }}
                    className="inline-block mb-4 px-4 py-1.5 rounded-full border border-nexus-cyan/30 bg-nexus-cyan/10 text-nexus-cyan font-mono text-sm tracking-wider"
                >
                    {t('whitepaper.badge')}
                </motion.div>
                <motion.h1
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-5xl md:text-7xl font-black mb-6 bg-clip-text text-transparent bg-gradient-to-r from-nexus-cyan via-white to-nexus-purple drop-shadow-[0_0_20px_rgba(0,245,255,0.5)]"
                >
                    {t('whitepaper.title')}
                </motion.h1>
                <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="text-xl text-gray-400 max-w-2xl mx-auto"
                >
                    {t('whitepaper.subtitle')}
                </motion.p>
            </div>

            {/* Content */}
            <div className="container mx-auto max-w-4xl px-6 relative z-10">
                <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-3xl p-8 md:p-12 shadow-[0_0_50px_rgba(0,0,0,0.5)]">

                    <Section title={t('whitepaper.executiveSummary.title')}>
                        <p>
                            <Trans i18nKey="whitepaper.executiveSummary.p1" components={{ strong: <strong className="text-white" /> }} />
                        </p>
                        <p>
                            <Trans i18nKey="whitepaper.executiveSummary.p2" components={{ strong: <strong className="text-white" /> }} />
                        </p>
                    </Section>

                    <Section title={t('whitepaper.painPoints.title')}>
                        <div className="grid md:grid-cols-2 gap-6 mt-6">
                            <Card title={t('whitepaper.painPoints.creators.title')} icon={Users}>
                                <ul className="list-disc list-inside space-y-2">
                                    {(t('whitepaper.painPoints.creators.items', { returnObjects: true }) as string[]).map((item, i) => (
                                        <li key={i}><Trans defaults={item} components={{ strong: <strong /> }} /></li>
                                    ))}
                                </ul>
                            </Card>
                            <Card title={t('whitepaper.painPoints.users.title')} icon={Shield}>
                                <ul className="list-disc list-inside space-y-2">
                                    {(t('whitepaper.painPoints.users.items', { returnObjects: true }) as string[]).map((item, i) => (
                                        <li key={i}><Trans defaults={item} components={{ strong: <strong /> }} /></li>
                                    ))}
                                </ul>
                            </Card>
                        </div>
                    </Section>

                    <Section title={t('whitepaper.solution.title')}>
                        <p><Trans i18nKey="whitepaper.solution.intro" components={{ strong: <strong /> }} /></p>

                        <div className="space-y-6 mt-6">
                            <div className="pl-6 border-l-2 border-nexus-purple/50">
                                <h3 className="text-xl font-bold text-white mb-2">{t('whitepaper.solution.content.title')}</h3>
                                <p className="text-base">{t('whitepaper.solution.content.desc')}</p>
                            </div>
                            <div className="pl-6 border-l-2 border-nexus-pink/50">
                                <h3 className="text-xl font-bold text-white mb-2">{t('whitepaper.solution.w2e.title')}</h3>
                                <p className="text-base"><Trans i18nKey="whitepaper.solution.w2e.desc" components={{ strong: <strong /> }} /></p>
                            </div>
                            <div className="pl-6 border-l-2 border-yellow-400/50">
                                <h3 className="text-xl font-bold text-white mb-2">{t('whitepaper.solution.optimization.title')}</h3>
                                <p className="text-base">{t('whitepaper.solution.optimization.desc')}</p>
                            </div>
                        </div>
                    </Section>

                    {/* New Ecosystem Section */}
                    <Section title={t('whitepaper.ecosystem.title')}>
                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
                            {/* Live Streaming & AI */}
                            <Card title={t('whitepaper.ecosystem.live.title')} icon={Bot}>
                                <ul className="list-disc list-inside space-y-2">
                                    {(t('whitepaper.ecosystem.live.items', { returnObjects: true }) as string[]).map((item, i) => (
                                        <li key={i}><Trans defaults={item} components={{ strong: <strong /> }} /></li>
                                    ))}
                                </ul>
                            </Card>

                            {/* Music */}
                            <Card title={t('whitepaper.ecosystem.music.title')} icon={Music}>
                                <ul className="list-disc list-inside space-y-2">
                                    {(t('whitepaper.ecosystem.music.items', { returnObjects: true }) as string[]).map((item, i) => (
                                        <li key={i}><Trans defaults={item} components={{ strong: <strong /> }} /></li>
                                    ))}
                                </ul>
                            </Card>

                            {/* Publishing */}
                            <Card title={t('whitepaper.ecosystem.publishing.title')} icon={Newspaper}>
                                <ul className="list-disc list-inside space-y-2">
                                    {(t('whitepaper.ecosystem.publishing.items', { returnObjects: true }) as string[]).map((item, i) => (
                                        <li key={i}><Trans defaults={item} components={{ strong: <strong /> }} /></li>
                                    ))}
                                </ul>
                            </Card>
                        </div>
                    </Section>

                    <Section title={t('whitepaper.roadmap.title')}>
                        <div className="space-y-4">
                            <div className="flex gap-4 opacity-50">
                                <div className="font-mono text-nexus-cyan shrink-0 w-24">Q1 2026</div>
                                <div>
                                    <div className="font-bold text-white">{t('whitepaper.roadmap.q1.title')}</div>
                                    <div className="text-sm">{t('whitepaper.roadmap.q1.desc')}</div>
                                </div>
                            </div>
                            <div className="flex gap-4 relative">
                                <div className="absolute -left-3 top-2 w-2 h-2 bg-nexus-pink rounded-full animate-pulse"></div>
                                <div className="font-mono text-nexus-pink shrink-0 w-24">Q2 2026</div>
                                <div>
                                    <div className="font-bold text-white">{t('whitepaper.roadmap.q2.title')}</div>
                                    <div className="text-sm">{t('whitepaper.roadmap.q2.desc')}</div>
                                </div>
                            </div>
                            <div className="flex gap-4">
                                <div className="font-mono text-gray-500 shrink-0 w-24">Q3 2026</div>
                                <div>
                                    <div className="font-bold text-gray-400">{t('whitepaper.roadmap.q3.title')}</div>
                                    <div className="text-sm">{t('whitepaper.roadmap.q3.desc')}</div>
                                </div>
                            </div>
                            <div className="flex gap-4">
                                <div className="font-mono text-nexus-cyan/50 shrink-0 w-24">2027+</div>
                                <div>
                                    <div className="font-bold text-nexus-cyan">{t('whitepaper.roadmap.phase4.title')}</div>
                                    <div className="text-sm text-nexus-cyan/80">{t('whitepaper.roadmap.phase4.desc')}</div>
                                </div>
                            </div>
                        </div>
                    </Section>

                    <div className="mt-16 pt-10 border-t border-white/10 text-center">
                        <h3 className="text-2xl font-bold text-white mb-6">{t('whitepaper.footer.title')}</h3>
                        <p className="text-gray-400 mb-8">{t('whitepaper.footer.subtitle')}</p>
                        <button className="px-8 py-3 bg-gradient-to-r from-nexus-cyan to-nexus-blue text-black font-bold rounded-lg hover:shadow-[0_0_30px_rgba(0,245,212,0.4)] transition-all flex items-center gap-2 mx-auto">
                            <Rocket size={18} />
                            {t('whitepaper.footer.cta')}
                        </button>
                    </div>

                </div>
            </div>
        </div>
    );
}

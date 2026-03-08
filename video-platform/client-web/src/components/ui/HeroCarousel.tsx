import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { LazyImage } from './LazyImage';

export interface HeroSlide {
    id: string;
    title: string;
    description: string;
    imageUrl: string;
    videoUrl?: string; // Optional background video
    link: string;
    tags?: string[];
}

interface HeroCarouselProps {
    slides: HeroSlide[];
}

export const HeroCarousel: React.FC<HeroCarouselProps> = ({ slides }) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const navigate = useNavigate();

    // Auto-play
    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentIndex((prev) => (prev + 1) % slides.length);
        }, 8000);
        return () => clearInterval(timer);
    }, [slides.length]);

    if (!slides || slides.length === 0) return null;

    const currentSlide = slides[currentIndex];

    return (
        <div className="relative w-full h-[500px] md:h-[600px] overflow-hidden rounded-2xl group border border-white/5 shadow-2xl">
            <AnimatePresence mode='wait'>
                <motion.div
                    key={currentSlide.id}
                    initial={{ opacity: 0, scale: 1.1 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.8 }}
                    className="absolute inset-0 w-full h-full"
                >
                    {/* Background Image (lazy) */}
                    <LazyImage
                        src={currentSlide.imageUrl}
                        alt={currentSlide.title}
                        className="absolute inset-0 w-full h-full object-cover"
                    />

                    {/* Gradient Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-nexus-space via-nexus-space/50 to-transparent" />
                    <div className="absolute inset-0 bg-gradient-to-r from-nexus-space via-transparent to-transparent" />
                </motion.div>
            </AnimatePresence>

            {/* Content */}
            <div className="absolute inset-0 flex flex-col justify-end p-8 md:p-16 z-10 max-w-3xl">
                <motion.div
                    key={`content-${currentSlide.id}`}
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.2, duration: 0.5 }}
                >
                    {/* Tags */}
                    <div className="flex gap-2 mb-4">
                        {currentSlide.tags?.map(tag => (
                            <span key={tag} className="px-3 py-1 bg-white/10 backdrop-blur-md rounded-full text-xs font-bold uppercase tracking-wider text-nexus-cyan border border-nexus-cyan/20">
                                {tag}
                            </span>
                        ))}
                    </div>

                    <h1 className="text-4xl md:text-6xl font-display font-bold text-white mb-4 leading-tight drop-shadow-lg">
                        {currentSlide.title}
                    </h1>
                    <p className="text-text-secondary text-lg mb-8 line-clamp-2 max-w-xl">
                        {currentSlide.description}
                    </p>

                    <div className="flex gap-4">
                        <button
                            onClick={() => navigate(currentSlide.link)}
                            className="px-8 py-3.5 bg-nexus-cyan text-black font-bold rounded-full hover:scale-105 transition-transform shadow-[0_0_20px_rgba(0,245,212,0.4)] flex items-center gap-2 overflow-visible leading-normal"
                        >
                            <span>▶</span> Watch Now
                        </button>
                        <button
                            className="px-8 py-3.5 bg-white/10 backdrop-blur-md border border-white/20 text-white font-bold rounded-full hover:bg-white/20 transition-colors flex items-center gap-2 group/btn overflow-visible leading-normal"
                        >
                            <span>+</span> Add to List
                        </button>
                    </div>
                </motion.div>
            </div>

            {/* Indicators */}
            <div className="absolute bottom-8 right-8 flex gap-2 z-20">
                {slides.map((_, idx) => (
                    <button
                        key={idx}
                        onClick={() => setCurrentIndex(idx)}
                        className={`w-3 h-3 rounded-full transition-all duration-300 ${idx === currentIndex ? 'bg-nexus-cyan w-8' : 'bg-white/30 hover:bg-white/60'}`}
                    />
                ))}
            </div>
        </div>
    );
};

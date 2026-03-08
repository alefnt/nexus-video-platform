/**
 * 任务中心页面
 * 
 * 功能增强...
 * - 任务卡片完成庆祝动画
 * - 签到按钮打卡效果
 * - 进度条动画优...
 * - 奖励领取动画
 * - Skeleton 加载状...
 */

import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getApiClient } from "../lib/apiClient";
import { Target, Flame, Calendar, Film, MessageSquare, Share2, Radio, CheckCircle, FileText, Gift, Sparkles, Zap } from "lucide-react";
import { useSound } from "../hooks/useSound";

const client = getApiClient();

interface DailyTask {
    type: string;
    name: string;
    description: string;
    points: number;
    requirement: number;
    progress: number;
    completed: boolean;
    rewardClaimed: boolean;
}

export default function Tasks() {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const [tasks, setTasks] = useState<DailyTask[]>([]);
    const [loading, setLoading] = useState(true);
    const [streak, setStreak] = useState(0);
    const [todayCheckedIn, setTodayCheckedIn] = useState(false);
    const [checkinLoading, setCheckinLoading] = useState(false);
    const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
    const [celebrateTask, setCelebrateTask] = useState<string | null>(null);
    const [checkinCelebrate, setCheckinCelebrate] = useState(false);
    const [claimLoading, setClaimLoading] = useState<string | null>(null);
    const { play: playSound } = useSound();

    const jwt = typeof window !== "undefined" ? sessionStorage.getItem("vp.jwt") : null;
    const user = React.useMemo(() => {
        try {
            const raw = sessionStorage.getItem("vp.user");
            return raw ? JSON.parse(raw) : null;
        } catch {
            return null;
        }
    }, []);

    if (jwt) client.setJWT(jwt);

    useEffect(() => {
        loadTasks();
    }, []);

    // 自动清除消息
    useEffect(() => {
        if (message) {
            const timer = setTimeout(() => setMessage(null), 4000);
            return () => clearTimeout(timer);
        }
    }, [message]);

    const loadTasks = async () => {
        if (!user?.id) return;
        try {
            const res = await client.get<{ tasks: DailyTask[]; streak: number; todayCheckedIn: boolean }>(
                `/engagement/tasks/daily?userId=${user.id}`
            );
            setTasks(res.tasks || []);
            setStreak(res.streak || 0);
            setTodayCheckedIn(res.todayCheckedIn || false);
        } catch (err) {
            console.error("Load tasks failed:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleCheckin = async () => {
        if (!user?.id || checkinLoading) return;
        setCheckinLoading(true);
        try {
            const res = await client.post<{ success: boolean; streak: number; points: number; message: string }>(
                "/engagement/checkin",
                { userId: user.id }
            );
            if (res.success) {
                playSound('checkin');
                setCheckinCelebrate(true);
                setTimeout(() => setCheckinCelebrate(false), 2000);
                setMessage({ text: res.message, type: "success" });
                setStreak(res.streak);
                setTodayCheckedIn(true);
                loadTasks();
            }
        } catch (err: any) {
            setMessage({ text: err?.message || t('tasks.checkinFailed'), type: "error" });
        } finally {
            setCheckinLoading(false);
        }
    };

    const handleClaimReward = async (taskType: string) => {
        if (!user?.id || claimLoading) return;
        try {
            setClaimLoading(taskType);
            setCelebrateTask(taskType);
            const res = await client.post<{ success: boolean; points: number; message: string }>(
                "/engagement/tasks/claim",
                { userId: user.id, taskType }
            );
            if (res.success) {
                playSound('coin');
                setMessage({ text: res.message, type: "success" });
                setTimeout(() => {
                    setCelebrateTask(null);
                    setClaimLoading(null);
                    loadTasks();
                }, 1500);
            } else {
                setClaimLoading(null);
            }
        } catch (err: any) {
            setCelebrateTask(null);
            setClaimLoading(null);
            setMessage({ text: err?.message || t('tasks.claimFailed'), type: "error" });
        }
    };

    const getTaskIcon = (type: string) => {
        const iconProps = { size: 24, strokeWidth: 1.5 };
        switch (type) {
            case 'checkin': return <Calendar {...iconProps} />;
            case 'watch_videos': return <Film {...iconProps} />;
            case 'comment': return <MessageSquare {...iconProps} />;
            case 'share': return <Share2 {...iconProps} />;
            case 'live_watch': return <Radio {...iconProps} />;
            default: return <CheckCircle {...iconProps} />;
        }
    };

    // Skeleton loading component
    const TaskSkeleton = () => (
        <div className="flex flex-col gap-3">
            {[1, 2, 3].map(i => (
                <div key={i} className="bg-[#0a0a14]/60 p-4 border border-white/5 rounded-xl animate-pulse">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-white/10" />
                        <div className="flex-1 space-y-2">
                            <div className="h-4 bg-white/10 rounded w-1/3" />
                            <div className="h-2 bg-white/10 rounded w-full" />
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );

    return (
        <div className="text-gray-200 font-sans w-full relative min-h-full">
            {/* Background glow */}
            <div className="absolute top-[-10%] right-[10%] w-[50vw] h-[50vh] bg-[radial-gradient(circle,rgba(234,179,8,0.15)_0%,transparent_70%)] blur-[80px] pointer-events-none z-0"></div>

            {/* Main Content Area */}
            <div className="px-4 py-8 relative z-10 w-full">
                <div className="max-w-6xl mx-auto flex flex-col gap-8 w-full">
                    {/* Header */}
                    <div className="text-center">
                        <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-yellow-500 to-purple-500 flex items-center justify-center text-2xl mb-4 shadow-[0_0_30px_rgba(234,179,8,0.4)] relative">
                            <div className="absolute inset-0 bg-white opacity-20 animate-ping rounded-full"></div>
                            🎯
                        </div>
                        <h1 className="text-3xl font-black text-white mb-2 tracking-wide font-display">Quests & Rewards</h1>
                        <p className="text-sm text-gray-400">Complete daily tasks, spin the wheel, and collect points.</p>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                        {/* Left Column: Tasks & Check-in */}
                        <div className="lg:col-span-2 flex flex-col gap-6">

                            {/* 1. Daily Check-in Card */}
                            <div className="bg-[#0a0a14]/60 backdrop-blur-md border border-cyan-400/30 p-8 rounded-2xl relative overflow-hidden group">
                                <div className="absolute inset-0 bg-gradient-to-r from-cyan-400/5 to-transparent"></div>

                                <div className="flex justify-between items-center mb-8 relative z-10 flex-wrap gap-4">
                                    <div className="flex items-center gap-4">
                                        <div className="text-5xl font-black bg-gradient-to-br from-cyan-400 to-purple-500 text-transparent bg-clip-text drop-shadow-sm font-mono">
                                            {streak}
                                        </div>
                                        <div>
                                            <h2 className="text-xl font-bold text-white tracking-widest font-display">Day Streak</h2>
                                            <p className="text-xs text-gray-400 mt-1">Check in {7 - (streak % 7 || 7) + (todayCheckedIn ? 1 : 0)} more days for a 7x Bonus Box.</p>
                                        </div>
                                    </div>
                                    <button
                                        className={`px-6 py-3 rounded-full text-sm font-bold transition-all uppercase tracking-widest z-10 relative pointer-events-auto shadow-[0_0_15px_rgba(34,211,238,0.2)] focus:ring-2 focus:ring-cyan-400 ${todayCheckedIn ? "bg-cyan-400/10 text-cyan-400 border border-cyan-400/30 cursor-not-allowed opacity-50" : "bg-cyan-400/20 text-cyan-400 hover:bg-cyan-400 hover:text-black border border-cyan-400/50 cursor-pointer"}`}
                                        onClick={handleCheckin}
                                        disabled={todayCheckedIn || checkinLoading}
                                    >
                                        {checkinLoading ? "Processing..." : todayCheckedIn ? "...Checked In" : "...Check In Now"}
                                    </button>
                                </div>

                                {/* Streak Tracker */}
                                <div className="flex justify-between gap-2 relative z-10 overflow-x-auto pb-2">
                                    {[1, 2, 3, 4, 5, 6, 7].map((day) => {
                                        const streakLevel = streak % 7 === 0 && streak > 0 ? 7 : streak % 7;
                                        const currentStreakLevel = todayCheckedIn ? streakLevel : streakLevel + 1;
                                        const isCompleted = day < currentStreakLevel || (todayCheckedIn && day === currentStreakLevel);
                                        const isToday = day === currentStreakLevel && !todayCheckedIn;

                                        if (day === 7) {
                                            return (
                                                <div key={day} className={`flex-1 min-w-[60px] rounded-lg p-3 text-center relative ${isCompleted ? 'bg-yellow-500/20 border border-yellow-500/50' : 'bg-yellow-500/10 border border-yellow-500/30'}`}>
                                                    <div className="absolute -top-2 -right-2 bg-yellow-500 text-black text-[9px] font-black px-1.5 rounded">7x</div>
                                                    <div className="text-[10px] text-yellow-500 uppercase font-bold tracking-widest mb-1">Day 7</div>
                                                    <div className={`font-mono text-xl ${isCompleted ? 'text-white' : 'text-yellow-500'}`}>{isCompleted ? '✅' : '🎁'}</div>
                                                </div>
                                            );
                                        }

                                        if (isCompleted) {
                                            return (
                                                <div key={day} className="flex-1 min-w-[60px] bg-cyan-400/20 border border-cyan-400/40 rounded-lg p-3 text-center active">
                                                    <div className="text-[10px] text-cyan-400 uppercase font-bold tracking-widest mb-1">Day {day}</div>
                                                    <div className="text-white">✅</div>
                                                </div>
                                            );
                                        }

                                        if (isToday) {
                                            return (
                                                <div key={day} className="flex-1 min-w-[60px] bg-black/50 border border-white/20 rounded-lg p-3 text-center relative overflow-hidden">
                                                    <div className="absolute inset-0 border-2 border-dashed border-cyan-400 opacity-50"></div>
                                                    <div className="text-[10px] text-gray-400 uppercase font-bold tracking-widest mb-1">Day {day}</div>
                                                    <div className="text-gray-600 font-mono text-xs">+50</div>
                                                </div>
                                            );
                                        }

                                        return (
                                            <div key={day} className="flex-1 min-w-[60px] bg-black/30 border border-white/5 rounded-lg p-3 text-center">
                                                <div className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-1">Day {day}</div>
                                                <div className="text-gray-600 font-mono text-xs">+50</div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {message && (
                                <div className={`p-4 rounded-xl border flex items-center gap-3 text-sm font-bold animate-slide-up ${message.type === 'success' ? 'bg-cyan-400/10 text-cyan-400 border-cyan-400/20' : 'bg-red-500/10 text-red-500 border-red-500/20'}`}>
                                    <span>{message.text}</span>
                                </div>
                            )}

                            {/* 2. Daily Tasks List */}
                            <div>
                                <h2 className="text-sm font-bold text-white uppercase tracking-widest mb-4 flex items-center gap-2 border-b border-white/10 pb-2">
                                    <span className="text-purple-500">🎁</span> Daily Tasks
                                </h2>

                                {loading ? (
                                    <TaskSkeleton />
                                ) : (
                                    <div className="flex flex-col gap-3">
                                        {tasks.filter((t) => t.type !== "checkin").map((task) => {
                                            if (task.rewardClaimed) {
                                                return (
                                                    <div key={task.type} className="bg-[#0a0a14]/80 backdrop-blur-md p-4 flex items-center justify-between border border-white/5 opacity-60 rounded-xl">
                                                        <div className="flex items-center gap-4">
                                                            <div className="w-12 h-12 rounded-xl bg-green-500/10 text-green-500 flex items-center justify-center text-xl">✅</div>
                                                            <div>
                                                                <h3 className="font-bold text-white text-sm">{task.name}</h3>
                                                                <div className="flex items-center gap-3 mt-1.5">
                                                                    <div className="w-32 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                                                                        <div className="h-full bg-green-500" style={{ width: '100%' }}></div>
                                                                    </div>
                                                                    <span className="text-[10px] text-gray-500 font-mono">{task.requirement}/{task.requirement}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="flex flex-col items-end gap-1">
                                                            <span className="text-gray-500 text-xs font-mono">+{task.points} PTS</span>
                                                            <span className="bg-white/5 text-gray-400 px-3 py-1 rounded text-[10px] uppercase tracking-widest font-bold">Claimed</span>
                                                        </div>
                                                    </div>
                                                );
                                            }

                                            if (task.completed) {
                                                return (
                                                    <div key={task.type} className="bg-[#0a0a14]/60 backdrop-blur-md p-4 flex items-center justify-between border border-yellow-500/30 relative overflow-hidden group rounded-xl">
                                                        <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/5 to-transparent"></div>
                                                        <div className="flex items-center gap-4 relative z-10">
                                                            <div className="w-12 h-12 rounded-xl bg-yellow-500/10 text-yellow-500 flex items-center justify-center text-xl">🎁</div>
                                                            <div>
                                                                <h3 className="font-bold text-white text-sm">{task.name}</h3>
                                                                <p className="text-[10px] text-yellow-500/80 mt-0.5 max-w-[200px] truncate">{task.description}</p>
                                                                <div className="flex items-center gap-3 mt-1.5">
                                                                    <div className="w-32 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                                                                        <div className="h-full bg-yellow-500" style={{ width: '100%' }}></div>
                                                                    </div>
                                                                    <span className="text-[10px] text-gray-500 font-mono">{task.requirement}/{task.requirement}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="flex flex-col items-end gap-2 relative z-10 pointer-events-auto">
                                                            <span className="text-yellow-500 text-sm font-bold font-mono">+{task.points} PTS</span>
                                                            <button
                                                                className="bg-yellow-500 text-black hover:bg-yellow-400 px-4 py-1.5 rounded-lg text-xs uppercase tracking-widest font-bold font-sans transition-colors shadow-[0_0_10px_rgba(234,179,8,0.5)] animate-pulse cursor-pointer disabled:opacity-50 pointer-events-auto relative z-10"
                                                                onClick={() => handleClaimReward(task.type)}
                                                                disabled={claimLoading === task.type}
                                                            >
                                                                {claimLoading === task.type ? "Claiming..." : "Claim Reward"}
                                                            </button>
                                                        </div>
                                                    </div>
                                                );
                                            }

                                            return (
                                                <div key={task.type} className="bg-[#0a0a14]/60 backdrop-blur-md p-4 flex items-center justify-between border border-white/10 hover:border-cyan-400/30 transition-colors rounded-xl">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-12 h-12 rounded-xl bg-cyan-400/10 text-cyan-400 flex items-center justify-center">{getTaskIcon(task.type)}</div>
                                                        <div>
                                                            <h3 className="font-bold text-white text-sm">{task.name}</h3>
                                                            <p className="text-[10px] text-gray-500 mt-0.5 max-w-[200px] truncate">{task.description}</p>
                                                            <div className="flex items-center gap-3 mt-1.5">
                                                                <div className="w-32 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                                                                    <div className="h-full bg-cyan-400" style={{ width: `${Math.min((task.progress / task.requirement) * 100, 100)}%` }}></div>
                                                                </div>
                                                                <span className="text-[10px] text-gray-500 font-mono">{task.progress}/{task.requirement}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-col items-end gap-2 text-right">
                                                        <span className="text-cyan-400 text-sm font-bold font-mono w-max">+{task.points} PTS</span>
                                                        <span className="text-[10px] text-gray-500 uppercase tracking-widest font-bold w-max">In Progress</span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            {/* Rules */}
                            <div className="bg-[#0a0a14] p-6 mt-4 opacity-70 text-xs text-gray-400 border border-white/5 rounded-2xl">
                                <h3 className="font-bold text-white mb-2 flex items-center gap-2"><span className="text-lg">📄</span> Rules</h3>
                                <ul className="list-disc pl-5 space-y-1">
                                    <li>{t('tasks.rule1', 'Tasks reset daily at 00:00 UTC.')}</li>
                                    <li>{t('tasks.rule2', 'Unclaimed rewards expire upon reset.')}</li>
                                    <li>{t('tasks.rule3', 'Points can be used to purchase content or withdrawn.')}</li>
                                    <li>{t('tasks.rule4', 'Abuse of the task system will result in point deduction.')}</li>
                                </ul>
                            </div>

                        </div>

                        {/* Right Column: Spin Wheel */}
                        <div className="flex flex-col gap-6">
                            <div className="bg-[#0a0a14]/60 backdrop-blur-md p-8 flex flex-col items-center text-center relative overflow-hidden border border-yellow-500/20 rounded-[2rem]">
                                <div className="absolute inset-0 bg-gradient-to-b from-yellow-500/5 to-transparent"></div>

                                <h2 className="text-xl font-bold text-white tracking-widest font-display mb-2 relative z-10">Daily Spin</h2>
                                <p className="text-xs text-gray-400 mb-8 relative z-10">Use points to spin. Win up to 10,000 PTS or exclusive Fragments!</p>

                                <div className="relative z-10 mb-10 w-full flex justify-center py-4">
                                    {/* Pointer */}
                                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[15px] border-l-transparent border-r-[15px] border-r-transparent border-t-[30px] border-t-white z-[30] drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]"></div>

                                    {/* Wheel */}
                                    <div className="w-[240px] h-[240px] rounded-full shadow-[0_0_40px_rgba(234,179,8,0.2)] animate-[spin_15s_linear_infinite] relative" style={{ background: 'conic-gradient(#22d3ee 0deg 60deg, #a855f7 60deg 120deg, #ec4899 120deg 180deg, #eab308 180deg 240deg, #3b82f6 240deg 300deg, #10b981 300deg 360deg)' }}>
                                        <div className="absolute inset-[10px] bg-[#0A0A14] rounded-full z-10"></div>
                                        <div className="absolute inset-[60px] bg-white/5 border border-white/10 rounded-full z-20 flex items-center justify-center backdrop-blur-sm">
                                            <span className="text-4xl">🎰</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="w-full relative z-10">
                                    <div className="flex justify-between text-xs font-mono text-gray-400 mb-2 px-2">
                                        <span>Cost: 50 PTS</span>
                                        <span>Try your luck!</span>
                                    </div>
                                    <button className="w-full bg-yellow-500 text-black hover:bg-yellow-400 py-4 rounded-xl font-bold uppercase tracking-widest transition-all shadow-[0_0_20px_rgba(234,179,8,0.3)] hover:shadow-[0_0_30px_rgba(234,179,8,0.5)] focus:ring-4 focus:ring-yellow-500/50 cursor-pointer pointer-events-auto" onClick={async () => {
                                        if (!user?.id) { setMessage({ text: "Please login first", type: "error" }); return; }
                                        try {
                                            const res = await client.post<{ success: boolean; reward: number; rewardType: string; message: string }>("/engagement/spin", { userId: user.id });
                                            if (res.success) {
                                                playSound('coin');
                                                setMessage({ text: res.message || `🎉 You won ${res.reward} ${res.rewardType}!`, type: "success" });
                                            } else {
                                                setMessage({ text: res.message || "Spin failed — not enough points", type: "error" });
                                            }
                                        } catch (err: any) {
                                            setMessage({ text: err?.message || "Spin failed", type: "error" });
                                        }
                                    }}>
                                        Spin Wheel
                                    </button>

                                </div>

                                <div className="mt-6 w-full bg-black/40 rounded-lg p-3 border border-white/5 text-left relative z-10">
                                    <div className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-2">Recent Winners</div>
                                    <div className="text-xs font-mono text-gray-400 space-y-1">
                                        <div className="flex justify-between items-center bg-white/5 px-2 py-1 rounded">
                                            <span className="text-cyan-400">ckb...a8f</span>
                                            <span className="text-white font-bold">+500 PTS</span>
                                        </div>
                                        <div className="flex justify-between items-center bg-white/5 px-2 py-1 rounded">
                                            <span className="text-purple-500">neon.bit</span>
                                            <span className="text-purple-500 font-bold">Fragment NFT</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
}

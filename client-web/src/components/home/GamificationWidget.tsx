import React, { useMemo } from "react";
import { Trophy, Key, Check, Loader2, Calendar } from "lucide-react";
import { Button } from "../ui";
import { useNavigate } from "react-router-dom";
import { useUIStore, useAuthStore } from "../../stores";
import { useDailyTasks, useCheckin, useClaimTask } from "../../hooks/useApi";

export const GamificationWidget = () => {
    const navigate = useNavigate();
    const { user } = useAuthStore();
    const addToast = useUIStore(s => s.addToast);

    // Real Data Hooks
    const { data: dailyData, isLoading } = useDailyTasks();
    const { mutate: checkin, isPending: isCheckingIn } = useCheckin();
    const { mutate: claimTask, isPending: isClaiming } = useClaimTask();

    const streak = dailyData?.streak || 0;
    const todayCheckedIn = dailyData?.todayCheckedIn || false;
    const tasks = dailyData?.tasks || [];

    // Find the watch task for progress
    const watchTask = tasks.find(t => t.type === "watch_videos");
    const watchProgress = watchTask ? Math.min(watchTask.progress, watchTask.requirement) : 0;
    const watchRequirement = watchTask ? watchTask.requirement : 60;
    const watchPercent = watchRequirement > 0 ? (watchProgress / watchRequirement) * 100 : 0;

    // Find first completed but unclaimed task
    const claimableTask = tasks.find(t => t.completed && !t.rewardClaimed);
    const allClaimed = tasks.length > 0 && tasks.every(t => !t.completed || t.rewardClaimed);

    const isPending = isCheckingIn || isClaiming;

    // Daily active circles logic
    const days = ["M", "T", "W", "T", "F", "S", "S"];
    const todayIndex = (new Date().getDay() + 6) % 7; // 0=Monday, ...

    const handleAction = () => {
        if (!user) {
            navigate('/login');
            return;
        }

        if (!todayCheckedIn) {
            checkin(undefined, {
                onSuccess: () => addToast("success", "Checked in! Streak +1 🔥")
            });
        } else if (claimableTask) {
            claimTask(claimableTask.type, {
                onSuccess: () => addToast("success", `Claimed ${claimableTask.points} NXP!`)
            });
        } else {
            navigate('/tasks');
        }
    };

    if (!user) {
        return (
            <div className="h-full p-6 flex flex-col justify-center items-center bg-gradient-to-br from-nexus-purple/20 to-black/40 text-center gap-4">
                <Trophy className="w-8 h-8 text-white/20" />
                <p className="text-sm text-gray-400">Login to unlock Daily Quests</p>
                <Button size="sm" onClick={() => navigate('/login')} className="bg-nexus-cyan text-black w-full">Sign In</Button>
            </div>
        );
    }

    return (
        <div className="h-full p-6 flex flex-col justify-between bg-gradient-to-br from-nexus-purple/20 to-black/40">
            <div>
                <div className="flex items-center justify-between mb-3 w-full">
                    <h3 className="text-base font-bold text-white flex items-center gap-2 truncate">
                        <Trophy className="w-4 h-4 text-yellow-400 flex-shrink-0" />
                        <span className="truncate">Daily Quests</span>
                    </h3>
                    <span className="text-[10px] font-mono text-nexus-cyan bg-nexus-cyan/10 px-1.5 py-0.5 rounded border border-nexus-cyan/30 ml-2 flex-shrink-0">
                        LVL 4
                    </span>
                </div>

                {/* Login Streak */}
                <div className="mb-6">
                    <div className="flex justify-between text-xs text-gray-400 mb-2">
                        <span>Login Streak</span>
                        {isLoading ? (
                            <span className="w-12 h-4 bg-white/10 rounded animate-pulse" />
                        ) : (
                            <span className="text-white font-bold">{streak} Days 🔥</span>
                        )}
                    </div>
                    <div className="flex justify-between gap-1">
                        {days.map((d, i) => {
                            let statusClass = 'bg-white/5 text-gray-500';

                            // Simple visual logic based on streak
                            const isPastStreak = streak > 0 && i < todayIndex && i >= (todayIndex - streak);
                            if (isPastStreak || (i === todayIndex && todayCheckedIn)) {
                                statusClass = 'bg-nexus-cyan text-black shadow-[0_0_10px_rgba(0,245,212,0.4)]';
                            } else if (i === todayIndex && !todayCheckedIn) {
                                statusClass = 'bg-nexus-pink text-white animate-pulse shadow-[0_0_10px_rgba(255,46,147,0.6)] cursor-pointer';
                            }

                            return (
                                <div
                                    key={i}
                                    onClick={i === todayIndex && !todayCheckedIn ? handleAction : undefined}
                                    className={`w-full aspect-square rounded-md flex items-center justify-center text-[10px] font-bold transition-all duration-300 ${statusClass}`}
                                >
                                    {d}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Watch Time Progress */}
                <div>
                    <div className="flex justify-between text-xs text-gray-400 mb-1">
                        <span>Watch to Earn</span>
                        {isLoading ? (
                            <span className="w-12 h-4 bg-white/10 rounded animate-pulse" />
                        ) : (
                            <span className="text-nexus-cyan">{watchProgress} / {watchRequirement}</span>
                        )}
                    </div>
                    <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-nexus-purple to-nexus-cyan transition-all duration-500 shadow-[0_0_10px_rgba(0,245,212,0.5)]"
                            style={{ width: `${watchPercent}%` }}
                        />
                    </div>
                </div>
            </div>

            <Button
                variant={(!todayCheckedIn || claimableTask) ? "primary" : "ghost"}
                size="sm"
                className={`w-full mt-4 text-xs transition-all duration-300 flex items-center justify-center gap-2 ${(!todayCheckedIn || claimableTask) ? "bg-nexus-cyan text-black hover:bg-nexus-cyan/80 shadow-[0_0_15px_rgba(0,245,212,0.3)]" : "border border-white/10 hover:bg-nexus-purple/20 text-white"}`}
                onClick={handleAction}
                disabled={isPending || isLoading}
            >
                {isPending ? (
                    <>
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span>Processing...</span>
                    </>
                ) : !todayCheckedIn ? (
                    <>
                        <Calendar className="w-3 h-3" />
                        <span>Check In Today</span>
                    </>
                ) : claimableTask ? (
                    <>
                        <Key className="w-3 h-3" />
                        <span>Claim {claimableTask.points} NXP</span>
                    </>
                ) : (
                    <>
                        <Check className="w-3 h-3 text-nexus-cyan" />
                        <span>View My Tasks</span>
                    </>
                )}
            </Button>
        </div>
    );
};

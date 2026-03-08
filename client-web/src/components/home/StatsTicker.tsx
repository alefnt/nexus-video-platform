import React from "react";
import CountUp from "react-countup";
import { TrendingUp, Activity, Users, Box } from "lucide-react";

export const StatsTicker = () => {
    return (
        <div className="h-full flex flex-col justify-between p-6 bg-gradient-to-br from-black/40 to-black/10">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-nexus-cyan/10">
                        <Activity className="w-5 h-5 text-nexus-cyan" />
                    </div>
                    <span className="text-sm font-medium text-nexus-cyan/80 tracking-wider">NETWORK STATUS</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-xs text-green-500 font-bold">ONLINE</span>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-4">
                <StatItem
                    label="NXP PRICE"
                    val={0.85}
                    prefix="$"
                    decimals={2}
                    icon={<TrendingUp className="w-3.5 h-3.5 text-green-400" />}
                    trend="+12.5%"
                />
                <StatItem
                    label="BLOCK HEIGHT"
                    val={1294821}
                    separator=","
                    icon={<Box className="w-3.5 h-3.5 text-nexus-purple" />}
                />
                <StatItem
                    label="ACTIVE NODES"
                    val={4218}
                    separator=","
                    icon={<Users className="w-3.5 h-3.5 text-blue-400" />}
                />
                <StatItem
                    label="24H TXNS"
                    val={89234}
                    separator=","
                    icon={<Activity className="w-3.5 h-3.5 text-orange-400" />}
                />
            </div>
        </div>
    );
};

const StatItem = ({ label, val, prefix = "", suffix = "", decimals = 0, separator = "", icon, trend }: any) => (
    <div className="group/stat relative p-2.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 hover:border-nexus-cyan/30 transition-all duration-300">
        <div className="flex justify-between items-center mb-1">
            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">{label}</span>
            {icon}
        </div>
        <div className="text-lg font-black text-white group-hover/stat:text-nexus-cyan transition-colors truncate">
            <CountUp end={val} prefix={prefix} suffix={suffix} decimals={decimals} separator={separator} duration={2.5} />
        </div>
        {trend && (
            <div className="text-[9px] font-bold text-green-400">{trend}</div>
        )}
    </div>
);

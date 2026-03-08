// FILE: /video-platform/client-web/src/components/layout/AppLayout.tsx
/**
 * AppLayout — 全局布局组件
 *
 * 左侧 Sidebar (264px) + 右侧 main area (TopBar + page content)
 * 替代原来的 TopNav + BottomTabBar 布局
 */

import React from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";

export default function AppLayout() {
    return (
        <div className="flex h-screen overflow-hidden" style={{ background: "#030308" }}>
            {/* Sidebar */}
            <Sidebar />

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col h-full relative overflow-hidden">
                {/* TopBar */}
                <TopBar />

                {/* Page Content (scrollable) */}
                <div className="flex-1 overflow-y-auto nexus-main-scroll">
                    <Outlet />
                </div>
            </main>
        </div>
    );
}

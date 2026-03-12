
// FILE: /video-platform/client-web/src/main.tsx
/**
 * 功能说明：
 * - React 入口文件，挂载 App 与路由。
 * - 集成 PWA 更新检测
 * - 集成 CCC 钱包
 */

// Browser polyfills (placed before any other imports)
import { Buffer as BufferPolyfill } from "buffer";
if (typeof (globalThis as any).Buffer === "undefined") {
  (globalThis as any).Buffer = BufferPolyfill;
}

// CCC imports for CKB wallet integration
import { ccc } from "@ckb-ccc/connector-react";

import "./index.css";
import "./i18n";
import { initWebVitals } from "./lib/monitoring";
import { initAnalytics } from "./lib/analytics";

import React, { useEffect } from "react";
import { createRoot } from "react-dom/client";
import {
  createBrowserRouter,
  createRoutesFromElements,
  RouterProvider,
  Route,
  Navigate,
  Outlet,
  useLocation,
} from "react-router-dom";
// Small / critical pages — eager loaded
import Login from "./pages/Login";
import MobileJoyID from "./pages/MobileJoyID";
import TwitterCallback from "./pages/TwitterCallback";
import GoogleCallback from "./pages/GoogleCallback";
import TikTokCallback from "./pages/TikTokCallback";
import YouTubeCallback from "./pages/YouTubeCallback";
import BilibiliCallback from "./pages/BilibiliCallback";
import MagicLink from "./pages/MagicLink";
import Explore from "./pages/Explore";
import Notifications from "./pages/Notifications";
import Home from "./pages/Home";

// Large pages — lazy loaded for better initial bundle
const HomePreview = React.lazy(() => import("./pages/HomePreview"));
const VideoList = React.lazy(() => import("./pages/VideoList"));
const VideoPlayer = React.lazy(() => import("./pages/VideoPlayer"));
const VideoFeed = React.lazy(() => import("./pages/VideoFeed"));
const MusicFeed = React.lazy(() => import("./pages/MusicFeed"));
const MusicPlaylist = React.lazy(() => import("./pages/MusicPlaylist"));
const ArticleFeed = React.lazy(() => import("./pages/ArticleFeed"));
const PlatformBindings = React.lazy(() => import("./pages/PlatformBindings"));
const AIMusicLab = React.lazy(() => import("./pages/AIMusicLab"));
const AIArticleLab = React.lazy(() => import("./pages/AIArticleLab"));
const AIVideoLab = React.lazy(() => import("./pages/AIVideoLab"));
const MyAITools = React.lazy(() => import("./pages/MyAITools"));
const CreatorUpload = React.lazy(() => import("./pages/CreatorUpload"));
const UserCenter = React.lazy(() => import("./pages/UserCenter"));
const PointsCenter = React.lazy(() => import("./pages/PointsCenter"));
const StreamPaymentDemo = React.lazy(() => import("./pages/StreamPaymentDemo"));
const DAOGovernance = React.lazy(() => import("./pages/DAOGovernance"));
const AIRoyaltyDashboard = React.lazy(() => import("./pages/AIRoyaltyDashboard"));
const Live = React.lazy(() => import("./pages/Live"));
const ChannelPage = React.lazy(() => import("./pages/ChannelPage"));
const LiveStudio = React.lazy(() => import("./pages/LiveStudio"));
const VideoCollection = React.lazy(() => import("./pages/VideoCollection"));
const Tasks = React.lazy(() => import("./pages/Tasks"));
// Lazy load heavy pages to reduce initial bundle size
const AboutNexus = React.lazy(() => import("./pages/AboutNexus"));
const AboutMinimalPreview = React.lazy(() => import("./pages/AboutMinimalPreview"));
const PreAbout = React.lazy(() => import("./pages/PreAbout"));
const WatchParty = React.lazy(() => import("./pages/WatchParty"));
const FragmentGallery = React.lazy(() => import("./pages/FragmentGallery"));
const Achievements = React.lazy(() => import("./pages/Achievements"));
const DAOVoting = React.lazy(() => import("./pages/DAOVoting"));
const DailyWheel = React.lazy(() => import("./pages/DailyWheel"));
const CreatorNFT = React.lazy(() => import("./pages/CreatorNFT"));
const Profile = React.lazy(() => import("./pages/Profile"));
const Whitepaper = React.lazy(() => import("./pages/Whitepaper"));
const SearchResults = React.lazy(() => import("./pages/SearchResults"));
const Messages = React.lazy(() => import("./pages/Messages"));
const CreatorDashboard = React.lazy(() => import("./pages/CreatorDashboard"));
const VideoEditor = React.lazy(() => import("./pages/VideoEditor"));
const CrossPost = React.lazy(() => import("./pages/CrossPost"));
const LiveChannels = React.lazy(() => import("./pages/LiveChannels"));
const CreatorAnalytics = React.lazy(() => import("./pages/CreatorAnalytics"));
const CreatorContent = React.lazy(() => import("./pages/CreatorContent"));
const CreatorContracts = React.lazy(() => import("./pages/CreatorContracts"));
const CreatorPass = React.lazy(() => import("./pages/CreatorPass"));
const NotFound = React.lazy(() => import("./pages/NotFound"));
const ArticleEditor = React.lazy(() => import("./pages/ArticleEditor"));
const NFTMarketplace = React.lazy(() => import("./pages/NFTMarketplace"));
const AISettings = React.lazy(() => import("./pages/AISettings"));
const AIToolMarketplace = React.lazy(() => import("./pages/AIToolMarketplace"));
const AIToolSubmit = React.lazy(() => import("./pages/AIToolSubmit"));

import { ToastProvider } from "./components/Toast";
import { getApiClient } from "./lib/apiClient";
import { GlobalMusicProvider } from "./contexts/GlobalMusicContext";
const GlobalMiniPlayer = React.lazy(() => import("./components/GlobalMiniPlayer"));
import "./styles/fun.css";

// React Query (唯一缓存方案)
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 60000,
      retry: (failureCount: number, error: unknown) => {
        if ((error as any)?.status === 401) return false;
        return failureCount < 2;
      },
      retryDelay: (attempt: number) => Math.min(1000 * 2 ** attempt, 10000),
    },
  },
});

// Service Worker Update Check
import { useRegisterSW } from "virtual:pwa-register/react";

function SWHandler() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      r && setInterval(() => { r.update(); }, 60 * 60 * 1000); // Check every hour
    },
  });

  return needRefresh ? (
    <div className="fixed bottom-4 right-4 z-50 p-4 bg-gray-900 border border-green-500 rounded-lg shadow-2xl animate-fade-in flex flex-col gap-2">
      <div className="text-green-400 font-bold text-sm">New Version Available</div>
      <button
        className="px-3 py-1 bg-green-500 text-black font-bold rounded text-xs hover:bg-green-400 transition-colors"
        onClick={() => updateServiceWorker(true)}
      >
        Reload to Update
      </button>
      <button
        className="text-gray-500 text-xs hover:text-white"
        onClick={() => setNeedRefresh(false)}
      >
        Close
      </button>
    </div>
  ) : null;
}

// 开发者模式自动登录开关
const devAutoEnabled = (import.meta as any)?.env?.VITE_DEV_AUTO_LOGIN === "1";

function RouteTracker() {
  const loc = useLocation();
  useEffect(() => {
    try {
      window.scrollTo(0, 0);
      const current = `${loc.pathname}${loc.search || ""}`;
      const prev = sessionStorage.getItem("vp.currentRoute");
      if (prev) sessionStorage.setItem("vp.lastRoute", prev);
      sessionStorage.setItem("vp.currentRoute", current);

      // Handle Invite Code
      const params = new URLSearchParams(loc.search);
      const invite = params.get("invite");
      if (invite) {
        sessionStorage.setItem("vp.inviteCode", invite);
      }

      // Try to claim referral ONCE per session (not on every route change)
      const inviteCode = sessionStorage.getItem("vp.inviteCode");
      const jwt = sessionStorage.getItem("vp.jwt");
      const alreadyClaimed = sessionStorage.getItem("vp.referralClaimed");
      if (inviteCode && jwt && !alreadyClaimed) {
        sessionStorage.setItem("vp.referralClaimed", "1"); // Prevent re-firing
        const client = getApiClient();
        client.setJWT(jwt);
        client.post<{ rewarded?: boolean; bonus?: number; message?: string }>("/growth/referral/claim", { inviteCode })
          .then((res) => {
            if (res?.rewarded) {
              console.log("Referral Bonus Claimed!", res);
              sessionStorage.removeItem("vp.inviteCode");
            } else if (res?.message === "Already claimed referral bonus") {
              sessionStorage.removeItem("vp.inviteCode");
            }
          }).catch(() => { });
      }
    } catch { }
  }, [loc.pathname, loc.search]);
  return null;
}

// import { NoiseOverlay } from "./components/ui/NoiseOverlay";
import { ErrorBoundary } from "./components/ErrorBoundary";
import AppLayout from "./components/layout/AppLayout";
import TopNavLayout from "./components/layout/TopNavLayout";
import { GlobalToast } from "./components/GlobalToast";
import { RouteProgressBar } from "./components/ui/RouteProgressBar";
import { RouteErrorBoundary } from "./components/ErrorBoundary";

// Suspense fallback component
const PageLoader = () => (
  <div style={{
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#030308',
    color: '#fff'
  }}>
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 48, marginBottom: 16, animation: 'pulse 1.5s infinite' }}>🎬</div>
      <div style={{ color: 'rgba(255,255,255,0.6)' }}>Loading...</div>
    </div>
  </div>
);

const WalletBindPrompt = React.lazy(() => import("./components/WalletBindPrompt"));
const OnboardingTour = React.lazy(() => import("./components/OnboardingTour"));

/**
 * Root layout — minimal shell with progress bar, SW handler, route tracker.
 * Child routes determine their own chrome (AppLayout for sidebar pages, bare for full-screen pages).
 */
function RootLayout() {
  // Show WalletBindPrompt for logged-in users without CKB wallet
  const jwt = typeof window !== "undefined" ? sessionStorage.getItem("vp.jwt") : null;
  const userRaw = typeof window !== "undefined" ? sessionStorage.getItem("vp.user") : null;
  const user = userRaw ? (() => { try { return JSON.parse(userRaw); } catch { return null; } })() : null;
  const showBindPrompt = !!(jwt && user && !user?.ckbAddress);

  return (
    <>
      <RouteProgressBar />
      <SWHandler />
      <RouteTracker />
      <React.Suspense fallback={<PageLoader />}>
        <Outlet />
      </React.Suspense>
      {showBindPrompt && (
        <React.Suspense fallback={null}>
          <WalletBindPrompt />
        </React.Suspense>
      )}
      {/* Global persistent music mini-player */}
      <React.Suspense fallback={null}>
        <GlobalMiniPlayer />
      </React.Suspense>
      {/* Onboarding tour for first-time users */}
      <React.Suspense fallback={null}>
        <OnboardingTour />
      </React.Suspense>
    </>
  );
}


const router = createBrowserRouter(
  createRoutesFromElements(
    <Route element={<RootLayout />}>
      {/* Redirect root */}
      <Route path="/" element={<Navigate to="/home" replace />} />

      {/* ====== Full-screen pages (no sidebar) ====== */}
      <Route errorElement={<RouteErrorBoundary />}>
        <Route path="/login" element={<Login />} />
        <Route path="/feed" element={<VideoFeed />} />
        <Route path="/player/:id" element={<VideoPlayer />} />
        <Route path="/stream-demo/:id" element={<StreamPaymentDemo />} />
        <Route path="/live/:roomId" element={<Live />} />
        <Route path="/room/create" element={<LiveStudio />} />
        <Route path="/room/studio/:roomId" element={<LiveStudio />} />
        <Route path="/preview-home" element={<HomePreview />} />
        <Route path="/preview-about" element={<AboutMinimalPreview />} />
        <Route path="/pre-about" element={<PreAbout />} />

        {/* Auth callbacks */}
        <Route path="/magic-link" element={<MagicLink />} />
        <Route path="/joyid/mobile-callback" element={<MobileJoyID />} />
        <Route path="/auth/twitter/callback" element={<TwitterCallback />} />
        <Route path="/auth/google/callback" element={<GoogleCallback />} />
        <Route path="/auth/tiktok/callback" element={<TikTokCallback />} />
        <Route path="/auth/youtube/callback" element={<YouTubeCallback />} />
        <Route path="/auth/bilibili/callback" element={<BilibiliCallback />} />
      </Route>

      {/* ====== Top Nav layout pages (no sidebar, matching concept design) ====== */}
      <Route element={<TopNavLayout />} errorElement={<RouteErrorBoundary />}>
        <Route path="/videos" element={<VideoList />} />
        <Route path="/music" element={<MusicFeed />} />
        <Route path="/articles" element={<ArticleFeed />} />
        <Route path="/explore" element={<Explore />} />
        <Route path="/live" element={<LiveChannels />} />
      </Route>

      {/* ====== Sidebar layout pages ====== */}
      <Route element={<AppLayout />} errorElement={<RouteErrorBoundary />}>
        {/* Main pages */}
        <Route path="/home" element={<Home />} />
        <Route path="/search" element={<SearchResults />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/music-v2" element={<MusicPlaylist />} />
        <Route path="/settings/platforms" element={<PlatformBindings />} />
        <Route path="/settings/ai" element={<AISettings />} />
        <Route path="/studio/ai/music" element={<AIMusicLab />} />
        <Route path="/studio/ai/article" element={<AIArticleLab />} />
        <Route path="/studio/ai/video" element={<AIVideoLab />} />
        <Route path="/ai-tools" element={<AIToolMarketplace />} />
        <Route path="/ai-tools/submit" element={<AIToolSubmit />} />
        <Route path="/my-ai-tools" element={<MyAITools />} />

        {/* User & Economy */}
        <Route path="/user" element={<UserCenter />} />
        <Route path="/points" element={<PointsCenter />} />
        <Route path="/tasks" element={<Tasks />} />
        <Route path="/achievements" element={<Achievements />} />
        <Route path="/dao" element={<DAOGovernance />} />
        <Route path="/creator/royalties" element={<AIRoyaltyDashboard />} />
        <Route path="/wheel" element={<DailyWheel />} />
        <Route path="/fragments" element={<FragmentGallery />} />

        {/* Content */}
        <Route path="/live/@:username" element={<ChannelPage />} />
        <Route path="/watch-party" element={<WatchParty />} />
        <Route path="/profile/:address" element={<Profile />} />
        <Route path="/collection/:videoId" element={<VideoCollection />} />
        <Route path="/messages" element={<Messages />} />

        {/* Creator (moved from TopNavLayout for consistent sidebar) */}
        <Route path="/creator/upload" element={<CreatorUpload />} />
        <Route path="/creator/dashboard" element={<CreatorDashboard />} />
        <Route path="/creator/analytics" element={<CreatorAnalytics />} />
        <Route path="/creator/content" element={<CreatorContent />} />
        <Route path="/creator/contracts" element={<CreatorContracts />} />
        <Route path="/creator/pass" element={<CreatorPass />} />
        <Route path="/creator/editor" element={<VideoEditor />} />
        <Route path="/creator/crosspost" element={<CrossPost />} />
        <Route path="/creator/nft" element={<CreatorNFT />} />

        {/* Info */}
        <Route path="/about" element={<AboutNexus />} />
        <Route path="/whitepaper" element={<Whitepaper />} />

        {/* New: Article Editor + NFT Marketplace */}
        <Route path="/article/create" element={<ArticleEditor />} />
        <Route path="/marketplace" element={<NFTMarketplace />} />

        {/* 404 Not Found */}
        <Route path="*" element={<NotFound />} />
      </Route>
    </Route>
  )
);

// Dev Auto Login Logic
async function tryDevAutoLogin() {
  try {
    const isDev = (import.meta as any)?.env?.DEV;
    const hasJwt = typeof window !== "undefined" && !!sessionStorage.getItem("vp.jwt");
    if (!isDev || !devAutoEnabled || hasJwt) return;

    const client = getApiClient();
    const res: any = await client.post("/auth/joyid", {
      bitDomain: "developer.bit",
      joyIdAssertion: "dev-mode",
      deviceFingerprint: "dev-fingerprint",
    });
    if (res?.jwt) {
      sessionStorage.setItem("vp.jwt", res.jwt);
      sessionStorage.setItem("vp.user", JSON.stringify(res.user || {}));
    }
  } catch (e) {
    console.warn("Dev auto-login failed", e);
  }
}

// Entry Point
(async () => {
  try { await tryDevAutoLogin(); } catch { }
  initWebVitals();
  initAnalytics();

  const container = document.getElementById("root")!;
  // Reuse existing root during Vite HMR to avoid "createRoot on same container" warning
  if (!(window as any).__REACT_ROOT__) {
    (window as any).__REACT_ROOT__ = createRoot(container);
  }
  const root = (window as any).__REACT_ROOT__;

  root.render(
    <ErrorBoundary>
      <ccc.Provider
        preferredNetworks={[
          {
            addressPrefix: "ckt",
            signerType: ccc.SignerType.CKB,
            network: "testnet",
          },
        ]}
      >
        <QueryClientProvider client={queryClient}>
          <GlobalMusicProvider>
            <ToastProvider>
              <GlobalToast />
              <RouterProvider router={router} />
            </ToastProvider>
          </GlobalMusicProvider>
        </QueryClientProvider>
      </ccc.Provider>
    </ErrorBoundary>
  );
})();
import { useRouteError, isRouteErrorResponse, useNavigate } from "react-router-dom";

export function RouteErrorBoundary() {
  const error = useRouteError();
  const navigate = useNavigate();

  const is404 = isRouteErrorResponse(error) && error.status === 404;

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-6 py-20 text-center bg-[#0A0A10]">
      {/* Icon */}
      <div className="text-6xl mb-6 animate-pulse">
        {is404 ? "🔍" : "⚡"}
      </div>

      {/* Title */}
      <h1 className="text-3xl font-bold mb-3 bg-gradient-to-r from-purple-400 via-cyan-400 to-green-400 bg-clip-text text-transparent">
        {is404 ? "Page Not Found" : "Something Went Wrong"}
      </h1>

      {/* Message */}
      <p className="text-white/50 max-w-md mb-8 leading-relaxed">
        {is404
          ? "The page you're looking for doesn't exist or has been moved."
          : (error instanceof Error
              ? error.message
              : "An unexpected error occurred. Please try again.")}
      </p>

      {/* Actions */}
      <div className="flex gap-4">
        <button
          onClick={() => navigate("/home")}
          className="px-8 py-3 rounded-full font-semibold text-white bg-gradient-to-r from-nexusPurple to-cyan-500 hover:from-purple-400 hover:to-nexusCyan transition-all shadow-lg shadow-purple-500/20"
        >
          Go Home
        </button>
        <button
          onClick={() => window.location.reload()}
          className="px-8 py-3 rounded-full font-semibold text-white/80 border border-white/20 hover:border-white/40 hover:text-white transition-all bg-white/5"
        >
          Try Again
        </button>
      </div>

      {/* Error detail (dev only) */}
      {import.meta.env.DEV && error instanceof Error && error.stack && (
        <pre className="mt-10 max-w-2xl w-full text-left text-xs text-red-400/70 bg-red-950/20 border border-red-500/20 rounded-lg p-4 overflow-x-auto">
          {error.stack}
        </pre>
      )}
    </div>
  );
}

export default RouteErrorBoundary;

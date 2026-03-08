// FILE: /video-platform/shared/monitoring/metrics.ts
/**
 * 统一监控指标与告警系统
 * 支持 Prometheus 指标收集和结构化日志记录
 */

import { register, Counter, Histogram, Gauge } from "prom-client";

// ===== 业务指标定义 =====

// 403 错误计数器
export const http403Counter = new Counter({
  name: "vp_http_403_errors_total",
  help: "Total number of 403 Forbidden errors",
  labelNames: ["service", "endpoint", "user_id", "reason"],
});

// 支付失败计数器
export const paymentFailureCounter = new Counter({
  name: "vp_payment_failures_total",
  help: "Total number of payment failures",
  labelNames: ["service", "payment_method", "error_type", "user_id", "video_id"],
});

// Token 生成失败计数器
export const tokenGenerationFailureCounter = new Counter({
  name: "vp_token_generation_failures_total",
  help: "Total number of token generation failures",
  labelNames: ["service", "token_type", "error_type", "user_id"],
});

// 请求响应时间直方图
export const httpRequestDuration = new Histogram({
  name: "vp_http_request_duration_seconds",
  help: "HTTP request duration in seconds",
  labelNames: ["service", "method", "endpoint", "status_code"],
  buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10],
});

// SSE 连接状态
export const sseConnectionsGauge = new Gauge({
  name: "vp_sse_connections_active",
  help: "Number of active SSE connections",
  labelNames: ["service", "endpoint"],
});

// 幂等键冲突计数器
export const idempotencyConflictCounter = new Counter({
  name: "vp_idempotency_conflicts_total",
  help: "Total number of idempotency key conflicts",
  labelNames: ["service", "endpoint", "conflict_type"],
});

// 视频播放错误计数器
export const videoPlaybackErrorCounter = new Counter({
  name: "vp_video_playback_errors_total",
  help: "Total number of video playback errors",
  labelNames: ["service", "error_type", "video_id", "user_id"],
});

// ===== 错误类型枚举 =====

export enum ErrorType {
  // 403 错误原因
  UNAUTHORIZED = "unauthorized",
  INSUFFICIENT_BALANCE = "insufficient_balance",
  PAYMENT_REQUIRED = "payment_required",
  TOKEN_EXPIRED = "token_expired",
  INVALID_SIGNATURE = "invalid_signature",

  // 支付错误类型
  PAYMENT_TIMEOUT = "payment_timeout",
  PAYMENT_DECLINED = "payment_declined",
  INSUFFICIENT_FUNDS = "insufficient_funds",
  NETWORK_ERROR = "network_error",
  VALIDATION_ERROR = "validation_error",

  // Token 生成错误
  JWT_SIGN_ERROR = "jwt_sign_error",
  STREAM_TOKEN_ERROR = "stream_token_error",
  OFFLINE_TOKEN_ERROR = "offline_token_error",
  SIGNATURE_VERIFICATION_ERROR = "signature_verification_error",

  // 播放错误
  MANIFEST_FETCH_ERROR = "manifest_fetch_error",
  SEGMENT_FETCH_ERROR = "segment_fetch_error",
  DECODE_ERROR = "decode_error",
  NETWORK_TIMEOUT = "network_timeout",
}

// ===== 告警阈值配置 =====

export interface AlertThresholds {
  http403ErrorsPerMinute: number;
  paymentFailureRatePercent: number;
  tokenGenerationFailureRatePercent: number;
  avgResponseTimeSeconds: number;
  sseConnectionDropRatePercent: number;
}

export const DEFAULT_ALERT_THRESHOLDS: AlertThresholds = {
  http403ErrorsPerMinute: 10,
  paymentFailureRatePercent: 5,
  tokenGenerationFailureRatePercent: 2,
  avgResponseTimeSeconds: 3,
  sseConnectionDropRatePercent: 10,
};

// ===== 结构化日志接口 =====

export interface LogContext {
  service: string;
  userId?: string;
  videoId?: string;
  endpoint?: string;
  method?: string;
  statusCode?: number;
  duration?: number;
  error?: string;
  stack?: string;
  metadata?: Record<string, any>;
}

export enum LogLevel {
  DEBUG = "debug",
  INFO = "info",
  WARN = "warn",
  ERROR = "error",
  CRITICAL = "critical",
}

// ===== 监控工具类 =====

export class MonitoringService {
  private serviceName: string;
  private logger: any;

  constructor(serviceName: string, logger?: any) {
    this.serviceName = serviceName;
    this.logger = logger || console;
  }

  // 记录 403 错误
  record403Error(endpoint: string, userId: string, reason: ErrorType, context?: Record<string, any>) {
    http403Counter.inc({
      service: this.serviceName,
      endpoint,
      user_id: userId,
      reason,
    });

    this.logStructured(LogLevel.WARN, "403 Forbidden Error", {
      service: this.serviceName,
      userId,
      endpoint,
      statusCode: 403,
      error: reason,
      metadata: context,
    });
  }

  // 记录支付失败
  recordPaymentFailure(paymentMethod: string, errorType: ErrorType, userId: string, videoId?: string, context?: Record<string, any>) {
    paymentFailureCounter.inc({
      service: this.serviceName,
      payment_method: paymentMethod,
      error_type: errorType,
      user_id: userId,
      video_id: videoId || "unknown",
    });

    this.logStructured(LogLevel.ERROR, "Payment Failure", {
      service: this.serviceName,
      userId,
      videoId,
      error: errorType,
      metadata: { paymentMethod, ...context },
    });
  }

  // 记录 Token 生成失败
  recordTokenGenerationFailure(tokenType: string, errorType: ErrorType, userId: string, context?: Record<string, any>) {
    tokenGenerationFailureCounter.inc({
      service: this.serviceName,
      token_type: tokenType,
      error_type: errorType,
      user_id: userId,
    });

    this.logStructured(LogLevel.ERROR, "Token Generation Failure", {
      service: this.serviceName,
      userId,
      error: errorType,
      metadata: { tokenType, ...context },
    });
  }

  // 记录请求响应时间
  recordRequestDuration(method: string, endpoint: string, statusCode: number, durationSeconds: number) {
    httpRequestDuration.observe(
      {
        service: this.serviceName,
        method,
        endpoint,
        status_code: statusCode.toString(),
      },
      durationSeconds
    );
  }

  // 记录 SSE 连接变化
  recordSSEConnection(endpoint: string, delta: number) {
    sseConnectionsGauge.inc({ service: this.serviceName, endpoint }, delta);
  }

  // 记录幂等键冲突
  recordIdempotencyConflict(endpoint: string, conflictType: string) {
    idempotencyConflictCounter.inc({
      service: this.serviceName,
      endpoint,
      conflict_type: conflictType,
    });

    this.logStructured(LogLevel.WARN, "Idempotency Key Conflict", {
      service: this.serviceName,
      endpoint,
      error: conflictType,
    });
  }

  // 记录视频播放错误
  recordVideoPlaybackError(errorType: ErrorType, videoId: string, userId?: string, context?: Record<string, any>) {
    videoPlaybackErrorCounter.inc({
      service: this.serviceName,
      error_type: errorType,
      video_id: videoId,
      user_id: userId || "anonymous",
    });

    this.logStructured(LogLevel.ERROR, "Video Playback Error", {
      service: this.serviceName,
      userId,
      videoId,
      error: errorType,
      metadata: context,
    });
  }

  // 结构化日志记录
  private logStructured(level: LogLevel, message: string, context: LogContext) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...context,
    };

    if (this.logger && typeof this.logger[level] === "function") {
      this.logger[level](logEntry);
    } else {
      console.log(JSON.stringify(logEntry));
    }
  }

  // 获取 Prometheus 指标
  async getMetrics(): Promise<string> {
    return register.metrics();
  }

  // 健康检查
  async healthCheck(): Promise<{ status: string; metrics: any }> {
    try {
      const metrics = await register.getSingleMetricAsString("vp_http_403_errors_total");
      return {
        status: "healthy",
        metrics: {
          service: this.serviceName,
          timestamp: new Date().toISOString(),
          prometheus_available: !!metrics,
        },
      };
    } catch (error) {
      return {
        status: "unhealthy",
        metrics: {
          service: this.serviceName,
          timestamp: new Date().toISOString(),
          error: String(error),
        },
      };
    }
  }
}

// ===== 导出默认实例 =====

export const createMonitoringService = (serviceName: string, logger?: any) => {
  return new MonitoringService(serviceName, logger);
};

// 注册默认指标收集器
register.registerMetric(http403Counter);
register.registerMetric(paymentFailureCounter);
register.registerMetric(tokenGenerationFailureCounter);
register.registerMetric(httpRequestDuration);
register.registerMetric(sseConnectionsGauge);
register.registerMetric(idempotencyConflictCounter);
register.registerMetric(videoPlaybackErrorCounter);
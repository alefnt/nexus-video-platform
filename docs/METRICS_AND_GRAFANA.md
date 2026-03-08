# Metrics 与 Grafana 可观测

## 服务 /metrics 端点

以下服务暴露 Prometheus 文本格式的 `/metrics`，便于 Grafana 采集：

| 服务 | 端口 | /metrics |
|------|------|----------|
| identity (网关) | 8080 | ✅ |
| payment | 8091 | ✅ |
| content | 8092 | ✅ |
| metadata | 8093 | ✅ |
| search | 8101 | ✅ |
| transcode | 8100 | ✅ |
| messaging | 8103 | ✅ |
| moderation | 8102 | ✅ |

## Prometheus 采集配置示例

```yaml
scrape_configs:
  - job_name: 'nexus-identity'
    static_configs:
      - targets: ['localhost:8080']
    metrics_path: /metrics
  - job_name: 'nexus-payment'
    static_configs:
      - targets: ['localhost:8091']
    metrics_path: /metrics
  - job_name: 'nexus-metadata'
    static_configs:
      - targets: ['localhost:8093']
    metrics_path: /metrics
  - job_name: 'nexus-content'
    static_configs:
      - targets: ['localhost:8092']
    metrics_path: /metrics
```

## Grafana

- 数据源：添加 Prometheus，URL 指向上述 Prometheus 服务。
- 大盘：可基于 `nexus_*`、`vp_*` 等指标制作请求量、延迟、错误率、业务指标（支付、播放等）大盘。

## 说明

- identity 网关的 `/metrics` 为自身指标；下游服务需单独 scrape 各端口。
- 若网关需聚合下游 metrics，可另行配置 Prometheus 聚合或网关侧代理 `/metrics`。

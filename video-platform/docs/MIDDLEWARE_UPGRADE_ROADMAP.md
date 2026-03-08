# NEXUS 中间件升级路线图

> 本文档记录当前中间件架构的演进路径。  
> 当前阶段：**S1 (BullMQ)**  
> 最后更新：2026-03-06

---

## 当前架构 (S1) — BullMQ + Redis

**适用规模：** <10K DAU  
**状态：** 实施中

| 组件 | 技术 | 作用 |
|---|---|---|
| 结算工作流 | BullMQ Worker | Stream Pay 退款、Fiber 结算、打赏分成 |
| 数据一致性 | BullMQ Cron + Prisma | 定时审计链上-链下 hash、清理孤立文件 |
| 存储调度 | BullMQ Cron → DataLifecycle | 自动 hot→warm→cold 数据降温 |
| 实时通信 | LiveKit WebRTC | 直播、PK、数据通道 |
| P2P 分发 | WebTorrent | 视频 P2P 加速 |
| 高可用 | Redis Sentinel | Redis 主从自动故障转移 |

### 已知局限
- BullMQ 无原生 Saga 编排，补偿逻辑需手写
- DB+链上操作非原子（重试缓解但不根治）
- 一致性审计是事后检测，非实时预防
- CKB Indexer 内存存储，重启依赖 Redis 缓存恢复

---

## S2 升级 — Temporal.io 工作流引擎

**触发条件：** DAU > 5K 或结算失败率 > 0.1%  
**预估工期：** 1-2 天

### 升级内容
1. **部署 Temporal Server**（Docker: temporal + temporal-ui + postgres）
2. **迁移 Settlement Worker → Temporal Workflow**
   - 原生 Saga 模式：每步自动生成补偿操作
   - 确定性执行日志：可回放、可审计
   - 自动故障恢复：进程崩溃后从断点继续
3. **迁移 DataLifecycle Cron → Temporal Schedule**
4. **保留 BullMQ** 用于通知、邮件等简单任务

### 架构变化
```
当前:  API → BullMQ Job → Worker → Prisma + Fiber
升级:  API → Temporal Workflow → Activity(Prisma) + Activity(Fiber) + Activity(Spore)
                               → 任何 Activity 失败 → 自动执行补偿 Activity
```

### 升级时 API 不变
Settlement Worker 的接口设计为 `addJob(queue, jobName, data)` 模式，升级时只需将 Worker 实现替换为 Temporal Activity，上层 REST API 无需修改。

---

## S3 升级 — Event Sourcing + CQRS

**触发条件：** DAU > 50K 或需要完整审计链  
**预估工期：** 1-2 周

### 升级内容
1. **引入 Event Store**（NATS JetStream 或 Apache Kafka）
2. **所有状态变更 → 事件**
   - `ContentUploaded`, `StorageTierChanged`, `PaymentSettled`, `SporeNFTMinted`
   - 事件不可变，永久保留
3. **CQRS 读写分离**
   - 写模型：事件发布到 Event Store
   - 读模型：从事件投影到 Prisma（可重建）
4. **完整审计链**：任意时间点的系统状态可精确回溯

### 收益
- 100% 审计能力：每笔交易有完整事件链
- 数据重建：删库也能从事件重放恢复
- 多视图：同一事件可投影为多个读模型（分析、合规、实时Dashboard）

---

## S4 升级 — 去中心化验证层

**触发条件：** DAU > 100K 或有合规/审计需求  
**预估工期：** 1个月+

### 升级内容
1. **Optimistic Rollup 模式**
   - 中间件提交数据摘要到 CKB（默认可信）
   - 24h 挑战窗口：Watcher 节点可发起"欺诈证明"
2. **CKB Script 验证合约**
   - RISC-V 编写的链上验证逻辑
   - 验证结算金额、版税分配、存储证明
3. **ZKP 隐私证明**（如有 KYC 需求）
   - 证明用户已验证身份但不泄露个人信息

---

## 基础设施演进对照表

| 阶段 | 结算 | 调度 | 一致性 | 通信 | 存储 |
|---|---|---|---|---|---|
| S1 当前 | BullMQ | BullMQ Cron | Prisma 审计 | LiveKit | MinIO/Filecoin/Arweave |
| S2 | Temporal | Temporal Schedule | Temporal 日志 | LiveKit | +Cloudflare R2 |
| S3 | Event Sourcing | 事件驱动 | 事件溯源 | LiveKit + WebTransport | +IPFS Cluster |
| S4 | 链上验证 | 链上+链下 | Optimistic Rollup | P2P Mesh | 全去中心化 |

---

## 环境变量参考

```env
# S1: Redis Sentinel (当前)
REDIS_SENTINEL_HOSTS=sentinel1:26379,sentinel2:26379,sentinel3:26379
REDIS_SENTINEL_MASTER_NAME=mymaster

# S2: Temporal (未来)
TEMPORAL_ADDRESS=temporal:7233
TEMPORAL_NAMESPACE=nexus
TEMPORAL_TASK_QUEUE=settlement

# S3: Event Store (未来)
NATS_URL=nats://nats:4222
EVENT_STORE_STREAM=nexus-events
```

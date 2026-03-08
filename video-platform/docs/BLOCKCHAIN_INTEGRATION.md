# Blockchain Integration — JoyID, CKB, Fiber, CCC, FIL/AR

本文档说明 Nexus Video 平台与 JoyID、CKB、Fiber Network、CCC 及 FIL/AR 的集成方式，并给出官方文档与正确用法。

---

## 1. JoyID

### 官方资源

- **文档**: https://docs.joyid.dev/
- **CKB 连接**: https://docs.joyid.dev/guide/ckb/connect
- **CKB 签名交易**: https://docs.joyid.dev/guide/ckb/sign-transaction
- **API 参考**: https://docs.joyid.dev/apis
- **npm**: `@joyid/ckb` (当前 1.1.3)

### 正确用法

1. **初始化（应用入口执行一次）**
   ```ts
   import { initConfig } from "@joyid/ckb";
   initConfig({
     name: "Nexus Video",
     logo: "https://fav.farm/🎬",
     joyidAppURL: import.meta.env.VITE_JOYID_APP_URL || "https://testnet.joyid.dev",
   });
   ```

2. **连接与登录**
   - `connect()` 返回 `{ address, ethAddress, keyType, alg, nostrPubkey, pubkey }`，其中 `address` 为 CKB 地址。
   - 登录流程：先调后端 `GET /auth/joyid/nonce` 获取 `challenge`，再 `signChallenge(challenge, address)` 得到 `signatureData`，最后 `POST /auth/joyid` 提交 `{ signatureData, deviceFingerprint, address?, bitDomain? }`。

3. **CKB 转账签名（不广播）**
   ```ts
   import { signTransaction } from "@joyid/ckb";
   const signedTx = await signTransaction({
     to: depositAddress,
     from: joyidInfo.address,  // 或 session 中的 ckbAddress
     amount: amountShannons,   // 字符串，单位 Shannons (1 CKB = 10^8)
   });
   // 再将 signedTx 通过后端或 CKB RPC send_transaction 广播
   ```

4. **后端验签**
   - 使用 `verifySignature(signatureData)`（`@joyid/ckb`）校验 WebAuthn 签名；校验通过后根据 `address` 或 `bitDomain` 解析出 CKB 地址并签发 JWT。

### 环境变量

- **前端**: `VITE_JOYID_APP_URL`（可选，默认 testnet.joyid.dev）

---

## 2. CKB (Nervos)

### 官方资源

- **文档**: https://docs.nervos.org/
- **CKB 节点 RPC**: https://docs.nervos.org/docs/reference/ckb-node-rpc
- **测试网水龙头**: https://faucet.nervos.org/

### 集成要点

- **节点 RPC**: 支付服务使用 `CKB_NODE_URL`、`CKB_INDEXER_URL` 构建交易与查询。
- **充值地址**: `CKB_DEPOSIT_ADDRESS` 为平台收款地址，用户向该地址转入 CKB 后由后端检测并兑换积分。
- **JoyID Lock**: 支付服务在检测到 JoyID 锁（code hash 前缀 `0xd2376` / `0xd00c84`）时会加入对应 cell_deps，参见 `services/payment/src/server.ts`。

### 环境变量

- `CKB_NODE_URL`（如 https://testnet.ckb.dev/rpc）
- `CKB_INDEXER_URL`（如 https://testnet.ckb.dev/indexer）
- `CKB_DEPOSIT_ADDRESS`（平台 CKB 收款地址）

---

## 3. Fiber Network

### 官方资源

- **仓库**: https://github.com/nervosnetwork/fiber
- **说明**: Fiber 是基于 CKB 的类 Lightning 支付/互换网络（PTLC、多资产、跨网等）。
- **文档**: 仓库内 [docs/](https://github.com/nervosnetwork/fiber/tree/develop/docs)、[RPC README](https://github.com/nervosnetwork/fiber/blob/develop/crates/fiber-lib/src/rpc/README.md)、[Invoice Protocol](https://github.com/nervosnetwork/fiber/blob/develop/docs/specs/payment-invoice.md)。

### 当前实现

- **shared/web3/fiber.ts**: `FiberRPCClient` 通过 JSON-RPC 调用 Fiber 节点；当前使用的方法名为 `new_invoice`、`get_invoice`（与常见 Lightning 风格命名一致，具体以 Fiber 官方 RPC 文档为准）。
- **支付服务**: 流支付发票创建优先走真实 Fiber RPC（`createStreamInvoice`），失败且 `FIBER_ALLOW_MOCK=1` 时回退到 Mock，便于本地开发。
- **前端**: `client-web/src/lib/fiberPayment.ts` 中流支付实际通过后端 `POST /payment/stream/pay` 用积分结算；Fiber 通道内直接支付需后续对接 Fiber 客户端/钱包。

### 环境变量

- `FIBER_RPC_URL`: Fiber 节点 RPC 地址（测试网示例见 Fiber 仓库 testnet 文档）。
- `FIBER_ALLOW_MOCK`: 设为 `1` 时在 RPC 不可用时允许 Mock 发票（仅开发）。

---

## 4. CCC (Common Chains Connector)

### 官方资源

- **文档**: https://docs.nervos.org/docs/integrate-wallets/ccc-wallet
- **JS/TS**: https://docs.nervos.org/docs/sdk-and-devtool/ccc
- **React**: `@ckb-ccc/connector-react`（`ccc.useCcc()`、`ccc.useSigner()`、`ccc.Provider`）
- **Demo**: https://app.ckbccc.com/ 与 https://github.com/ckb-devrel/ccc

### 正确用法

1. **根组件包裹 Provider**
   - 使用 `ccc.Provider` 并配置网络（如 testnet/mainnet）。本项目在 `client-web/src/main.tsx` 中已使用 `preferredNetworks` 指定 CKB testnet。

2. **连接钱包**
   - `const { open, wallet } = ccc.useCcc();` 点击 `open()` 打开 CCC 钱包选择器（含 JoyID 等）。

3. **获取地址与余额**
   - `const signer = ccc.useSigner();` 连接后可用 `signer.getRecommendedAddress()`、`signer.getBalance()` 等。

4. **与登录结合**
   - 若用户通过 CCC 连接 JoyID，前端可将得到的 CKB 地址与后端登录接口结合：后端已支持 `authType: "ccc"`，此时仅校验 nonce 与地址，不要求 JoyID 原始签名（因 CCC/JoyID 已在端侧完成验证）。

### 业务逻辑

- **积分中心 CKB 购买**: 当前使用 `@joyid/ckb` 的 `signTransaction({ to, from, amount })` 完成“创建订单 → 签名 → 后端广播 → 确认入账”。若用户通过 CCC 连接，`from` 可取自 CCC signer 的推荐地址，签名仍可由 JoyID 会话或 CCC 提供的签名流程完成（视 CCC API 而定）。

---

## 5. Filecoin (FIL) 与 Arweave (AR)

### 官方资源

- **Filecoin**: https://docs.filecoin.io/ 、 https://github.com/filecoin-project
- **Arweave**: https://docs.arweave.org/ 、 https://github.com/ArweaveTeam/arweave

### 当前状态

- **元数据**: `shared/types` 中 `VideoMeta` 已包含 `filecoinCid`、`arweaveTxId` 可选字段，用于存储证明与溯源。
- **上传**: `shared/validation/schemas.ts` 中 `UploadRequestSchema` 含 `enableArweave` 可选；实际持久化到 FIL/AR 需在 content 或独立服务中按各自 API 实现。
- **依赖**: 若使用 Arweave 官方 JS 库，可引入 `arweave`；FIL 存储可对接 Lotus、Web3.Storage 等，按官方文档集成。

### 建议

- 先完成 CKB/JoyID/Fiber/CCC 的支付与登录闭环，再将 FIL/AR 作为可选存储与展示字段逐步对接。

---

## 6. 环境变量汇总

| 变量 | 作用域 | 说明 |
|------|--------|------|
| `VITE_JOYID_APP_URL` | client-web | JoyID 应用 URL，默认 testnet.joyid.dev |
| `CKB_NODE_URL` | payment/identity | CKB 节点 RPC |
| `CKB_INDEXER_URL` | payment | CKB Indexer |
| `CKB_DEPOSIT_ADDRESS` | payment | 平台 CKB 收款地址 |
| `FIBER_RPC_URL` | payment/shared | Fiber 节点 RPC |
| `FIBER_ALLOW_MOCK` | payment | 是否允许 Fiber Mock（开发用） |
| `JWT_SECRET` | identity/payment | JWT 密钥（≥32 字节） |
| `ENABLE_POINTS_JOYID` | payment | 是否启用积分 JoyID 相关逻辑 |

---

## 7. 实现检查清单

- [x] 登录：JoyID connect → nonce → signChallenge → POST /auth/joyid，后端 verifySignature 或 CCC authType
- [x] CKB 购买积分：创建订单 → signTransaction(to, from, amount) → 后端广播 → 确认入账
- [x] Fiber：createStreamInvoice / getInvoiceStatus 使用 FIBER_RPC_URL，支持 FIBER_ALLOW_MOCK
- [x] CCC：Provider 包裹应用；可选 CCC 登录与地址用于 CKB 支付
- [ ] FIL/AR：元数据字段已预留；实际上传与验证待按官方 API 实现

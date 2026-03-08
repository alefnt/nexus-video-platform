# 环境变量字典（本地 / 测试 / 生产）

说明：以下变量用于统一配置网关与各微服务，以及 Web/移动端的调用地址。

## 网关（Identity）
- `JWT_SECRET`：HS256 密钥（>=32 字节）。
- `API_PORT`：网关端口，默认 `8080`。
- `PAYMENT_URL`：支付服务地址，默认 `http://localhost:8091`。
- `CONTENT_URL`：内容服务地址，默认 `http://localhost:8092`。
- `METADATA_URL`：元数据服务地址，默认 `http://localhost:8093`。
- `ROYALTY_URL`：分账服务地址，默认 `http://localhost:8094`。

## 支付服务（Payment）
- `JWT_SECRET`：与网关一致。
- `PAYMENT_PORT`：默认 `8091`。
- `FIBER_RPC_URL`：Fiber 测试网 RPC 地址（配置后启用 RealFiberHTLC）。
- `FIBER_PAYEE_PUBKEY`：默认收款人公钥（创建发票时附带，未配置则省略）。
- `FIBER_ALLOW_MOCK`：是否允许模拟支付回退（默认 `false`；生产禁用）。
- `METADATA_URL`：元数据服务地址（用于赎回后读取元数据）。
- `ROYALTY_URL`：分账服务地址（赎回后触发分账）。

## 内容服务（Content）
- `JWT_SECRET`：与网关一致。
- `CONTENT_PORT`：默认 `8092`。
- `PUBLIC_CONTENT_BASEURL`：对外可访问的内容服务地址（供 Cloudflare 拉取），默认本机。
- `CF_ACCOUNT_ID` / `CLOUDFLARE_ACCOUNT_ID`：Cloudflare 账户 ID。
- `CF_STREAM_API_TOKEN` / `CLOUDFLARE_STREAM_TOKEN`：Cloudflare Stream API Token。
- `WEB3_STORAGE_TOKEN`：Web3.Storage API Token。

## 元数据服务（Metadata）
- `JWT_SECRET`：与网关一致。
- `METADATA_PORT`：默认 `8093`。
- `REDIS_URL`：可选 Redis 连接（不配置则使用内存）。
- `CKB_NODE_URL`：CKB 测试网节点地址（连通性检查与未来链上写扩展）。
- `CKB_INDEXER_URL`：CKB 测试网 Indexer 地址（用于收集 cells）。

## Web 前端（Vite）
- `VITE_API_GATEWAY_URL`：网关的对外地址（如 `http://<HostIP>:8080`）。
- `VITE_JOYID_APP_URL`：JoyID 应用入口（可选）。

## 移动端（Expo RN）
- `EXPO_PUBLIC_API_GATEWAY_URL`：网关的对外地址（如 `http://<HostIP>:8080`）。
- `EXPO_PUBLIC_WEB_ORIGIN`：Web 前端地址（如 `http://<HostIP>:5173`）。

建议：
- 本地开发使用 `localhost`；在真机联调时，统一改为 `http://<HostIP>:<Port>` 并将端口通过防火墙与局域网可达。
- 生产环境使用公网入口，确保 HTTPS 与 CORS 配置正确。

## 示例（Testnet）
- `CKB_NODE_URL`：`https://testnet.ckb.dev`
- `CKB_INDEXER_URL`：`https://testnet.ckb.dev/indexer`
#!/bin/bash
set -e

DATA_DIR="/app/data"
KEY_FILE="$DATA_DIR/ckb/key"

# Generate private key on first run if not exists
if [ ! -f "$KEY_FILE" ]; then
  echo "[Fiber Entrypoint] First run — generating CKB private key..."
  mkdir -p "$DATA_DIR/ckb"
  # Generate a 32-byte hex private key (same format as ckb-cli export)
  openssl rand -hex 32 > "$KEY_FILE"
  echo "[Fiber Entrypoint] Private key generated at $KEY_FILE"
  echo "[Fiber Entrypoint] IMPORTANT: Back up this key! It controls the node's funding wallet."
else
  echo "[Fiber Entrypoint] Using existing key at $KEY_FILE"
fi

echo "[Fiber Entrypoint] Starting FNN v0.7.1 (CKB Testnet)..."
exec ./fnn -c config.yml -d "$DATA_DIR"

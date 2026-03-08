#!/usr/bin/env bash
# 数据库恢复脚本
# FILE: /video-platform/scripts/restore.sh
#
# 使用方法:
#   bash scripts/restore.sh path/to/backup.sql
#   bash scripts/restore.sh --latest            # 恢复最新备份
#
# ⚠️ 警告: 此操作将覆盖当前数据库内容！

set -euo pipefail

# ============== 配置 ==============
BACKUP_DIR="${BACKUP_DIR:-./deploy/docker/backups}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-nexus}"
DB_NAME="${DB_NAME:-nexus_video}"
DB_PASSWORD="${DB_PASSWORD:-}"

DOCKER_CONTAINER="${DOCKER_CONTAINER:-nexus-postgres}"
USE_DOCKER="${USE_DOCKER:-true}"

# ============== 函数 ==============
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

error() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $*" >&2
    exit 1
}

# ============== 参数处理 ==============
BACKUP_FILE=""

if [ "${1:-}" = "--latest" ]; then
    BACKUP_FILE=$(ls -t "$BACKUP_DIR/daily"/nexus_*.sql* 2>/dev/null | head -1)
    if [ -z "$BACKUP_FILE" ]; then
        error "未找到备份文件"
    fi
    log "使用最新备份: $BACKUP_FILE"
elif [ -n "${1:-}" ]; then
    BACKUP_FILE="$1"
else
    echo "使用方法:"
    echo "  bash scripts/restore.sh path/to/backup.sql"
    echo "  bash scripts/restore.sh --latest"
    exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
    error "文件不存在: $BACKUP_FILE"
fi

# ============== 确认 ==============
BACKUP_SIZE=$(du -sh "$BACKUP_FILE" | cut -f1)
log "⚠️  即将恢复数据库"
log "   备份文件: $BACKUP_FILE"
log "   文件大小: $BACKUP_SIZE"
log "   目标数据库: $DB_NAME"
echo ""
read -p "确认恢复？这将覆盖当前数据库内容！(yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    log "已取消"
    exit 0
fi

# ============== 恢复 ==============
log "开始恢复..."

if [ "$USE_DOCKER" = "true" ]; then
    log "使用 Docker 恢复 (容器: $DOCKER_CONTAINER)"
    docker exec -i "$DOCKER_CONTAINER" \
        pg_restore -U "$DB_USER" -d "$DB_NAME" --clean --if-exists --no-owner \
        < "$BACKUP_FILE"
else
    log "使用本地 pg_restore"
    PGPASSWORD="$DB_PASSWORD" pg_restore \
        -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
        --clean --if-exists --no-owner \
        "$BACKUP_FILE"
fi

# ============== 验证 ==============
log "验证恢复结果..."

if [ "$USE_DOCKER" = "true" ]; then
    TABLE_COUNT=$(docker exec "$DOCKER_CONTAINER" \
        psql -U "$DB_USER" -d "$DB_NAME" -t -c \
        "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'")
else
    TABLE_COUNT=$(PGPASSWORD="$DB_PASSWORD" psql \
        -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c \
        "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'")
fi

log "✅ 恢复完成! 数据库共有 $(echo $TABLE_COUNT | tr -d ' ') 张表"
log "📝 建议运行 Prisma migrate 确认 schema 一致:"
log "   npx prisma migrate deploy --schema=packages/database/prisma/schema.prisma"

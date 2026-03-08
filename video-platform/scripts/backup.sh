#!/usr/bin/env bash
# 数据库备份脚本
# FILE: /video-platform/scripts/backup.sh
#
# 使用方法:
#   bash scripts/backup.sh                    # 本地备份
#   bash scripts/backup.sh --upload-minio     # 备份并上传到 MinIO
#
# 依赖: pg_dump, docker (如果连接容器)
# 定时任务示例:
#   0 2 * * * cd /path/to/video-platform && bash scripts/backup.sh >> /var/log/backup.log 2>&1

set -euo pipefail

# ============== 配置 ==============
BACKUP_DIR="${BACKUP_DIR:-./deploy/docker/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
RETENTION_WEEKLY="${RETENTION_WEEKLY:-4}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DAY_OF_WEEK=$(date +%u)  # 1=Monday, 7=Sunday

# 数据库配置
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-nexus}"
DB_NAME="${DB_NAME:-nexus_video}"
DB_PASSWORD="${DB_PASSWORD:-}"

# Docker 模式（如果 postgres 运行在 Docker 中）
DOCKER_CONTAINER="${DOCKER_CONTAINER:-nexus-postgres}"
USE_DOCKER="${USE_DOCKER:-true}"

# MinIO 上传
MINIO_BUCKET="${MINIO_BUCKET:-backups}"
MINIO_ALIAS="${MINIO_ALIAS:-nexus}"

# ============== 函数 ==============
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

error() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $*" >&2
}

# ============== 确保目录存在 ==============
mkdir -p "$BACKUP_DIR/daily"
mkdir -p "$BACKUP_DIR/weekly"

# ============== 执行备份 ==============
BACKUP_FILE="$BACKUP_DIR/daily/nexus_${TIMESTAMP}.sql.gz"

log "开始数据库备份..."

if [ "$USE_DOCKER" = "true" ]; then
    log "使用 Docker 执行 pg_dump (容器: $DOCKER_CONTAINER)"
    docker exec "$DOCKER_CONTAINER" \
        pg_dump -U "$DB_USER" -d "$DB_NAME" --format=custom --compress=6 \
        > "${BACKUP_FILE%.gz}"
else
    log "使用本地 pg_dump"
    PGPASSWORD="$DB_PASSWORD" pg_dump \
        -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
        --format=custom --compress=6 \
        > "${BACKUP_FILE%.gz}"
fi

# 压缩
if [ -f "${BACKUP_FILE%.gz}" ]; then
    BACKUP_FILE="${BACKUP_FILE%.gz}"
    BACKUP_SIZE=$(du -sh "$BACKUP_FILE" | cut -f1)
    log "✅ 备份完成: $BACKUP_FILE ($BACKUP_SIZE)"
else
    error "备份失败!"
    exit 1
fi

# ============== 周备份（周日） ==============
if [ "$DAY_OF_WEEK" = "7" ]; then
    WEEKLY_FILE="$BACKUP_DIR/weekly/nexus_weekly_${TIMESTAMP}.sql"
    cp "$BACKUP_FILE" "$WEEKLY_FILE"
    log "📦 创建周备份: $WEEKLY_FILE"
fi

# ============== 清理旧备份 ==============
log "清理 ${RETENTION_DAYS} 天前的日备份..."
find "$BACKUP_DIR/daily" -name "nexus_*.sql*" -mtime +"$RETENTION_DAYS" -delete 2>/dev/null || true

WEEKLY_COUNT=$(find "$BACKUP_DIR/weekly" -name "nexus_weekly_*.sql*" | wc -l)
if [ "$WEEKLY_COUNT" -gt "$RETENTION_WEEKLY" ]; then
    log "清理多余的周备份 (保留最新 $RETENTION_WEEKLY 个)..."
    ls -t "$BACKUP_DIR/weekly"/nexus_weekly_*.sql* | tail -n +$(( RETENTION_WEEKLY + 1 )) | xargs rm -f
fi

# ============== 可选: 上传到 MinIO ==============
if [ "${1:-}" = "--upload-minio" ]; then
    if command -v mc &>/dev/null; then
        log "上传到 MinIO: ${MINIO_ALIAS}/${MINIO_BUCKET}/..."
        mc cp "$BACKUP_FILE" "${MINIO_ALIAS}/${MINIO_BUCKET}/daily/"
        if [ -f "${WEEKLY_FILE:-}" ]; then
            mc cp "$WEEKLY_FILE" "${MINIO_ALIAS}/${MINIO_BUCKET}/weekly/"
        fi
        log "✅ MinIO 上传完成"
    else
        error "mc (MinIO Client) 未安装，跳过上传"
    fi
fi

log "🎉 备份流程完成"

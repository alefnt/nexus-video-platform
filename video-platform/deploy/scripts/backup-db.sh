#!/bin/bash
# 数据库备份脚本
# FILE: /video-platform/deploy/scripts/backup-db.sh
#
# 使用方法:
#   ./backup-db.sh
#   ./backup-db.sh --upload-s3
#
# 环境变量:
#   DATABASE_URL - PostgreSQL 连接字符串
#   S3_BUCKET - S3 备份桶名称
#   AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY

set -e

# 配置
BACKUP_DIR="/var/backups/postgres"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="nexus_video_${TIMESTAMP}.sql.gz"
RETENTION_DAYS=30

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

echo -e "${GREEN}[Backup]${NC} Starting database backup..."

# 创建备份目录
mkdir -p "$BACKUP_DIR"

# 从 DATABASE_URL 解析连接信息
if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}[Error]${NC} DATABASE_URL not set"
    exit 1
fi

# 执行备份
echo -e "${GREEN}[Backup]${NC} Dumping database..."
pg_dump "$DATABASE_URL" --no-owner --no-acl | gzip > "$BACKUP_DIR/$BACKUP_FILE"

# 检查备份大小
BACKUP_SIZE=$(ls -lh "$BACKUP_DIR/$BACKUP_FILE" | awk '{print $5}')
echo -e "${GREEN}[Backup]${NC} Backup created: $BACKUP_FILE ($BACKUP_SIZE)"

# 上传到 S3 (可选)
if [ "$1" == "--upload-s3" ] && [ -n "$S3_BUCKET" ]; then
    echo -e "${GREEN}[Backup]${NC} Uploading to S3..."
    aws s3 cp "$BACKUP_DIR/$BACKUP_FILE" "s3://$S3_BUCKET/backups/postgres/$BACKUP_FILE"
    echo -e "${GREEN}[Backup]${NC} Uploaded to s3://$S3_BUCKET/backups/postgres/$BACKUP_FILE"
fi

# 清理旧备份
echo -e "${GREEN}[Backup]${NC} Cleaning up backups older than $RETENTION_DAYS days..."
find "$BACKUP_DIR" -name "nexus_video_*.sql.gz" -mtime +$RETENTION_DAYS -delete

# 列出现有备份
echo -e "${GREEN}[Backup]${NC} Current backups:"
ls -lh "$BACKUP_DIR"/*.sql.gz 2>/dev/null || echo "No backups found"

echo -e "${GREEN}[Backup]${NC} Backup completed successfully!"

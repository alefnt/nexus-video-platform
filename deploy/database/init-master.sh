#!/bin/bash
# FILE: /video-platform/deploy/database/init-master.sh
# PostgreSQL 主节点初始化脚本

set -e

# 创建复制用户
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    -- 创建复制用户
    CREATE USER replication WITH REPLICATION ENCRYPTED PASSWORD '${POSTGRES_PASSWORD:-password}';
    
    -- 创建只读用户 (用于从节点查询)
    CREATE USER readonly WITH PASSWORD '${POSTGRES_PASSWORD:-password}';
    GRANT CONNECT ON DATABASE nexus_video TO readonly;
    GRANT USAGE ON SCHEMA public TO readonly;
    GRANT SELECT ON ALL TABLES IN SCHEMA public TO readonly;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO readonly;
    
    -- 创建复制槽
    SELECT pg_create_physical_replication_slot('replica_slot_1');
    SELECT pg_create_physical_replication_slot('replica_slot_2');
EOSQL

echo "PostgreSQL master initialized with replication user"

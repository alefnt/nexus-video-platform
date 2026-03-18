/*!
 * Nexus Search Service (Rust/Axum + Tantivy)
 *
 * 全文搜索引擎 — 替代 Node.js + Meilisearch 实现
 * 使用 Tantivy (Rust 原生搜索引擎) 实现高性能全文索引
 *
 * Port: 8101
 *
 * Endpoints:
 * - GET  /health     — 健康检查
 * - GET  /search     — 全文搜索
 * - GET  /trending   — 热门排行
 * - POST /sync/videos — 同步视频索引
 */

use axum::{
    extract::{Query, State},
    http::{HeaderMap, StatusCode},
    response::Json,
    routing::{get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use sqlx::postgres::PgPoolOptions;
use std::sync::Arc;
use tantivy::{
    collector::TopDocs,
    directory::MmapDirectory,
    doc,
    query::QueryParser,
    schema::{Field, Schema, STORED, TEXT, FAST},
    Index, IndexReader, IndexWriter, ReloadPolicy,
};
use tokio::sync::RwLock;
use tower_http::cors::CorsLayer;

// ============== Config ==============
struct AppConfig {
    port: u16,
    jwt_secret: String,
    database_url: String,
}

impl AppConfig {
    fn from_env() -> Self {
        Self {
            port: std::env::var("SEARCH_PORT")
                .or_else(|_| std::env::var("PORT"))
                .unwrap_or_else(|_| "8101".into())
                .parse()
                .unwrap_or(8101),
            jwt_secret: std::env::var("JWT_SECRET").unwrap_or_default(),
            database_url: std::env::var("DATABASE_URL").unwrap_or_default(),
        }
    }
}

// ============== Tantivy Index Schema ==============
struct SearchIndex {
    index: Index,
    reader: IndexReader,
    writer: Arc<RwLock<IndexWriter>>,
    // Schema fields
    f_id: Field,
    f_title: Field,
    f_description: Field,
    f_category: Field,
    f_creator_name: Field,
    f_creator_id: Field,
    f_views: Field,
    f_created_at: Field,
}

impl SearchIndex {
    fn new() -> tantivy::Result<Self> {
        let mut schema_builder = Schema::builder();
        let f_id = schema_builder.add_text_field("id", TEXT | STORED);
        let f_title = schema_builder.add_text_field("title", TEXT | STORED);
        let f_description = schema_builder.add_text_field("description", TEXT | STORED);
        let f_category = schema_builder.add_text_field("category", TEXT | STORED);
        let f_creator_name = schema_builder.add_text_field("creator_name", TEXT | STORED);
        let f_creator_id = schema_builder.add_text_field("creator_id", STORED);
        let f_views = schema_builder.add_i64_field("views", FAST | STORED);
        let f_created_at = schema_builder.add_i64_field("created_at", FAST | STORED);
        let schema = schema_builder.build();

        // Use RAM directory for simplicity (can switch to MmapDirectory for persistence)
        let index = Index::create_in_ram(schema);
        let reader = index
            .reader_builder()
            .reload_policy(ReloadPolicy::OnCommitWithDelay)
            .try_into()?;
        let writer = index.writer(50_000_000)?; // 50MB buffer

        Ok(Self {
            index,
            reader,
            writer: Arc::new(RwLock::new(writer)),
            f_id,
            f_title,
            f_description,
            f_category,
            f_creator_name,
            f_creator_id,
            f_views,
            f_created_at,
        })
    }
}

// ============== App State ==============
struct AppState {
    config: AppConfig,
    search: SearchIndex,
    db: Option<sqlx::PgPool>,
}

// ============== Request/Response Types ==============
#[derive(Deserialize)]
struct SearchQuery {
    q: Option<String>,
    #[serde(rename = "type")]
    search_type: Option<String>,
    page: Option<u32>,
    limit: Option<u32>,
}

#[derive(Serialize)]
struct SearchResult {
    query: String,
    #[serde(rename = "type")]
    result_type: String,
    page: u32,
    limit: u32,
    total: usize,
    results: Vec<serde_json::Value>,
    processing_time_ms: u128,
}

#[derive(Serialize)]
struct HealthResponse {
    status: String,
    service: String,
    engine: String,
    language: String,
}

#[derive(Serialize)]
struct SyncResponse {
    ok: bool,
    indexed: usize,
}

#[derive(Deserialize)]
struct TrendingQuery {
    #[serde(rename = "type")]
    content_type: Option<String>,
    limit: Option<u32>,
}

// ============== Handlers ==============

async fn health() -> Json<HealthResponse> {
    Json(HealthResponse {
        status: "ok".into(),
        service: "search".into(),
        engine: "tantivy".into(),
        language: "rust".into(),
    })
}

async fn search(
    State(state): State<Arc<AppState>>,
    Query(params): Query<SearchQuery>,
) -> Result<Json<SearchResult>, StatusCode> {
    let start = std::time::Instant::now();
    let q = params.q.unwrap_or_default().trim().to_string();
    let search_type = params.search_type.unwrap_or_else(|| "video".into());
    let page = params.page.unwrap_or(1).max(1);
    let limit = params.limit.unwrap_or(20).min(50).max(1);

    if q.is_empty() {
        return Err(StatusCode::BAD_REQUEST);
    }

    let searcher = state.search.reader.searcher();
    let query_parser = QueryParser::for_index(
        &state.search.index,
        vec![
            state.search.f_title,
            state.search.f_description,
            state.search.f_category,
            state.search.f_creator_name,
        ],
    );

    let query = query_parser.parse_query(&q).map_err(|_| StatusCode::BAD_REQUEST)?;
    let offset = ((page - 1) * limit) as usize;
    let top_docs = searcher
        .search(&query, &TopDocs::with_limit(limit as usize + offset))
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let total = top_docs.len();
    let results: Vec<serde_json::Value> = top_docs
        .into_iter()
        .skip(offset)
        .take(limit as usize)
        .filter_map(|(_, doc_address)| {
            let doc: tantivy::TantivyDocument = searcher.doc(doc_address).ok()?;
            let id = doc.get_first(state.search.f_id)?.as_str()?.to_string();
            let title = doc.get_first(state.search.f_title)?.as_str()?.to_string();
            let description = doc
                .get_first(state.search.f_description)
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            let category = doc
                .get_first(state.search.f_category)
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            let creator_name = doc
                .get_first(state.search.f_creator_name)
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            let views = doc
                .get_first(state.search.f_views)
                .and_then(|v| v.as_i64())
                .unwrap_or(0);

            Some(serde_json::json!({
                "id": id,
                "title": title,
                "description": description,
                "category": category,
                "creatorName": creator_name,
                "views": views,
            }))
        })
        .collect();

    Ok(Json(SearchResult {
        query: q,
        result_type: search_type,
        page,
        limit,
        total,
        results,
        processing_time_ms: start.elapsed().as_millis(),
    }))
}

async fn sync_videos(State(state): State<Arc<AppState>>) -> Result<Json<SyncResponse>, StatusCode> {
    let db = state.db.as_ref().ok_or(StatusCode::SERVICE_UNAVAILABLE)?;

    let rows = sqlx::query_as::<_, (String, String, Option<String>, Option<String>, Option<String>, i32, i64)>(
        r#"SELECT v.id, v.title, v.description, v.category,
           u.username, v.views,
           EXTRACT(EPOCH FROM v."createdAt")::bigint as created_ts
           FROM "Video" v LEFT JOIN "User" u ON v."creatorId" = u.id"#,
    )
    .fetch_all(db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let mut writer = state.search.writer.write().await;

    // Clear existing index
    writer.delete_all_documents().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let count = rows.len();
    for (id, title, desc, cat, creator, views, created_ts) in &rows {
        writer
            .add_document(doc!(
                state.search.f_id => id.as_str(),
                state.search.f_title => title.as_str(),
                state.search.f_description => desc.as_deref().unwrap_or(""),
                state.search.f_category => cat.as_deref().unwrap_or(""),
                state.search.f_creator_name => creator.as_deref().unwrap_or(""),
                state.search.f_creator_id => "",
                state.search.f_views => *views as i64,
                state.search.f_created_at => *created_ts,
            ))
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    }

    writer.commit().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    tracing::info!("✅ Indexed {} videos into Tantivy", count);

    Ok(Json(SyncResponse {
        ok: true,
        indexed: count,
    }))
}

async fn trending(
    State(state): State<Arc<AppState>>,
    Query(params): Query<TrendingQuery>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let db = state.db.as_ref().ok_or(StatusCode::SERVICE_UNAVAILABLE)?;
    let limit = params.limit.unwrap_or(20).min(50) as i64;
    let content_type = params.content_type.unwrap_or_else(|| "video".into());

    let rows = sqlx::query_as::<_, (serde_json::Value,)>(
        r#"SELECT json_build_object(
            'id', v.id, 'title', v.title, 'coverUrl', v."coverUrl",
            'views', v.views, 'likes', v.likes, 'duration', v.duration,
            'contentType', v."contentType", 'createdAt', v."createdAt",
            'creator', json_build_object('id', u.id, 'username', u.username, 'avatarUrl', u."avatarUrl")
        ) FROM "Video" v
        LEFT JOIN "User" u ON v."creatorId" = u.id
        WHERE v."contentType" = $1
        ORDER BY v.views DESC LIMIT $2"#,
    )
    .bind(&content_type)
    .bind(limit)
    .fetch_all(db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let trending: Vec<serde_json::Value> = rows.into_iter().map(|(v,)| v).collect();
    Ok(Json(serde_json::json!({
        "type": content_type,
        "trending": trending,
    })))
}

// ============== Main ==============
#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Load .env
    let _ = dotenvy::from_filename("../../.env.local");
    tracing_subscriber::fmt::init();

    let config = AppConfig::from_env();

    if config.jwt_secret.len() < 32 {
        tracing::warn!("JWT_SECRET 未配置或长度不足");
    }

    // Initialize Tantivy
    let search = SearchIndex::new().expect("Failed to create Tantivy index");
    tracing::info!("✅ Tantivy search index initialized (RAM mode)");

    // Connect to PostgreSQL
    let db = if !config.database_url.is_empty() {
        match PgPoolOptions::new()
            .max_connections(5)
            .connect(&config.database_url)
            .await
        {
            Ok(pool) => {
                tracing::info!("✅ Database connected");
                Some(pool)
            }
            Err(e) => {
                tracing::warn!("⚠️ Database not available: {}", e);
                None
            }
        }
    } else {
        None
    };

    let port = config.port;
    let state = Arc::new(AppState { config, search, db });

    let app = Router::new()
        .route("/health", get(health))
        .route("/search", get(search))
        .route("/trending", get(trending))
        .route("/sync/videos", post(sync_videos))
        .layer(CorsLayer::permissive())
        .with_state(state);

    let addr = format!("0.0.0.0:{}", port);
    tracing::info!("🔍 Search service (Tantivy) running on {}", addr);
    let listener = tokio::net::TcpListener::bind(&addr).await?;
    axum::serve(listener, app).await?;
    Ok(())
}

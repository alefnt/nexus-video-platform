/*!
 * Nexus Search Service (Rust/Axum + Tantivy)
 *
 * 全文搜索引擎 — 替代 Node.js + Meilisearch 实现
 * 使用 Tantivy (Rust 原生搜索引擎) 实现高性能全文索引
 *
 * Port: 8101
 */

use axum::{
    extract::{Query, State},
    http::StatusCode,
    response::{IntoResponse, Json},
    routing::{get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tantivy::{
    collector::TopDocs,
    doc,
    query::QueryParser,
    schema::{Field, Schema, Value, STORED, TEXT, NumericOptions},
    Index, IndexReader, IndexWriter, ReloadPolicy,
};
use tokio::sync::RwLock;
use tower_http::cors::CorsLayer;

// ============== Config ==============
struct AppConfig {
    port: u16,
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
            database_url: std::env::var("DATABASE_URL").unwrap_or_default(),
        }
    }
}

// ============== Tantivy Index ==============
struct SearchIndex {
    _index: Index,
    reader: IndexReader,
    writer: Arc<RwLock<IndexWriter>>,
    f_id: Field,
    f_title: Field,
    f_description: Field,
    f_category: Field,
    f_creator_name: Field,
    f_views: Field,
}

impl SearchIndex {
    fn new() -> anyhow::Result<Self> {
        let mut schema_builder = Schema::builder();
        let f_id = schema_builder.add_text_field("id", TEXT | STORED);
        let f_title = schema_builder.add_text_field("title", TEXT | STORED);
        let f_description = schema_builder.add_text_field("description", TEXT | STORED);
        let f_category = schema_builder.add_text_field("category", TEXT | STORED);
        let f_creator_name = schema_builder.add_text_field("creator_name", TEXT | STORED);
        let opts: NumericOptions = NumericOptions::default().set_stored().set_fast();
        let f_views = schema_builder.add_i64_field("views", opts);
        let schema = schema_builder.build();

        let index = Index::create_in_ram(schema);
        let reader = index
            .reader_builder()
            .reload_policy(ReloadPolicy::OnCommitWithDelay)
            .try_into()?;
        let writer = index.writer(50_000_000)?;

        Ok(Self {
            _index: index,
            reader,
            writer: Arc::new(RwLock::new(writer)),
            f_id,
            f_title,
            f_description,
            f_category,
            f_creator_name,
            f_views,
        })
    }
}

// ============== App State ==============
struct AppState {
    search: SearchIndex,
    db: Option<sqlx::PgPool>,
}

// ============== Types ==============
#[derive(Deserialize)]
struct SearchParams {
    q: Option<String>,
    page: Option<u32>,
    limit: Option<u32>,
}

#[derive(Serialize)]
struct SearchResponse {
    query: String,
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

#[derive(Deserialize)]
struct TrendingParams {
    limit: Option<i64>,
}

// ============== Handlers ==============

async fn handle_health() -> Json<HealthResponse> {
    Json(HealthResponse {
        status: "ok".into(),
        service: "search".into(),
        engine: "tantivy".into(),
        language: "rust".into(),
    })
}

async fn handle_search(
    State(state): State<Arc<AppState>>,
    Query(params): Query<SearchParams>,
) -> Result<Json<SearchResponse>, StatusCode> {
    let start = std::time::Instant::now();
    let q = params.q.unwrap_or_default().trim().to_string();
    let page = params.page.unwrap_or(1).max(1);
    let limit = params.limit.unwrap_or(20).min(50).max(1);

    if q.is_empty() {
        return Err(StatusCode::BAD_REQUEST);
    }

    let searcher = state.search.reader.searcher();

    // Build query parser for searchable fields
    let query_parser = QueryParser::for_index(
        &searcher.index(),
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
        .search(&query, &TopDocs::with_limit((limit as usize) + offset))
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let total = top_docs.len();
    let results: Vec<serde_json::Value> = top_docs
        .into_iter()
        .skip(offset)
        .take(limit as usize)
        .filter_map(|(_, doc_address)| {
            let doc: tantivy::TantivyDocument = searcher.doc(doc_address).ok()?;
            let get_text = |field: Field| -> String {
                doc.get_first(field)
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string()
            };
            let views = doc
                .get_first(state.search.f_views)
                .and_then(|v| v.as_i64())
                .unwrap_or(0);

            Some(serde_json::json!({
                "id": get_text(state.search.f_id),
                "title": get_text(state.search.f_title),
                "description": get_text(state.search.f_description),
                "category": get_text(state.search.f_category),
                "creatorName": get_text(state.search.f_creator_name),
                "views": views,
            }))
        })
        .collect();

    Ok(Json(SearchResponse {
        query: q,
        page,
        limit,
        total,
        results,
        processing_time_ms: start.elapsed().as_millis(),
    }))
}

async fn handle_sync(
    State(state): State<Arc<AppState>>,
) -> Result<impl IntoResponse, StatusCode> {
    let db = state.db.as_ref().ok_or(StatusCode::SERVICE_UNAVAILABLE)?;

    let rows: Vec<(String, String, Option<String>, Option<String>, Option<String>, i32)> =
        sqlx::query_as(
            r#"SELECT v.id, v.title, v.description, v.category, u.username, v.views
               FROM "Video" v LEFT JOIN "User" u ON v."creatorId" = u.id"#,
        )
        .fetch_all(db)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let mut writer = state.search.writer.write().await;
    let _ = writer.delete_all_documents();

    let count = rows.len();
    for (id, title, desc, cat, creator, views) in &rows {
        let _ = writer.add_document(doc!(
            state.search.f_id => id.as_str(),
            state.search.f_title => title.as_str(),
            state.search.f_description => desc.as_deref().unwrap_or(""),
            state.search.f_category => cat.as_deref().unwrap_or(""),
            state.search.f_creator_name => creator.as_deref().unwrap_or(""),
            state.search.f_views => *views as i64,
        ));
    }

    let _ = writer.commit();
    tracing::info!("✅ Indexed {} videos into Tantivy", count);

    Ok(Json(serde_json::json!({"ok": true, "indexed": count})))
}

async fn handle_trending(
    State(state): State<Arc<AppState>>,
    Query(params): Query<TrendingParams>,
) -> Result<impl IntoResponse, StatusCode> {
    let db = state.db.as_ref().ok_or(StatusCode::SERVICE_UNAVAILABLE)?;
    let limit = params.limit.unwrap_or(20).min(50);

    let rows: Vec<(serde_json::Value,)> = sqlx::query_as(
        r#"SELECT json_build_object(
            'id', v.id, 'title', v.title, 'coverUrl', v."coverUrl",
            'views', v.views, 'likes', v.likes,
            'creator', json_build_object('id', u.id, 'username', u.username)
        ) FROM "Video" v
        LEFT JOIN "User" u ON v."creatorId" = u.id
        ORDER BY v.views DESC LIMIT $1"#,
    )
    .bind(limit)
    .fetch_all(db)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let trending: Vec<serde_json::Value> = rows.into_iter().map(|(v,)| v).collect();
    Ok(Json(serde_json::json!({"trending": trending})))
}

// ============== Main ==============
#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let _ = dotenvy::from_filename("../../.env.local");
    tracing_subscriber::fmt::init();

    let config = AppConfig::from_env();

    let search_index = SearchIndex::new().expect("Failed to create Tantivy index");
    tracing::info!("✅ Tantivy search index initialized (RAM mode)");

    let db = if !config.database_url.is_empty() {
        match sqlx::postgres::PgPoolOptions::new()
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
    let state = Arc::new(AppState { search: search_index, db });

    let app = Router::new()
        .route("/health", get(handle_health))
        .route("/search", get(handle_search))
        .route("/trending", get(handle_trending))
        .route("/sync/videos", post(handle_sync))
        .layer(CorsLayer::permissive())
        .with_state(state);

    let addr = format!("0.0.0.0:{}", port);
    tracing::info!("🔍 Search service (Tantivy/Rust) running on {}", addr);
    let listener = tokio::net::TcpListener::bind(&addr).await?;
    axum::serve(listener, app).await?;
    Ok(())
}

"""
Recommendation Service (Python/FastAPI)

智能推荐引擎 — 替代原 Node.js 实现
支持: 热门排序 + 标签匹配 + 协同过滤 + 探索发现

Port: 8105
"""

import os
import math
import time
import random
import logging
from typing import Optional, List
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, HTTPException, Depends, Query
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from jose import jwt as jose_jwt, JWTError
from prometheus_client import Counter, Histogram, generate_latest, CONTENT_TYPE_LATEST
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", "..", "..", ".env.local"))

# ============== Config ==============
PORT = int(os.getenv("PORT", "8105"))
JWT_SECRET = os.getenv("JWT_SECRET", "")
DATABASE_URL = os.getenv("DATABASE_URL", "")

if not JWT_SECRET or len(JWT_SECRET) < 32:
    raise RuntimeError("JWT_SECRET 未配置或长度不足")

# ============== Logging ==============
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("recommendation")

# ============== Constants ==============
FEED_COMPOSITION = {"hot": 0.3, "tagMatch": 0.35, "cf": 0.15, "explore": 0.2}
HOTNESS_HALF_LIFE_HOURS = 48
INTEREST_DECAY_FACTOR = 0.95

# ============== Database ==============
import psycopg2
import psycopg2.extras

db_pool = None

def get_db():
    global db_pool
    if db_pool is None and DATABASE_URL:
        try:
            db_pool = psycopg2.connect(DATABASE_URL)
            db_pool.autocommit = True
            logger.info("✅ Database connected")
        except Exception as e:
            logger.warning(f"⚠️ Database not available: {e}")
    return db_pool

# ============== Utility ==============
def calculate_hotness(views: int, likes: int, comments: int, created_at) -> float:
    age_hours = (time.time() - created_at.timestamp()) / 3600
    time_decay = math.pow(0.5, age_hours / HOTNESS_HALF_LIFE_HOURS)
    engagement = views * 1 + likes * 5 + comments * 3
    return engagement * time_decay

def tag_similarity(user_tags: List[str], video_tags: List[str]) -> float:
    if not user_tags or not video_tags:
        return 0.0
    set_a = set(user_tags)
    set_b = set(video_tags)
    intersection = len(set_a & set_b)
    union = len(set_a | set_b)
    return intersection / union if union > 0 else 0.0

# ============== Prometheus ==============
feed_counter = Counter("recommendation_feed_total", "Total feed requests", ["source"])
feed_duration = Histogram("recommendation_duration_seconds", "Feed generation duration", buckets=[0.1, 0.5, 1, 2, 5])

# ============== JWT Auth ==============
def verify_jwt_optional(request: Request) -> Optional[str]:
    """GET endpoints are public; POST requires auth"""
    if request.url.path.startswith("/health") or request.url.path.startswith("/metrics"):
        return None
    if request.method == "GET":
        return None
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        try:
            payload = jose_jwt.decode(auth[7:], JWT_SECRET, algorithms=["HS256"])
            return payload.get("sub") or payload.get("userId")
        except JWTError:
            pass
    if request.headers.get("x-internal-service") == "true":
        return "internal"
    raise HTTPException(status_code=401, detail="未授权")

# ============== Lifecycle ==============
@asynccontextmanager
async def lifespan(app: FastAPI):
    get_db()
    yield
    if db_pool:
        db_pool.close()

# ============== App ==============
app = FastAPI(title="Recommendation Service", version="2.0.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# ============== Request Models ==============
class InterestRequest(BaseModel):
    userId: str
    tags: List[str]
    source: str = "watch"
    weight: float = 1.0

class FeedbackRequest(BaseModel):
    userId: str
    videoId: str
    action: str  # click | watch | complete
    watchTime: int = 0

# ============== DB Helpers ==============
VIDEO_SELECT = """
    v.id, v.title, v."coverUrl", v."videoUrl", v.duration, v.views, v.likes,
    v."commentCount", v.tags, v."contentType", v."createdAt",
    u.id as "creatorId", u.username as "creatorUsername", u."avatarUrl" as "creatorAvatar"
"""

def row_to_video(row: dict) -> dict:
    return {
        "id": row["id"],
        "title": row["title"],
        "coverUrl": row.get("coverUrl"),
        "videoUrl": row.get("videoUrl"),
        "duration": row.get("duration"),
        "views": row.get("views", 0),
        "likes": row.get("likes", 0),
        "commentCount": row.get("commentCount", 0),
        "tags": row.get("tags", []),
        "contentType": row.get("contentType", "video"),
        "createdAt": row["createdAt"].isoformat() if row.get("createdAt") else None,
        "creator": {
            "id": row.get("creatorId"),
            "username": row.get("creatorUsername"),
            "avatarUrl": row.get("creatorAvatar"),
        },
    }

# ============== Endpoints ==============
@app.get("/health")
async def health():
    return {"status": "ok", "service": "recommendation", "language": "python"}

@app.get("/metrics")
async def metrics():
    return JSONResponse(content=generate_latest().decode(), media_type=CONTENT_TYPE_LATEST)

@app.get("/recommendation/feed")
async def get_feed(
    userId: Optional[str] = None,
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=50),
    contentType: str = "video",
):
    start = time.time()
    conn = get_db()
    if not conn:
        return {"items": [], "page": page, "pageSize": pageSize, "hasMore": False}

    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        skip = (page - 1) * pageSize

        # Get watched IDs and user interests
        watched_ids = []
        user_tags = []
        if userId:
            cur.execute(
                'SELECT "videoId" FROM "WatchHistory" WHERE "userId" = %s ORDER BY "lastWatchedAt" DESC LIMIT 200',
                (userId,),
            )
            watched_ids = [r["videoId"] for r in cur.fetchall()]
            cur.execute(
                'SELECT tag, score FROM "UserInterest" WHERE "userId" = %s ORDER BY score DESC LIMIT 50',
                (userId,),
            )
            user_tags = [{"tag": r["tag"], "score": r["score"]} for r in cur.fetchall()]

        content_filter = 'AND v."contentType" = %s' if contentType != "all" else ""
        content_params = [contentType] if contentType != "all" else []

        # 1. Hot content
        hot_count = math.ceil(pageSize * FEED_COMPOSITION["hot"])
        exclude_clause = ""
        exclude_params = []
        if watched_ids:
            exclude_clause = "AND v.id != ALL(%s)"
            exclude_params = [watched_ids]

        cur.execute(
            f"""SELECT {VIDEO_SELECT} FROM "Video" v
            LEFT JOIN "User" u ON v."creatorId" = u.id
            WHERE v."moderationStatus" = 'approved' {exclude_clause} {content_filter}
            ORDER BY v.views DESC, v.likes DESC LIMIT %s""",
            exclude_params + content_params + [hot_count * 3],
        )
        hot_videos = cur.fetchall()
        hot_ranked = sorted(
            [row_to_video(r) for r in hot_videos],
            key=lambda v: calculate_hotness(v["views"], v["likes"], v["commentCount"], 
                                            __import__("dateutil.parser", fromlist=["parse"]).parse(v["createdAt"]) if v["createdAt"] else __import__("datetime").datetime.now()),
            reverse=True,
        )[:hot_count]

        # 2. Tag match
        tag_matched = []
        if userId and user_tags:
            tag_count = math.ceil(pageSize * FEED_COMPOSITION["tagMatch"])
            top_tags = [t["tag"] for t in user_tags[:10]]
            existing_ids = [v["id"] for v in hot_ranked] + watched_ids
            exclude_existing = "AND v.id != ALL(%s)" if existing_ids else ""
            cur.execute(
                f"""SELECT {VIDEO_SELECT} FROM "Video" v
                LEFT JOIN "User" u ON v."creatorId" = u.id
                WHERE v."moderationStatus" = 'approved'
                AND v.tags && %s::text[]
                {exclude_existing} {content_filter}
                LIMIT %s""",
                [top_tags] + ([existing_ids] if existing_ids else []) + content_params + [tag_count * 3],
            )
            tag_videos = [row_to_video(r) for r in cur.fetchall()]
            user_tag_names = [t["tag"] for t in user_tags]
            tag_matched = sorted(
                tag_videos,
                key=lambda v: tag_similarity(user_tag_names, v.get("tags", [])),
                reverse=True,
            )[:tag_count]

        # 3. Collaborative filtering (simplified)
        cf_videos = []
        if userId and watched_ids:
            cf_count = math.ceil(pageSize * FEED_COMPOSITION["cf"])
            cur.execute(
                """SELECT DISTINCT "userId" FROM "WatchHistory"
                WHERE "videoId" = ANY(%s) AND "userId" != %s AND completed = true LIMIT 50""",
                (watched_ids[:20], userId),
            )
            similar_user_ids = [r[0] for r in cur.fetchall()]

            if similar_user_ids:
                all_exclude = watched_ids + [v["id"] for v in hot_ranked + tag_matched]
                cur.execute(
                    f"""SELECT DISTINCT ON (v.id) {VIDEO_SELECT} FROM "WatchHistory" wh
                    JOIN "Video" v ON wh."videoId" = v.id
                    LEFT JOIN "User" u ON v."creatorId" = u.id
                    WHERE wh."userId" = ANY(%s) AND wh.completed = true
                    AND v.id != ALL(%s) AND v."moderationStatus" = 'approved' {content_filter}
                    LIMIT %s""",
                    [similar_user_ids, all_exclude] + content_params + [cf_count * 3],
                )
                cf_videos = [row_to_video(r) for r in cur.fetchall()][:cf_count]

        # 4. Explore (random)
        explore_count = math.ceil(pageSize * FEED_COMPOSITION["explore"])
        all_existing = [v["id"] for v in hot_ranked + tag_matched + cf_videos] + watched_ids
        cur.execute('SELECT count(*) FROM "Video" WHERE "moderationStatus" = \'approved\'')
        total = cur.fetchone()[0]
        random_skip = max(0, random.randint(0, max(total - explore_count, 1)))
        exclude_explore = "AND v.id != ALL(%s)" if all_existing else ""
        cur.execute(
            f"""SELECT {VIDEO_SELECT} FROM "Video" v
            LEFT JOIN "User" u ON v."creatorId" = u.id
            WHERE v."moderationStatus" = 'approved' {exclude_explore} {content_filter}
            OFFSET %s LIMIT %s""",
            ([all_existing] if all_existing else []) + content_params + [random_skip, explore_count],
        )
        explore_videos = [row_to_video(r) for r in cur.fetchall()]

        # Merge + shuffle
        all_results = hot_ranked + tag_matched + cf_videos + explore_videos
        random.shuffle(all_results)
        feed = all_results[skip:skip + pageSize]

        # Log recommendations (async-like, best effort)
        if userId and feed:
            try:
                for idx, item in enumerate(feed):
                    cur.execute(
                        """INSERT INTO "RecommendationLog" ("userId", "videoId", position, source, "createdAt")
                        VALUES (%s, %s, %s, %s, NOW()) ON CONFLICT DO NOTHING""",
                        (userId, item["id"], skip + idx, "mixed"),
                    )
            except Exception:
                pass

        feed_counter.labels(source="feed").inc()
        feed_duration.observe(time.time() - start)

        return {"items": feed, "page": page, "pageSize": pageSize, "hasMore": len(all_results) > skip + pageSize}

    except Exception as e:
        logger.error(f"Feed error: {e}")
        return JSONResponse(status_code=500, content={"error": "推荐获取失败", "message": str(e)})


@app.get("/recommendation/trending")
async def get_trending(
    hours: int = Query(24, ge=1),
    limit: int = Query(20, ge=1, le=50),
    contentType: str = "video",
):
    conn = get_db()
    if not conn:
        return {"items": [], "period": f"{hours}h"}

    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        content_filter = 'AND v."contentType" = %s' if contentType != "all" else ""
        content_params = [contentType] if contentType != "all" else []

        cur.execute(
            f"""SELECT {VIDEO_SELECT} FROM "Video" v
            LEFT JOIN "User" u ON v."creatorId" = u.id
            WHERE v."createdAt" >= NOW() - INTERVAL '%s hours'
            AND v."moderationStatus" = 'approved' {content_filter}
            ORDER BY v.views DESC, v.likes DESC
            LIMIT %s""",
            [hours] + content_params + [limit * 2],
        )
        videos = [row_to_video(r) for r in cur.fetchall()]
        ranked = sorted(
            videos,
            key=lambda v: v["views"] * 1 + v["likes"] * 5 + v["commentCount"] * 3,
            reverse=True,
        )[:limit]

        return {"items": ranked, "period": f"{hours}h"}
    except Exception as e:
        logger.error(f"Trending error: {e}")
        return JSONResponse(status_code=500, content={"error": "趋势获取失败"})


@app.get("/recommendation/similar/{videoId}")
async def get_similar(videoId: str, limit: int = Query(10, ge=1, le=50)):
    conn = get_db()
    if not conn:
        return {"items": []}

    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute('SELECT tags, "creatorId", "contentType" FROM "Video" WHERE id = %s', (videoId,))
        video = cur.fetchone()
        if not video:
            raise HTTPException(404, "视频不存在")

        tags = video.get("tags") or []
        if not tags:
            # No tags: return same creator's other videos
            cur.execute(
                f"""SELECT {VIDEO_SELECT} FROM "Video" v
                LEFT JOIN "User" u ON v."creatorId" = u.id
                WHERE v."creatorId" = %s AND v.id != %s AND v."moderationStatus" = 'approved'
                ORDER BY v.views DESC LIMIT %s""",
                (video["creatorId"], videoId, limit),
            )
            return {"items": [row_to_video(r) for r in cur.fetchall()]}

        # Tag similarity search
        cur.execute(
            f"""SELECT {VIDEO_SELECT} FROM "Video" v
            LEFT JOIN "User" u ON v."creatorId" = u.id
            WHERE v.id != %s AND v.tags && %s::text[] AND v."moderationStatus" = 'approved'
            LIMIT %s""",
            (videoId, tags, limit * 3),
        )
        similar = [row_to_video(r) for r in cur.fetchall()]
        ranked = sorted(similar, key=lambda v: tag_similarity(tags, v.get("tags", [])), reverse=True)[:limit]
        return {"items": ranked}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Similar error: {e}")
        return JSONResponse(status_code=500, content={"error": "相似推荐失败"})


@app.post("/recommendation/interest")
async def update_interest(body: InterestRequest, user_id: str = Depends(verify_jwt_optional)):
    if not body.userId or not body.tags:
        raise HTTPException(400, "缺少 userId 或 tags")
    conn = get_db()
    if not conn:
        raise HTTPException(500, "数据库不可用")

    try:
        cur = conn.cursor()
        for tag in body.tags:
            cur.execute(
                """INSERT INTO "UserInterest" ("userId", tag, score, source, "updatedAt")
                VALUES (%s, %s, %s, %s, NOW())
                ON CONFLICT ("userId", tag) DO UPDATE SET score = "UserInterest".score + %s, source = %s, "updatedAt" = NOW()""",
                (body.userId, tag, body.weight, body.source, body.weight, body.source),
            )
        return {"success": True, "updated": len(body.tags)}
    except Exception as e:
        logger.error(f"Interest update error: {e}")
        raise HTTPException(500, "兴趣更新失败")


@app.post("/recommendation/feedback")
async def record_feedback(body: FeedbackRequest, user_id: str = Depends(verify_jwt_optional)):
    if not body.userId or not body.videoId:
        raise HTTPException(400, "缺少参数")
    conn = get_db()
    if not conn:
        raise HTTPException(500, "数据库不可用")

    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        # Update recent recommendation log
        cur.execute(
            """SELECT id, clicked, "watchTime", completed FROM "RecommendationLog"
            WHERE "userId" = %s AND "videoId" = %s ORDER BY "createdAt" DESC LIMIT 1""",
            (body.userId, body.videoId),
        )
        log = cur.fetchone()
        if log:
            cur.execute(
                """UPDATE "RecommendationLog" SET
                clicked = %s, "watchTime" = %s, completed = %s
                WHERE id = %s""",
                (
                    body.action == "click" or log.get("clicked", False),
                    body.watchTime if body.action == "watch" else log.get("watchTime", 0),
                    body.action == "complete" or log.get("completed", False),
                    log["id"],
                ),
            )

        # If completed or watched >60s, boost related tags
        if body.action == "complete" or (body.action == "watch" and body.watchTime > 60):
            cur.execute('SELECT tags FROM "Video" WHERE id = %s', (body.videoId,))
            video = cur.fetchone()
            if video and video.get("tags"):
                weight = 2.0 if body.action == "complete" else 1.0
                for tag in video["tags"]:
                    cur.execute(
                        """INSERT INTO "UserInterest" ("userId", tag, score, source, "updatedAt")
                        VALUES (%s, %s, %s, 'watch', NOW())
                        ON CONFLICT ("userId", tag) DO UPDATE SET score = "UserInterest".score + %s, "updatedAt" = NOW()""",
                        (body.userId, tag, weight, weight),
                    )

        return {"success": True}
    except Exception as e:
        logger.error(f"Feedback error: {e}")
        raise HTTPException(500, "反馈记录失败")


@app.post("/recommendation/decay")
async def decay_interests(user_id: str = Depends(verify_jwt_optional)):
    conn = get_db()
    if not conn:
        raise HTTPException(500, "数据库不可用")

    try:
        cur = conn.cursor()
        cur.execute(
            'UPDATE "UserInterest" SET score = score * %s WHERE score > 0.01',
            (INTEREST_DECAY_FACTOR,),
        )
        cur.execute('DELETE FROM "UserInterest" WHERE score < 0.01')
        pruned_interests = cur.rowcount
        cur.execute(
            """DELETE FROM "RecommendationLog" WHERE "createdAt" < NOW() - INTERVAL '30 days'"""
        )
        pruned_logs = cur.rowcount

        return {
            "success": True,
            "decayFactor": INTEREST_DECAY_FACTOR,
            "prunedInterests": pruned_interests,
            "prunedLogs": pruned_logs,
        }
    except Exception as e:
        logger.error(f"Decay error: {e}")
        raise HTTPException(500, "衰减失败")


# ============== Entry ==============
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=PORT, reload=False, log_level="info")

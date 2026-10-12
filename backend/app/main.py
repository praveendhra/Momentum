import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import activities, auth, categories, logs, stats
from app.core.config import get_settings

settings = get_settings()
logger = logging.getLogger("momentum")


@asynccontextmanager
async def lifespan(_: FastAPI):
    if settings.dev_auth:
        logger.warning("AUTH_MODE=dev: email-only dev login is enabled. Never use this in production.")
    elif not (settings.supabase_jwt_secret or settings.supabase_url):
        logger.warning("Neither SUPABASE_JWT_SECRET nor SUPABASE_URL is set; authenticated requests will fail.")
    yield


app = FastAPI(
    lifespan=lifespan,
    title="Momentum API",
    version="0.1.0",
    description="Self-improvement tracker API",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API v1 routes
app.include_router(auth.router, prefix="/api/v1")
app.include_router(categories.router, prefix="/api/v1")
app.include_router(activities.router, prefix="/api/v1")
app.include_router(logs.router, prefix="/api/v1")
app.include_router(stats.router, prefix="/api/v1")


@app.get("/health")
async def health():
    return {"status": "ok"}

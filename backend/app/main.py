from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.api.routes import categories, activities, logs, stats

settings = get_settings()

app = FastAPI(
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
app.include_router(categories.router, prefix="/api/v1")
app.include_router(activities.router, prefix="/api/v1")
app.include_router(logs.router, prefix="/api/v1")
app.include_router(stats.router, prefix="/api/v1")


@app.get("/health")
async def health():
    return {"status": "ok"}

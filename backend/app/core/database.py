from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import get_settings

settings = get_settings()

_connect_args: dict = {}
if settings.uses_pgbouncer:
    _connect_args["statement_cache_size"] = 0

engine = create_async_engine(
    settings.async_database_url,
    echo=False,
    pool_pre_ping=True,
    connect_args=_connect_args,
)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_db() -> AsyncIterator[AsyncSession]:
    async with async_session() as session:
        yield session

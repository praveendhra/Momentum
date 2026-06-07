from uuid import UUID
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user_id
from app.core.database import get_db
from app.models import ActivityCategory
from app.schemas.schemas import CategoryOut, CategoryCreate

router = APIRouter(prefix="/categories", tags=["categories"])


@router.get("", response_model=list[CategoryOut])
async def list_categories(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(ActivityCategory).where(
        (ActivityCategory.is_system == True) | (ActivityCategory.user_id == UUID(user_id))  # noqa: E712
    )
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("", response_model=CategoryOut, status_code=201)
async def create_category(
    data: CategoryCreate,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    category = ActivityCategory(
        name=data.name,
        slug=data.slug,
        icon=data.icon,
        color=data.color,
        is_system=False,
        user_id=UUID(user_id),
    )
    db.add(category)
    await db.commit()
    await db.refresh(category)
    return category

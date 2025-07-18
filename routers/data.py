from fastapi import APIRouter

router = APIRouter()

@router.get("/{item_id}")
async def get_item(item_id: str):
    return {"item_id": item_id, "description": f"You requested data for '{item_id}'"}

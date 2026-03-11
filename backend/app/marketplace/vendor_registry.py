"""
Vendor Registry — simulated open commerce network.

Manages vendor registration, lookup, and inventory queries.
Vendors are persisted in PostgreSQL and their inventory is stored as
a JSON column mapping product keys to prices.

On startup, seed_vendors() populates example vendor data.
"""

import logging
from typing import Any, Dict, List, Optional

from sqlalchemy import select

from app.models.db import Vendor, async_session

log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Seed data — inserted on first startup via seed_vendors()
# ---------------------------------------------------------------------------
_SEED_VENDORS: List[Dict[str, Any]] = [
    {
        "vendor_id": "vendor_1",
        "vendor_name": "TechVendorX",
        "rating": 4.6,
        "delivery_speed": 2,
        "inventory": {
            "ram_16gb_ddr4": 4300,
            "ram_16gb_ddr5": 5200,
            "ssd_512gb": 3200,
            "ssd_1tb": 5800,
        },
        "pricing_model": "fixed",
    },
    {
        "vendor_id": "vendor_2",
        "vendor_name": "MegaChip Electronics",
        "rating": 4.3,
        "delivery_speed": 3,
        "inventory": {
            "ram_16gb_ddr4": 4100,
            "ram_16gb_ddr5": 4900,
            "ssd_512gb": 3400,
        },
        "pricing_model": "fixed",
    },
    {
        "vendor_id": "vendor_3",
        "vendor_name": "SiliconMart",
        "rating": 4.8,
        "delivery_speed": 4,
        "inventory": {
            "ram_16gb_ddr4": 4500,
            "ram_16gb_ddr5": 5500,
            "ssd_1tb": 5600,
        },
        "pricing_model": "fixed",
    },
    {
        "vendor_id": "vendor_4",
        "vendor_name": "QuickParts India",
        "rating": 4.1,
        "delivery_speed": 1,
        "inventory": {
            "ram_16gb_ddr4": 4600,
            "ram_16gb_ddr5": 5400,
        },
        "pricing_model": "fixed",
    },
]


async def register_vendor(
    vendor_id: str,
    vendor_name: str,
    rating: float,
    delivery_speed: int,
    inventory: Dict[str, float],
    pricing_model: str = "fixed",
) -> Dict[str, Any]:
    """Register or update a vendor. Returns the vendor record as dict."""
    async with async_session() as session:
        result = await session.execute(
            select(Vendor).where(Vendor.vendor_id == vendor_id)
        )
        existing = result.scalar_one_or_none()

        if existing:
            existing.vendor_name = vendor_name
            existing.rating = rating
            existing.delivery_speed = delivery_speed
            existing.inventory = inventory
            existing.pricing_model = pricing_model
            await session.commit()
            await session.refresh(existing)
            vendor = existing
        else:
            vendor = Vendor(
                vendor_id=vendor_id,
                vendor_name=vendor_name,
                rating=rating,
                delivery_speed=delivery_speed,
                inventory=inventory,
                pricing_model=pricing_model,
            )
            session.add(vendor)
            await session.commit()
            await session.refresh(vendor)

        return _vendor_to_dict(vendor)


async def list_vendors() -> List[Dict[str, Any]]:
    """Return all registered vendors."""
    async with async_session() as session:
        result = await session.execute(select(Vendor))
        vendors = result.scalars().all()
        return [_vendor_to_dict(v) for v in vendors]


async def get_vendor_inventory(vendor_id: str) -> Optional[Dict[str, Any]]:
    """Return a single vendor with its full inventory. None if not found."""
    async with async_session() as session:
        result = await session.execute(
            select(Vendor).where(Vendor.vendor_id == vendor_id)
        )
        vendor = result.scalar_one_or_none()
        if vendor is None:
            return None
        return _vendor_to_dict(vendor)


async def seed_vendors() -> None:
    """Upsert seed vendor data on startup."""
    for spec in _SEED_VENDORS:
        await register_vendor(**spec)
    log.info("Seeded %d vendors into marketplace", len(_SEED_VENDORS))


def _vendor_to_dict(vendor: Vendor) -> Dict[str, Any]:
    return {
        "vendor_id": vendor.vendor_id,
        "vendor_name": vendor.vendor_name,
        "rating": vendor.rating,
        "delivery_speed": vendor.delivery_speed,
        "inventory": vendor.inventory,
        "pricing_model": vendor.pricing_model,
    }

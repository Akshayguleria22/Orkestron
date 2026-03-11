"""
Product & Vendor Data Service — manages real inventory data.

Provides CRUD operations for products and vendor inventory,
plus seed data for demo purposes (replaces mock data).
"""

import uuid
from typing import List, Dict, Any, Optional

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.db import async_session, Product, Vendor


# ---------------------------------------------------------------------------
# Product CRUD
# ---------------------------------------------------------------------------

async def get_products(
    category: Optional[str] = None,
    vendor_id: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    search: Optional[str] = None,
    limit: int = 50,
) -> List[Dict[str, Any]]:
    """Query products with optional filters."""
    async with async_session() as session:
        stmt = select(Product).where(Product.is_available == True)

        if category:
            stmt = stmt.where(Product.category == category)
        if vendor_id:
            stmt = stmt.where(Product.vendor_id == vendor_id)
        if min_price is not None:
            stmt = stmt.where(Product.price >= min_price)
        if max_price is not None:
            stmt = stmt.where(Product.price <= max_price)
        if search:
            stmt = stmt.where(Product.name.ilike(f"%{search}%"))

        stmt = stmt.limit(limit).order_by(Product.price.asc())
        result = await session.execute(stmt)
        rows = result.scalars().all()

        return [
            {
                "product_id": r.product_id,
                "vendor_id": r.vendor_id,
                "name": r.name,
                "category": r.category,
                "price": r.price,
                "currency": r.currency,
                "specs": r.specs,
                "stock": r.stock,
                "rating": r.rating,
            }
            for r in rows
        ]


async def get_product(product_id: str) -> Optional[Dict[str, Any]]:
    """Get a single product by ID."""
    async with async_session() as session:
        stmt = select(Product).where(Product.product_id == product_id)
        result = await session.execute(stmt)
        r = result.scalar_one_or_none()
        if not r:
            return None
        return {
            "product_id": r.product_id,
            "vendor_id": r.vendor_id,
            "name": r.name,
            "category": r.category,
            "price": r.price,
            "currency": r.currency,
            "specs": r.specs,
            "stock": r.stock,
            "rating": r.rating,
        }


async def get_categories() -> List[str]:
    """Get all distinct product categories."""
    async with async_session() as session:
        stmt = select(Product.category).distinct().order_by(Product.category)
        result = await session.execute(stmt)
        return [row[0] for row in result.all()]


async def get_product_stats() -> Dict[str, Any]:
    """Get aggregate product statistics."""
    async with async_session() as session:
        total = await session.execute(
            select(func.count()).select_from(Product).where(Product.is_available == True)
        )
        avg_price = await session.execute(
            select(func.avg(Product.price)).where(Product.is_available == True)
        )
        categories = await session.execute(
            select(func.count(func.distinct(Product.category)))
        )
        return {
            "total_products": total.scalar() or 0,
            "avg_price": round(avg_price.scalar() or 0, 2),
            "total_categories": categories.scalar() or 0,
        }


# ---------------------------------------------------------------------------
# Analytics queries
# ---------------------------------------------------------------------------

async def get_vendor_analytics() -> List[Dict[str, Any]]:
    """Get vendor performance analytics."""
    async with async_session() as session:
        stmt = select(Vendor).order_by(Vendor.rating.desc())
        result = await session.execute(stmt)
        vendors = result.scalars().all()

        analytics = []
        for v in vendors:
            prod_count = await session.execute(
                select(func.count()).select_from(Product).where(Product.vendor_id == v.vendor_id)
            )
            analytics.append({
                "vendor_id": v.vendor_id,
                "vendor_name": v.vendor_name,
                "rating": v.rating,
                "delivery_speed": v.delivery_speed,
                "product_count": prod_count.scalar() or 0,
                "pricing_model": v.pricing_model,
            })
        return analytics


# ---------------------------------------------------------------------------
# Seed realistic product data
# ---------------------------------------------------------------------------

_SEED_PRODUCTS = [
    # RAM
    {"name": "Corsair Vengeance LPX 16GB DDR4 3200MHz", "category": "ram", "price": 3499, "specs": {"type": "DDR4", "capacity": "16GB", "speed": "3200MHz", "brand": "Corsair"}, "rating": 4.6},
    {"name": "Kingston FURY Beast 16GB DDR4 3200MHz", "category": "ram", "price": 3199, "specs": {"type": "DDR4", "capacity": "16GB", "speed": "3200MHz", "brand": "Kingston"}, "rating": 4.5},
    {"name": "G.Skill Ripjaws V 16GB DDR4 3600MHz", "category": "ram", "price": 3899, "specs": {"type": "DDR4", "capacity": "16GB", "speed": "3600MHz", "brand": "G.Skill"}, "rating": 4.7},
    {"name": "Crucial RAM 16GB DDR4 3200MHz", "category": "ram", "price": 2999, "specs": {"type": "DDR4", "capacity": "16GB", "speed": "3200MHz", "brand": "Crucial"}, "rating": 4.4},
    {"name": "Samsung 32GB DDR5 4800MHz", "category": "ram", "price": 7499, "specs": {"type": "DDR5", "capacity": "32GB", "speed": "4800MHz", "brand": "Samsung"}, "rating": 4.8},
    {"name": "Kingston FURY Beast 32GB DDR5 5200MHz", "category": "ram", "price": 8999, "specs": {"type": "DDR5", "capacity": "32GB", "speed": "5200MHz", "brand": "Kingston"}, "rating": 4.6},

    # GPU
    {"name": "NVIDIA RTX 4060 8GB", "category": "gpu", "price": 29999, "specs": {"vram": "8GB", "type": "GDDR6X", "brand": "NVIDIA", "series": "RTX 4060"}, "rating": 4.7},
    {"name": "AMD Radeon RX 7600 8GB", "category": "gpu", "price": 24999, "specs": {"vram": "8GB", "type": "GDDR6", "brand": "AMD", "series": "RX 7600"}, "rating": 4.5},
    {"name": "NVIDIA RTX 4070 12GB", "category": "gpu", "price": 49999, "specs": {"vram": "12GB", "type": "GDDR6X", "brand": "NVIDIA", "series": "RTX 4070"}, "rating": 4.8},
    {"name": "NVIDIA RTX 4090 24GB", "category": "gpu", "price": 159999, "specs": {"vram": "24GB", "type": "GDDR6X", "brand": "NVIDIA", "series": "RTX 4090"}, "rating": 4.9},

    # SSD
    {"name": "Samsung 980 PRO 1TB NVMe", "category": "ssd", "price": 7499, "specs": {"capacity": "1TB", "interface": "NVMe", "read_speed": "7000MB/s", "brand": "Samsung"}, "rating": 4.8},
    {"name": "WD Black SN850X 1TB", "category": "ssd", "price": 6999, "specs": {"capacity": "1TB", "interface": "NVMe", "read_speed": "7300MB/s", "brand": "Western Digital"}, "rating": 4.7},
    {"name": "Crucial P3 Plus 500GB NVMe", "category": "ssd", "price": 2999, "specs": {"capacity": "500GB", "interface": "NVMe", "read_speed": "5000MB/s", "brand": "Crucial"}, "rating": 4.5},

    # CPU
    {"name": "AMD Ryzen 7 7800X3D", "category": "cpu", "price": 27999, "specs": {"cores": 8, "threads": 16, "base_clock": "4.2GHz", "brand": "AMD"}, "rating": 4.9},
    {"name": "Intel Core i7-14700K", "category": "cpu", "price": 32999, "specs": {"cores": 20, "threads": 28, "base_clock": "3.4GHz", "brand": "Intel"}, "rating": 4.7},
    {"name": "AMD Ryzen 5 7600", "category": "cpu", "price": 15999, "specs": {"cores": 6, "threads": 12, "base_clock": "3.8GHz", "brand": "AMD"}, "rating": 4.6},

    # Monitors
    {"name": "LG 27GP850-B 27\" QHD 165Hz", "category": "monitor", "price": 24999, "specs": {"size": "27\"", "resolution": "2560x1440", "refresh_rate": "165Hz", "panel": "IPS", "brand": "LG"}, "rating": 4.7},
    {"name": "Dell S2722DGM 27\" QHD 165Hz", "category": "monitor", "price": 19999, "specs": {"size": "27\"", "resolution": "2560x1440", "refresh_rate": "165Hz", "panel": "VA", "brand": "Dell"}, "rating": 4.5},

    # Cloud Services
    {"name": "AWS g5.xlarge GPU Instance (per hr)", "category": "cloud", "price": 85, "specs": {"gpu": "A10G", "vcpu": 4, "ram": "16GB", "provider": "AWS"}, "rating": 4.6},
    {"name": "Azure NC4as T4 v3 (per hr)", "category": "cloud", "price": 45, "specs": {"gpu": "T4", "vcpu": 4, "ram": "28GB", "provider": "Azure"}, "rating": 4.4},
    {"name": "GCP a2-highgpu-1g (per hr)", "category": "cloud", "price": 225, "specs": {"gpu": "A100", "vcpu": 12, "ram": "85GB", "provider": "GCP"}, "rating": 4.8},
]

_SEED_VENDORS = [
    {"vendor_id": "vendor-amazon", "vendor_name": "Amazon India", "rating": 4.5, "delivery_speed": 2, "pricing_model": "dynamic"},
    {"vendor_id": "vendor-flipkart", "vendor_name": "Flipkart", "rating": 4.3, "delivery_speed": 3, "pricing_model": "fixed"},
    {"vendor_id": "vendor-meesho", "vendor_name": "Meesho", "rating": 4.0, "delivery_speed": 5, "pricing_model": "fixed"},
    {"vendor_id": "vendor-croma", "vendor_name": "Croma", "rating": 4.4, "delivery_speed": 4, "pricing_model": "negotiable"},
    {"vendor_id": "vendor-reliance", "vendor_name": "Reliance Digital", "rating": 4.6, "delivery_speed": 3, "pricing_model": "negotiable"},
    {"vendor_id": "vendor-aws", "vendor_name": "Amazon Web Services", "rating": 4.8, "delivery_speed": 0, "pricing_model": "usage"},
    {"vendor_id": "vendor-azure", "vendor_name": "Microsoft Azure", "rating": 4.6, "delivery_speed": 0, "pricing_model": "usage"},
    {"vendor_id": "vendor-gcp", "vendor_name": "Google Cloud", "rating": 4.7, "delivery_speed": 0, "pricing_model": "usage"},
]


async def seed_product_data() -> None:
    """Seed the database with realistic vendor and product data."""
    async with async_session() as session:
        # Check if data already exists
        existing = await session.execute(select(func.count()).select_from(Product))
        if (existing.scalar() or 0) > 0:
            return

        # Seed vendors (upsert)
        for v_data in _SEED_VENDORS:
            existing_v = await session.execute(
                select(Vendor).where(Vendor.vendor_id == v_data["vendor_id"])
            )
            if not existing_v.scalar_one_or_none():
                session.add(Vendor(
                    vendor_id=v_data["vendor_id"],
                    vendor_name=v_data["vendor_name"],
                    rating=v_data["rating"],
                    delivery_speed=v_data["delivery_speed"],
                    pricing_model=v_data["pricing_model"],
                    inventory={},
                ))

        # Seed products — distribute across vendors
        vendor_ids = [v["vendor_id"] for v in _SEED_VENDORS]
        for i, p in enumerate(_SEED_PRODUCTS):
            # Assign to multiple vendors with price variation
            base_vendors = [vendor_ids[i % len(vendor_ids)], vendor_ids[(i + 3) % len(vendor_ids)]]
            for j, vid in enumerate(base_vendors):
                price_factor = 1.0 + (j * 0.05)  # 5% price variation between vendors
                session.add(Product(
                    product_id=f"prod-{uuid.uuid4().hex[:8]}",
                    vendor_id=vid,
                    name=p["name"],
                    category=p["category"],
                    price=round(p["price"] * price_factor, 2),
                    currency="INR",
                    specs=p.get("specs", {}),
                    stock=50 + (i * 7) % 200,
                    rating=p.get("rating", 4.0),
                ))

        await session.commit()

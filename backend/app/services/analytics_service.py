"""
Analytics Service — aggregated metrics for dashboard charts.

Provides real-time analytics by querying the database for
workflow success rates, agent usage, revenue, and more.
"""

from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any

from sqlalchemy import select, func, case, cast, Date
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.db import (
    async_session,
    WorkflowRun,
    Outcome,
    BillingLedgerEntry,
    AuditLog,
    Agent,
)


async def get_dashboard_analytics(user_id: str = None) -> Dict[str, Any]:
    """Get comprehensive dashboard analytics."""
    async with async_session() as session:
        now = datetime.now(timezone.utc)
        thirty_days_ago = now - timedelta(days=30)

        # Workflow stats
        wf_total = await session.execute(
            select(func.count()).select_from(WorkflowRun)
        )
        wf_completed = await session.execute(
            select(func.count()).select_from(WorkflowRun).where(
                WorkflowRun.status == "completed"
            )
        )
        wf_failed = await session.execute(
            select(func.count()).select_from(WorkflowRun).where(
                WorkflowRun.status == "failed"
            )
        )

        total = wf_total.scalar() or 0
        completed = wf_completed.scalar() or 0
        failed = wf_failed.scalar() or 0
        success_rate = round((completed / total * 100) if total > 0 else 0, 1)

        # Revenue
        total_revenue = await session.execute(
            select(func.sum(BillingLedgerEntry.fee))
        )
        total_savings = await session.execute(
            select(func.sum(BillingLedgerEntry.savings_value))
        )

        # Agent count
        agent_count = await session.execute(
            select(func.count()).select_from(Agent)
        )

        # Avg execution time
        avg_exec = await session.execute(
            select(func.avg(WorkflowRun.total_duration)).where(
                WorkflowRun.status == "completed"
            )
        )

        return {
            "total_workflows": total,
            "completed_workflows": completed,
            "failed_workflows": failed,
            "success_rate": success_rate,
            "total_revenue": round(total_revenue.scalar() or 0, 2),
            "total_savings": round(total_savings.scalar() or 0, 2),
            "active_agents": agent_count.scalar() or 0,
            "avg_execution_time": round(avg_exec.scalar() or 0, 2),
        }


async def get_daily_outcomes(days: int = 30) -> List[Dict[str, Any]]:
    """Get daily workflow outcomes for chart data."""
    async with async_session() as session:
        cutoff = datetime.now(timezone.utc) - timedelta(days=days)

        stmt = (
            select(
                cast(WorkflowRun.created_at, Date).label("date"),
                func.count().filter(WorkflowRun.status == "completed").label("successful"),
                func.count().filter(WorkflowRun.status == "failed").label("failed"),
            )
            .where(WorkflowRun.created_at >= cutoff)
            .group_by(cast(WorkflowRun.created_at, Date))
            .order_by(cast(WorkflowRun.created_at, Date))
        )

        result = await session.execute(stmt)
        rows = result.all()

        return [
            {
                "date": str(row.date),
                "successful": row.successful or 0,
                "failed": row.failed or 0,
            }
            for row in rows
        ]


async def get_revenue_over_time(days: int = 30) -> List[Dict[str, Any]]:
    """Get daily revenue for chart data."""
    async with async_session() as session:
        cutoff = datetime.now(timezone.utc) - timedelta(days=days)

        stmt = (
            select(
                cast(BillingLedgerEntry.created_at, Date).label("date"),
                func.sum(BillingLedgerEntry.fee).label("revenue"),
                func.sum(BillingLedgerEntry.savings_value).label("savings"),
            )
            .where(BillingLedgerEntry.created_at >= cutoff)
            .group_by(cast(BillingLedgerEntry.created_at, Date))
            .order_by(cast(BillingLedgerEntry.created_at, Date))
        )

        result = await session.execute(stmt)
        rows = result.all()

        return [
            {
                "date": str(row.date),
                "revenue": round(row.revenue or 0, 2),
                "savings": round(row.savings or 0, 2),
            }
            for row in rows
        ]


async def get_agent_usage() -> List[Dict[str, Any]]:
    """Get agent usage statistics."""
    async with async_session() as session:
        stmt = (
            select(
                AuditLog.agent,
                func.count().label("tasks"),
                func.count().filter(AuditLog.execution_status == "success").label("successes"),
            )
            .group_by(AuditLog.agent)
            .order_by(func.count().desc())
        )

        result = await session.execute(stmt)
        rows = result.all()

        return [
            {
                "agent": row.agent,
                "tasks": row.tasks or 0,
                "success_rate": round(
                    ((row.successes or 0) / row.tasks * 100) if row.tasks > 0 else 0, 1
                ),
            }
            for row in rows
        ]

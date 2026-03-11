"""
Workflow Service — CRUD for saved workflows and execution runs.

Manages workflow definitions created in the n8n-style builder
and tracks execution history.
"""

import uuid
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional

from sqlalchemy import select, update, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.db import async_session, SavedWorkflow, WorkflowRun


# ---------------------------------------------------------------------------
# Workflow CRUD
# ---------------------------------------------------------------------------

async def create_workflow(
    user_id: str,
    name: str,
    graph_json: Dict[str, Any],
    description: str = "",
) -> Dict[str, Any]:
    """Create a new workflow definition."""
    workflow_id = f"wf-{uuid.uuid4().hex[:12]}"

    async with async_session() as session:
        wf = SavedWorkflow(
            workflow_id=workflow_id,
            user_id=user_id,
            name=name,
            description=description,
            graph_json=graph_json,
            status="draft",
        )
        session.add(wf)
        await session.commit()

    return {
        "workflow_id": workflow_id,
        "name": name,
        "status": "draft",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }


async def get_workflow(workflow_id: str) -> Optional[Dict[str, Any]]:
    """Get a single workflow by ID."""
    async with async_session() as session:
        stmt = select(SavedWorkflow).where(SavedWorkflow.workflow_id == workflow_id)
        result = await session.execute(stmt)
        wf = result.scalar_one_or_none()
        if not wf:
            return None
        return {
            "workflow_id": wf.workflow_id,
            "user_id": wf.user_id,
            "name": wf.name,
            "description": wf.description,
            "graph_json": wf.graph_json,
            "status": wf.status,
            "version": wf.version,
            "last_run_at": wf.last_run_at.isoformat() if wf.last_run_at else None,
            "created_at": wf.created_at.isoformat(),
            "updated_at": wf.updated_at.isoformat(),
        }


async def list_workflows(user_id: str) -> List[Dict[str, Any]]:
    """List all workflows for a user."""
    async with async_session() as session:
        stmt = (
            select(SavedWorkflow)
            .where(SavedWorkflow.user_id == user_id)
            .order_by(SavedWorkflow.updated_at.desc())
        )
        result = await session.execute(stmt)
        rows = result.scalars().all()
        return [
            {
                "workflow_id": wf.workflow_id,
                "name": wf.name,
                "status": wf.status,
                "version": wf.version,
                "node_count": len((wf.graph_json or {}).get("nodes", [])),
                "last_run_at": wf.last_run_at.isoformat() if wf.last_run_at else None,
                "created_at": wf.created_at.isoformat(),
                "updated_at": wf.updated_at.isoformat(),
            }
            for wf in rows
        ]


async def update_workflow(
    workflow_id: str,
    user_id: str,
    name: Optional[str] = None,
    graph_json: Optional[Dict[str, Any]] = None,
    description: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    """Update an existing workflow."""
    async with async_session() as session:
        stmt = select(SavedWorkflow).where(
            SavedWorkflow.workflow_id == workflow_id,
            SavedWorkflow.user_id == user_id,
        )
        result = await session.execute(stmt)
        wf = result.scalar_one_or_none()
        if not wf:
            return None

        if name is not None:
            wf.name = name
        if graph_json is not None:
            wf.graph_json = graph_json
            wf.version += 1
        if description is not None:
            wf.description = description
        wf.updated_at = datetime.now(timezone.utc)

        await session.commit()
        return await get_workflow(workflow_id)


async def delete_workflow(workflow_id: str, user_id: str) -> bool:
    """Delete a workflow."""
    async with async_session() as session:
        stmt = select(SavedWorkflow).where(
            SavedWorkflow.workflow_id == workflow_id,
            SavedWorkflow.user_id == user_id,
        )
        result = await session.execute(stmt)
        wf = result.scalar_one_or_none()
        if not wf:
            return False
        await session.delete(wf)
        await session.commit()
        return True


# ---------------------------------------------------------------------------
# Workflow Runs
# ---------------------------------------------------------------------------

async def create_run(workflow_id: str, user_id: str) -> Dict[str, Any]:
    """Create a new workflow execution run."""
    run_id = f"run-{uuid.uuid4().hex[:12]}"

    async with async_session() as session:
        run = WorkflowRun(
            run_id=run_id,
            workflow_id=workflow_id,
            user_id=user_id,
            status="pending",
        )
        session.add(run)

        # Update workflow last_run_at
        wf_stmt = select(SavedWorkflow).where(SavedWorkflow.workflow_id == workflow_id)
        wf_result = await session.execute(wf_stmt)
        wf = wf_result.scalar_one_or_none()
        if wf:
            wf.last_run_at = datetime.now(timezone.utc)

        await session.commit()

    return {
        "run_id": run_id,
        "workflow_id": workflow_id,
        "status": "pending",
    }


async def update_run(
    run_id: str,
    status: Optional[str] = None,
    node_results: Optional[Dict[str, Any]] = None,
    error_message: Optional[str] = None,
) -> None:
    """Update a workflow run's status and results."""
    async with async_session() as session:
        stmt = select(WorkflowRun).where(WorkflowRun.run_id == run_id)
        result = await session.execute(stmt)
        run = result.scalar_one_or_none()
        if not run:
            return

        if status:
            run.status = status
            if status == "running" and not run.started_at:
                run.started_at = datetime.now(timezone.utc)
            elif status in ("completed", "failed"):
                run.completed_at = datetime.now(timezone.utc)
                if run.started_at:
                    run.total_duration = (run.completed_at - run.started_at).total_seconds()
        if node_results:
            run.node_results = node_results
        if error_message:
            run.error_message = error_message

        await session.commit()


async def get_run(run_id: str) -> Optional[Dict[str, Any]]:
    """Get a single workflow run."""
    async with async_session() as session:
        stmt = select(WorkflowRun).where(WorkflowRun.run_id == run_id)
        result = await session.execute(stmt)
        run = result.scalar_one_or_none()
        if not run:
            return None
        return {
            "run_id": run.run_id,
            "workflow_id": run.workflow_id,
            "user_id": run.user_id,
            "status": run.status,
            "node_results": run.node_results,
            "total_duration": run.total_duration,
            "error_message": run.error_message,
            "started_at": run.started_at.isoformat() if run.started_at else None,
            "completed_at": run.completed_at.isoformat() if run.completed_at else None,
        }


async def list_runs(
    user_id: Optional[str] = None,
    workflow_id: Optional[str] = None,
    limit: int = 20,
) -> List[Dict[str, Any]]:
    """List workflow runs with optional filters."""
    async with async_session() as session:
        stmt = select(WorkflowRun).order_by(WorkflowRun.created_at.desc()).limit(limit)
        if user_id:
            stmt = stmt.where(WorkflowRun.user_id == user_id)
        if workflow_id:
            stmt = stmt.where(WorkflowRun.workflow_id == workflow_id)
        result = await session.execute(stmt)
        runs = result.scalars().all()
        return [
            {
                "run_id": r.run_id,
                "workflow_id": r.workflow_id,
                "status": r.status,
                "total_duration": r.total_duration,
                "started_at": r.started_at.isoformat() if r.started_at else None,
                "completed_at": r.completed_at.isoformat() if r.completed_at else None,
            }
            for r in runs
        ]


# ---------------------------------------------------------------------------
# Analytics
# ---------------------------------------------------------------------------

async def get_workflow_analytics(user_id: str) -> Dict[str, Any]:
    """Get workflow execution analytics for a user."""
    async with async_session() as session:
        total_runs = await session.execute(
            select(func.count()).select_from(WorkflowRun).where(WorkflowRun.user_id == user_id)
        )
        completed = await session.execute(
            select(func.count()).select_from(WorkflowRun).where(
                WorkflowRun.user_id == user_id,
                WorkflowRun.status == "completed",
            )
        )
        failed = await session.execute(
            select(func.count()).select_from(WorkflowRun).where(
                WorkflowRun.user_id == user_id,
                WorkflowRun.status == "failed",
            )
        )
        avg_duration = await session.execute(
            select(func.avg(WorkflowRun.total_duration)).where(
                WorkflowRun.user_id == user_id,
                WorkflowRun.status == "completed",
            )
        )

        total = total_runs.scalar() or 0
        success = completed.scalar() or 0

        return {
            "total_runs": total,
            "completed": success,
            "failed": failed.scalar() or 0,
            "success_rate": round((success / total * 100) if total > 0 else 0, 1),
            "avg_duration": round(avg_duration.scalar() or 0, 2),
        }

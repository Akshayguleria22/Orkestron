#!/usr/bin/env python3
"""
Orkestron Demo Workflow — end-to-end walkthrough.

Demonstrates the full lifecycle:
  1. Authenticate → get JWT
  2. Submit a purchase task
  3. Show orchestration results (negotiation, compliance, execution)
  4. View outcome and billing
  5. Check agent capabilities

Usage:
    python scripts/demo_workflow.py
"""

import json
import sys

import httpx

BASE_URL = "http://localhost:8000"
USER_ID = "demo-user"
TENANT_ID = "tenant-demo"


def pretty(data: dict) -> str:
    return json.dumps(data, indent=2, default=str)


def main():
    client = httpx.Client(base_url=BASE_URL, timeout=30)

    print("=" * 70)
    print("  ORKESTRON — Demo Workflow")
    print("=" * 70)

    # ------------------------------------------------------------------
    # Step 1: Health check
    # ------------------------------------------------------------------
    print("\n[1/7] Health check...")
    resp = client.get("/health")
    if resp.status_code != 200:
        print(f"  ERROR: API not reachable at {BASE_URL}")
        sys.exit(1)
    print(f"  Status: {resp.json()['status']}")

    # ------------------------------------------------------------------
    # Step 2: Authenticate
    # ------------------------------------------------------------------
    print("\n[2/7] Authenticating...")
    resp = client.post("/auth/token", json={
        "user_id": USER_ID,
        "tenant_id": TENANT_ID,
        "roles": ["user"],
        "permissions": ["submit_task"],
    })
    token_data = resp.json()
    token = token_data["access_token"]
    print(f"  Token type: {token_data['token_type']}")
    print(f"  Token: {token[:40]}...")

    headers = {"Authorization": f"Bearer {token}"}

    # ------------------------------------------------------------------
    # Step 3: Submit purchase task
    # ------------------------------------------------------------------
    print("\n[3/7] Submitting purchase task...")
    print("  Input: 'buy 500 units of industrial steel'")
    resp = client.post("/task", json={
        "input": "buy 500 units of industrial steel",
    }, headers=headers)
    task_result = resp.json()
    print(f"  Status: {task_result['status']}")
    print(f"  Intent: {task_result['intent']}")
    print(f"  Agent path: {' → '.join(task_result['agent_path'])}")
    if task_result.get("vendor"):
        print(f"  Vendor: {task_result['vendor']}")
    if task_result.get("price"):
        print(f"  Price: ${task_result['price']:.2f}")
    if task_result.get("savings"):
        print(f"  Savings: ${task_result['savings']:.2f}")
    if task_result.get("transaction_id"):
        print(f"  Transaction ID: {task_result['transaction_id']}")
    if task_result.get("compliance_status"):
        print(f"  Compliance: {task_result['compliance_status']}")
    if task_result.get("proof_hash"):
        print(f"  Proof hash: {task_result['proof_hash'][:40]}...")

    # ------------------------------------------------------------------
    # Step 4: View outcomes
    # ------------------------------------------------------------------
    print("\n[4/7] Checking outcomes...")
    resp = client.get(f"/outcomes/{USER_ID}", headers=headers)
    outcomes = resp.json().get("outcomes", [])
    print(f"  Total outcomes: {len(outcomes)}")
    if outcomes:
        latest = outcomes[-1]
        print(f"  Latest: {latest.get('task_type', 'N/A')} — value: ${latest.get('value_generated', 0):.2f}")

    # ------------------------------------------------------------------
    # Step 5: View billing
    # ------------------------------------------------------------------
    print("\n[5/7] Checking billing ledger...")
    resp = client.get(f"/billing/ledger/{USER_ID}", headers=headers)
    ledger = resp.json().get("ledger", [])
    print(f"  Total entries: {len(ledger)}")
    if ledger:
        latest = ledger[-1]
        print(f"  Latest fee: ${latest.get('fee', 0):.4f} ({latest.get('pricing_model', 'N/A')})")

    # ------------------------------------------------------------------
    # Step 6: List agent capabilities
    # ------------------------------------------------------------------
    print("\n[6/7] Agent capabilities...")
    resp = client.get("/agents/capabilities")
    caps = resp.json().get("capabilities", [])
    print(f"  Published capabilities: {len(caps)}")
    for cap in caps[:5]:
        print(f"    - {cap.get('capability_name', 'N/A')} ({cap.get('agent_id', 'N/A')})")

    # ------------------------------------------------------------------
    # Step 7: Discover agent
    # ------------------------------------------------------------------
    print("\n[7/7] Agent discovery...")
    resp = client.get("/agents/discover", params={"capability": "price_negotiation"})
    if resp.status_code == 200:
        agent = resp.json()["agent"]
        print(f"  Found: {agent['agent_id']} (reputation: {agent.get('reputation', 'N/A')})")
    else:
        print(f"  No agent found (status {resp.status_code})")

    # ------------------------------------------------------------------
    # Metrics
    # ------------------------------------------------------------------
    print("\n" + "=" * 70)
    print("  Metrics snapshot")
    print("=" * 70)
    resp = client.get("/metrics")
    for line in resp.text.split("\n"):
        if line and not line.startswith("#"):
            # Show our custom metrics only
            if any(m in line for m in [
                "agent_tasks_total",
                "successful_outcomes_total",
                "billing_events_total",
                "cache_hits_total",
                "cache_misses_total",
            ]):
                print(f"  {line}")

    print("\n" + "=" * 70)
    print("  Demo complete!")
    print("=" * 70)

    client.close()


if __name__ == "__main__":
    main()

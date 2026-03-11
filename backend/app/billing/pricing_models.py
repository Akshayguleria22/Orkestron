"""
Pricing Models — fee calculation strategies for outcome-based billing.

Three pricing models:
  outcome_fee  — 2% of transaction value (for completed purchases)
  savings_fee  — 20% of savings achieved (budget - price)
  flat_fee     — ₹10 per billable action
"""

# Configurable rate constants
OUTCOME_FEE_RATE = 0.02     # 2 % of transaction value
SAVINGS_FEE_RATE = 0.20     # 20 % of savings
FLAT_FEE_AMOUNT = 10.0      # ₹10 per action

# Map task_type → default pricing model
_TASK_PRICING = {
    "purchase": "outcome_fee",
    "negotiation": "savings_fee",
    "information": "flat_fee",
    "compliance": "flat_fee",
    "execution": "flat_fee",
}


def default_model_for_task(task_type: str) -> str:
    """Return the default pricing model name for a task type."""
    return _TASK_PRICING.get(task_type, "flat_fee")


def calculate_outcome_fee(transaction_value: float) -> float:
    """2 % of the transaction value."""
    return round(max(transaction_value, 0.0) * OUTCOME_FEE_RATE, 2)


def calculate_savings_fee(savings: float) -> float:
    """20 % of the savings achieved."""
    return round(max(savings, 0.0) * SAVINGS_FEE_RATE, 2)


def calculate_flat_fee() -> float:
    """Fixed ₹10 per billable action."""
    return FLAT_FEE_AMOUNT


def calculate_fee(
    pricing_model: str,
    transaction_value: float = 0.0,
    savings: float = 0.0,
) -> float:
    """
    Dispatch to the correct fee calculator based on pricing_model.
    Returns the fee amount in INR.
    """
    if pricing_model == "outcome_fee":
        return calculate_outcome_fee(transaction_value)
    if pricing_model == "savings_fee":
        return calculate_savings_fee(savings)
    return calculate_flat_fee()

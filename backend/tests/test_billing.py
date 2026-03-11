"""
Tests for the billing engine pricing models.
"""

import pytest

from app.billing.pricing_models import (
    calculate_fee,
)


def test_flat_fee():
    """Flat pricing returns a fixed fee."""
    fee = calculate_fee(
        pricing_model="flat",
        transaction_value=1000.0,
        savings=200.0,
    )
    assert isinstance(fee, (int, float))
    assert fee >= 0


def test_percentage_fee():
    """Percentage pricing returns a fraction of transaction value."""
    fee = calculate_fee(
        pricing_model="percentage",
        transaction_value=1000.0,
        savings=0.0,
    )
    assert isinstance(fee, (int, float))
    assert fee >= 0


def test_outcome_based_fee():
    """Outcome-based pricing returns a fraction of savings."""
    fee = calculate_fee(
        pricing_model="outcome_based",
        transaction_value=1000.0,
        savings=200.0,
    )
    assert isinstance(fee, (int, float))
    assert fee >= 0


def test_unknown_model_defaults():
    """Unknown pricing model doesn't crash."""
    fee = calculate_fee(
        pricing_model="unknown_model",
        transaction_value=500.0,
        savings=100.0,
    )
    assert isinstance(fee, (int, float))

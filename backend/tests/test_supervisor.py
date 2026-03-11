"""
Tests for the supervisor intent classification.
"""

from app.agents.supervisor import _classify_intent_keywords


def test_purchase_keywords():
    """Purchase-related keywords map to 'purchase' intent."""
    assert _classify_intent_keywords("I want to buy steel") == "purchase"
    assert _classify_intent_keywords("purchase 100 units") == "purchase"
    assert _classify_intent_keywords("order supplies") == "purchase"
    assert _classify_intent_keywords("procure materials") == "purchase"


def test_information_keywords():
    """Information-related keywords map to 'information' intent."""
    assert _classify_intent_keywords("find suppliers") == "information"
    assert _classify_intent_keywords("search for vendors") == "information"
    assert _classify_intent_keywords("what is the price?") == "information"
    assert _classify_intent_keywords("how to use this?") == "information"


def test_negotiation_keywords():
    """Negotiation keywords map to 'negotiation' intent."""
    assert _classify_intent_keywords("negotiate a better price") == "negotiation"
    assert _classify_intent_keywords("make a deal") == "negotiation"
    assert _classify_intent_keywords("counter offer") == "negotiation"


def test_compliance_keywords():
    """Compliance keywords map to 'compliance' intent."""
    assert _classify_intent_keywords("check compliance") == "compliance"
    assert _classify_intent_keywords("policy review") == "compliance"
    assert _classify_intent_keywords("regulation check") == "compliance"


def test_execution_keywords():
    """Execution keywords map to 'execution' intent."""
    assert _classify_intent_keywords("execute the plan") == "execution"
    assert _classify_intent_keywords("run the deployment") == "execution"
    assert _classify_intent_keywords("deploy now") == "execution"


def test_unknown_defaults_to_execution():
    """Unknown input defaults to 'execution'."""
    assert _classify_intent_keywords("asdfghjkl random text") == "execution"

"""
Tests for the plugin loader module.
"""

import json
import os
import tempfile

import pytest

from app.agents.plugin_loader import (
    PluginValidationError,
    validate_manifest,
    load_manifest,
    get_plugin,
    list_plugins,
)


def test_validate_manifest_valid():
    """Valid manifest passes validation."""
    manifest = {
        "agent_name": "test-agent",
        "capabilities": ["skill_a", "skill_b"],
    }
    validate_manifest(manifest)  # should not raise


def test_validate_manifest_missing_name():
    """Missing agent_name raises PluginValidationError."""
    manifest = {"capabilities": ["skill_a"]}
    with pytest.raises(PluginValidationError):
        validate_manifest(manifest)


def test_validate_manifest_missing_capabilities():
    """Missing capabilities raises PluginValidationError."""
    manifest = {"agent_name": "test-agent"}
    with pytest.raises(PluginValidationError):
        validate_manifest(manifest)


def test_validate_manifest_empty_capabilities():
    """Empty capabilities list raises PluginValidationError."""
    manifest = {"agent_name": "test-agent", "capabilities": []}
    with pytest.raises(PluginValidationError):
        validate_manifest(manifest)


def test_load_manifest_from_file():
    """load_manifest reads and parses a manifest.json file."""
    manifest_data = {
        "agent_name": "file-test-agent",
        "capabilities": ["read", "write"],
        "version": "1.0.0",
    }
    with tempfile.TemporaryDirectory() as tmpdir:
        manifest_path = os.path.join(tmpdir, "manifest.json")
        with open(manifest_path, "w") as f:
            json.dump(manifest_data, f)

        result = load_manifest(tmpdir)
        assert result["agent_name"] == "file-test-agent"
        assert result["capabilities"] == ["read", "write"]


def test_load_manifest_missing_file():
    """load_manifest raises for missing manifest."""
    with tempfile.TemporaryDirectory() as tmpdir:
        with pytest.raises((FileNotFoundError, PluginValidationError)):
            load_manifest(tmpdir)


def test_get_plugin_unknown():
    """get_plugin returns None for unknown plugin names."""
    result = get_plugin("nonexistent-plugin-xyz")
    assert result is None


def test_list_plugins_returns_collection():
    """list_plugins returns a collection."""
    result = list_plugins()
    assert isinstance(result, (dict, list))

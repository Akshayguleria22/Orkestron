"""
Plugin Loader — loads and validates third-party agent plugins.

Phase 6: Plugins are self-contained agent packages defined by a
manifest.json file. The loader validates the manifest schema,
registers the plugin's declared capabilities, and provides a
runtime entry point for plugin execution.

Plugin directory structure:
    plugins/
        <plugin_name>/
            manifest.json
            agent.py          (must export an `execute` async function)

Manifest schema:
    {
        "agent_name": str,          # unique agent identifier
        "capabilities": [str],      # list of capability names
        "endpoint": str,            # API endpoint path (optional)
        "version": str,             # semver version string
        "auth_requirements": [str]  # required auth scopes
    }
"""

import importlib
import json
import logging
import os
from pathlib import Path
from typing import Any, Dict, List, Optional

log = logging.getLogger(__name__)

_REQUIRED_MANIFEST_FIELDS = {"agent_name", "capabilities"}
_OPTIONAL_MANIFEST_FIELDS = {"endpoint", "version", "auth_requirements"}

# In-memory registry of loaded plugins (agent_name → plugin metadata)
_loaded_plugins: Dict[str, Dict[str, Any]] = {}


class PluginValidationError(Exception):
    """Raised when a plugin manifest fails validation."""


def validate_manifest(manifest: Dict[str, Any]) -> None:
    """
    Validate a plugin manifest dict against the required schema.
    Raises PluginValidationError on any violation.
    """
    missing = _REQUIRED_MANIFEST_FIELDS - set(manifest.keys())
    if missing:
        raise PluginValidationError(f"Missing required fields: {missing}")

    if not isinstance(manifest.get("agent_name"), str) or not manifest["agent_name"].strip():
        raise PluginValidationError("agent_name must be a non-empty string")

    caps = manifest.get("capabilities")
    if not isinstance(caps, list) or not caps:
        raise PluginValidationError("capabilities must be a non-empty list of strings")
    if not all(isinstance(c, str) and c.strip() for c in caps):
        raise PluginValidationError("All capabilities must be non-empty strings")

    if "endpoint" in manifest and not isinstance(manifest["endpoint"], str):
        raise PluginValidationError("endpoint must be a string")

    if "version" in manifest and not isinstance(manifest["version"], str):
        raise PluginValidationError("version must be a string")

    auth_reqs = manifest.get("auth_requirements")
    if auth_reqs is not None:
        if not isinstance(auth_reqs, list):
            raise PluginValidationError("auth_requirements must be a list of strings")


def load_manifest(plugin_dir: str) -> Dict[str, Any]:
    """
    Read and validate manifest.json from a plugin directory.
    Returns the parsed manifest dict.
    """
    manifest_path = os.path.join(plugin_dir, "manifest.json")
    if not os.path.isfile(manifest_path):
        raise PluginValidationError(f"No manifest.json found in {plugin_dir}")

    with open(manifest_path, "r", encoding="utf-8") as f:
        manifest = json.load(f)

    validate_manifest(manifest)
    return manifest


def load_plugin(plugin_dir: str) -> Dict[str, Any]:
    """
    Load a single plugin from a directory.
    Validates manifest, imports the agent module, and caches plugin metadata.

    Returns plugin metadata dict.
    """
    manifest = load_manifest(plugin_dir)
    agent_name = manifest["agent_name"]

    # Try to import agent.py from the plugin directory
    agent_module_path = os.path.join(plugin_dir, "agent.py")
    agent_module = None

    if os.path.isfile(agent_module_path):
        spec = importlib.util.spec_from_file_location(
            f"plugin_{agent_name}", agent_module_path
        )
        if spec and spec.loader:
            agent_module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(agent_module)

            if not hasattr(agent_module, "execute"):
                raise PluginValidationError(
                    f"Plugin '{agent_name}' agent.py must export an 'execute' function"
                )

    plugin_meta = {
        "agent_name": agent_name,
        "capabilities": manifest["capabilities"],
        "endpoint": manifest.get("endpoint"),
        "version": manifest.get("version", "1.0.0"),
        "auth_requirements": manifest.get("auth_requirements", []),
        "plugin_dir": plugin_dir,
        "module": agent_module,
    }

    _loaded_plugins[agent_name] = plugin_meta
    log.info("Loaded plugin '%s' with capabilities %s", agent_name, manifest["capabilities"])
    return plugin_meta


def load_all_plugins(plugins_root: str) -> List[Dict[str, Any]]:
    """
    Scan a plugins root directory and load every valid plugin.
    Each subdirectory with a manifest.json is treated as a plugin.
    Returns a list of plugin metadata dicts.
    """
    plugins_path = Path(plugins_root)
    loaded: List[Dict[str, Any]] = []

    if not plugins_path.is_dir():
        log.debug("Plugins directory '%s' does not exist, skipping", plugins_root)
        return loaded

    for child in sorted(plugins_path.iterdir()):
        if not child.is_dir():
            continue
        try:
            meta = load_plugin(str(child))
            loaded.append(meta)
        except (PluginValidationError, json.JSONDecodeError) as exc:
            log.warning("Skipping invalid plugin '%s': %s", child.name, exc)
        except Exception as exc:
            log.error("Failed to load plugin '%s': %s", child.name, exc)

    log.info("Loaded %d plugins from '%s'", len(loaded), plugins_root)
    return loaded


def get_plugin(agent_name: str) -> Optional[Dict[str, Any]]:
    """Return the loaded plugin metadata for an agent, or None."""
    return _loaded_plugins.get(agent_name)


def list_plugins() -> List[Dict[str, Any]]:
    """Return all loaded plugins (without module references for serialization)."""
    return [
        {k: v for k, v in p.items() if k != "module"}
        for p in _loaded_plugins.values()
    ]


async def execute_plugin(
    agent_name: str,
    input_data: Dict[str, Any],
    user_id: str,
    tenant_id: str,
    delegation_token: str = "",
) -> Dict[str, Any]:
    """
    Execute a loaded plugin's agent.
    Calls the plugin's execute() function with the standard interface.

    Returns the plugin's result dict.
    """
    plugin = _loaded_plugins.get(agent_name)
    if plugin is None:
        raise PluginValidationError(f"Plugin '{agent_name}' is not loaded")

    module = plugin.get("module")
    if module is None:
        raise PluginValidationError(f"Plugin '{agent_name}' has no executable module")

    execute_fn = getattr(module, "execute", None)
    if execute_fn is None:
        raise PluginValidationError(f"Plugin '{agent_name}' module has no 'execute' function")

    import asyncio
    if asyncio.iscoroutinefunction(execute_fn):
        result = await execute_fn(
            input_data=input_data,
            user_id=user_id,
            tenant_id=tenant_id,
            delegation_token=delegation_token,
        )
    else:
        result = execute_fn(
            input_data=input_data,
            user_id=user_id,
            tenant_id=tenant_id,
            delegation_token=delegation_token,
        )

    return result

"""Convert various network representations to JSON for the visualizer."""
import json


def normalize_to_json(net_or_data) -> str:
    """Normalize any supported input to a pandapower JSON string.

    Accepts:
        - A pandapower ``pandapowerNet`` object (calls ``pp.to_json()``)
        - A JSON string (returned as-is after validation)
        - A dict (serialized to JSON string)

    This makes pandapower an optional dependency — callers can pass
    pre-serialized JSON without importing pandapower.
    """
    # Already a JSON string
    if isinstance(net_or_data, str):
        json.loads(net_or_data)  # validate
        return net_or_data

    # Try pandapower net first (pandapowerNet subclasses dict, so check before dict)
    try:
        import pandapower as pp
        if isinstance(net_or_data, pp.pandapowerNet):
            return pp.to_json(net_or_data)
    except ImportError:
        pass

    # A plain dict — serialize to JSON
    if isinstance(net_or_data, dict):
        return json.dumps(net_or_data)

    # Unknown type — try pandapower as last resort
    try:
        import pandapower as pp
        return pp.to_json(net_or_data)
    except ImportError:
        raise TypeError(
            f"Cannot visualize object of type {type(net_or_data).__name__}. "
            "Pass a pandapower network, a JSON string, or a dict."
        )


# Keep backwards-compatible aliases
def net_to_json(net) -> str:
    """Serialize a pandapower network to JSON string."""
    return normalize_to_json(net)


def net_to_dict(net) -> dict:
    """Serialize a pandapower network to a Python dict."""
    return json.loads(normalize_to_json(net))

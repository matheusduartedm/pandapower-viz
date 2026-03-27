"""Convert pandapower network to JSON for the visualizer."""
import json


def net_to_json(net) -> str:
    """Serialize a pandapower network to JSON string.

    Uses pandapower's built-in to_json() which produces the DataFrame
    format that the frontend parser expects.
    """
    import pandapower as pp
    return pp.to_json(net)


def net_to_dict(net) -> dict:
    """Serialize a pandapower network to a Python dict."""
    return json.loads(net_to_json(net))

"""Jupyter widget for inline pandapower network visualization."""
from pathlib import Path

import anywidget
import traitlets

_STATIC_DIR = Path(__file__).parent / "_static"


class NetworkWidget(anywidget.AnyWidget):
    """Interactive pandapower network diagram rendered inline in Jupyter.

    Usage::

        from pandapower_viz import NetworkWidget
        import pandapower as pp

        net = pp.networks.case_ieee30()
        pp.runpp(net)

        w = NetworkWidget.from_data(net)
        w  # displays in notebook cell

    You can also pass pre-serialized JSON (no pandapower import needed)::

        w = NetworkWidget.from_data('{"bus": {...}, "line": {...}}')
    """

    _esm = _STATIC_DIR / "widget.js"

    network_json = traitlets.Unicode("").tag(sync=True)

    @classmethod
    def from_data(cls, net_or_data) -> "NetworkWidget":
        """Create a widget from a network object, JSON string, or dict."""
        from .adapter import normalize_to_json

        return cls(network_json=normalize_to_json(net_or_data))

    @classmethod
    def from_net(cls, net) -> "NetworkWidget":
        """Create a widget from a pandapower network. Alias for from_data()."""
        return cls.from_data(net)

    def update(self, net_or_data) -> None:
        """Update the displayed network (re-renders the diagram).

        Accepts a pandapower net, JSON string, or dict.
        """
        from .adapter import normalize_to_json

        self.network_json = normalize_to_json(net_or_data)

    def update_network(self, net) -> None:
        """Update the displayed network. Alias for update()."""
        self.update(net)

"""Jupyter widget for inline pandapower network visualization."""
from pathlib import Path

import anywidget
import traitlets

_STATIC_DIR = Path(__file__).parent / "_static"


class NetworkWidget(anywidget.AnyWidget):
    """Interactive pandapower network diagram rendered inline in Jupyter.

    Usage::

        from pandapower_viz.widget import NetworkWidget
        import pandapower as pp

        net = pp.networks.case_ieee30()
        pp.runpp(net)

        w = NetworkWidget.from_net(net)
        w  # displays in notebook cell
    """

    _esm = _STATIC_DIR / "widget.js"

    network_json = traitlets.Unicode("").tag(sync=True)

    @classmethod
    def from_net(cls, net) -> "NetworkWidget":
        """Create a widget from a pandapower network."""
        from .adapter import net_to_json

        return cls(network_json=net_to_json(net))

    def update_network(self, net) -> None:
        """Update the displayed network (re-renders the diagram)."""
        from .adapter import net_to_json

        self.network_json = net_to_json(net)

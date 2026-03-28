"""pandapower-viz: Interactive web visualizer for pandapower networks."""

from .api import show

__version__ = "0.1.0"
__all__ = ["show", "NetworkWidget"]


def __getattr__(name: str):
    if name == "NetworkWidget":
        from .widget import NetworkWidget
        return NetworkWidget
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")

"""Tests for the Jupyter widget."""
import json
import pytest


def test_widget_creation():
    """Widget can be created from a pandapower network."""
    import pandapower as pp
    from pandapower_viz.widget import NetworkWidget

    net = pp.networks.case_ieee30()
    pp.runpp(net)

    w = NetworkWidget.from_net(net)
    assert isinstance(w, NetworkWidget)
    assert len(w.network_json) > 0

    # Verify it's valid JSON with expected structure
    data = json.loads(w.network_json)
    assert "bus" in data or "_object" in data


def test_widget_update():
    """Widget can be updated with a new network."""
    import pandapower as pp
    from pandapower_viz.widget import NetworkWidget

    net = pp.networks.case_ieee30()
    w = NetworkWidget.from_net(net)
    original_json = w.network_json

    # Run power flow and update
    pp.runpp(net)
    w.update_network(net)
    assert w.network_json != original_json  # JSON changes after power flow


def test_adapter_serialization():
    """Adapter produces valid JSON from pandapower network."""
    import pandapower as pp
    from pandapower_viz.adapter import net_to_json, net_to_dict

    net = pp.networks.case_ieee30()
    pp.runpp(net)

    json_str = net_to_json(net)
    assert isinstance(json_str, str)
    assert len(json_str) > 0

    d = net_to_dict(net)
    assert isinstance(d, dict)


def test_show_returns_widget_in_jupyter_mock(monkeypatch):
    """show() returns a widget when Jupyter is detected."""
    import pandapower as pp
    from pandapower_viz import api

    # Mock _is_jupyter to return True
    monkeypatch.setattr(api, "_is_jupyter", lambda: True)

    net = pp.networks.case_ieee30()
    result = api.show(net)

    from pandapower_viz.widget import NetworkWidget
    assert isinstance(result, NetworkWidget)


def test_is_jupyter_returns_false_in_terminal():
    """_is_jupyter returns False when not in a notebook."""
    from pandapower_viz.api import _is_jupyter
    assert _is_jupyter() is False

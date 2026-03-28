"""Tests for the Jupyter widget and adapter."""
import json


def test_widget_from_pandapower_net():
    """Widget can be created from a pandapower network object."""
    import pandapower as pp
    from pandapower_viz.widget import NetworkWidget

    net = pp.networks.case_ieee30()
    pp.runpp(net)

    w = NetworkWidget.from_net(net)
    assert isinstance(w, NetworkWidget)
    assert len(w.network_json) > 0
    data = json.loads(w.network_json)
    assert "bus" in data or "_object" in data


def test_widget_from_json_string():
    """Widget can be created from a JSON string (no pandapower needed)."""
    import pandapower as pp
    from pandapower_viz.widget import NetworkWidget

    net = pp.networks.case_ieee30()
    json_str = pp.to_json(net)

    w = NetworkWidget.from_data(json_str)
    assert isinstance(w, NetworkWidget)
    assert len(w.network_json) > 0


def test_widget_from_dict():
    """Widget can be created from a dict."""
    import pandapower as pp
    from pandapower_viz.widget import NetworkWidget

    net = pp.networks.case_ieee30()
    data = json.loads(pp.to_json(net))

    w = NetworkWidget.from_data(data)
    assert isinstance(w, NetworkWidget)
    assert len(w.network_json) > 0


def test_widget_update():
    """Widget can be updated with a new network."""
    import pandapower as pp
    from pandapower_viz.widget import NetworkWidget

    net = pp.networks.case_ieee30()
    w = NetworkWidget.from_net(net)
    original_json = w.network_json

    pp.runpp(net)
    w.update(net)
    assert w.network_json != original_json


def test_widget_update_with_json_string():
    """Widget can be updated with a JSON string."""
    import pandapower as pp
    from pandapower_viz.widget import NetworkWidget

    net = pp.networks.case_ieee30()
    w = NetworkWidget.from_net(net)

    pp.runpp(net)
    w.update(pp.to_json(net))
    assert len(w.network_json) > 0


def test_adapter_normalize_pandapower_net():
    """Adapter normalizes a pandapower net to JSON string."""
    import pandapower as pp
    from pandapower_viz.adapter import normalize_to_json

    net = pp.networks.case_ieee30()
    pp.runpp(net)

    result = normalize_to_json(net)
    assert isinstance(result, str)
    json.loads(result)  # valid JSON


def test_adapter_normalize_json_string():
    """Adapter passes through a valid JSON string."""
    from pandapower_viz.adapter import normalize_to_json

    data = '{"bus": {}, "line": {}}'
    result = normalize_to_json(data)
    assert result == data


def test_adapter_normalize_dict():
    """Adapter serializes a dict to JSON string."""
    from pandapower_viz.adapter import normalize_to_json

    data = {"bus": {}, "line": {}}
    result = normalize_to_json(data)
    assert isinstance(result, str)
    assert json.loads(result) == data


def test_adapter_invalid_json_string_raises():
    """Adapter raises on invalid JSON string."""
    from pandapower_viz.adapter import normalize_to_json
    import pytest

    with pytest.raises(json.JSONDecodeError):
        normalize_to_json("not valid json {{{")


def test_backwards_compat_aliases():
    """net_to_json and net_to_dict still work."""
    import pandapower as pp
    from pandapower_viz.adapter import net_to_json, net_to_dict

    net = pp.networks.case_ieee30()
    assert isinstance(net_to_json(net), str)
    assert isinstance(net_to_dict(net), dict)


def test_show_returns_widget_in_jupyter_mock(monkeypatch):
    """show() returns a widget when Jupyter is detected."""
    import pandapower as pp
    from pandapower_viz import api

    monkeypatch.setattr(api, "_is_jupyter", lambda: True)
    net = pp.networks.case_ieee30()
    result = api.show(net)

    from pandapower_viz.widget import NetworkWidget
    assert isinstance(result, NetworkWidget)


def test_show_with_json_string_in_jupyter(monkeypatch):
    """show() works with a JSON string in Jupyter mode."""
    import pandapower as pp
    from pandapower_viz import api

    monkeypatch.setattr(api, "_is_jupyter", lambda: True)
    json_str = pp.to_json(pp.networks.case_ieee30())
    result = api.show(json_str)

    from pandapower_viz.widget import NetworkWidget
    assert isinstance(result, NetworkWidget)


def test_is_jupyter_returns_false_in_terminal():
    """_is_jupyter returns False when not in a notebook."""
    from pandapower_viz.api import _is_jupyter
    assert _is_jupyter() is False

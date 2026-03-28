"""Public API for pandapower-viz."""
import threading
import webbrowser


def _is_jupyter() -> bool:
    """Detect if running inside a Jupyter notebook/lab."""
    try:
        from IPython import get_ipython

        shell = get_ipython().__class__.__name__
        return shell in ("ZMQInteractiveShell", "Shell")
    except (ImportError, AttributeError, NameError):
        return False


def show(
    net,
    port: int = 8050,
    open_browser: bool = True,
):
    """Visualize a pandapower network.

    Auto-detects the environment:
    - **Jupyter notebook**: renders inline in the cell (returns a widget).
    - **Terminal/script**: starts a local web server and opens the browser.

    Args:
        net: A pandapower network (with or without power flow results).
        port: Port for the local server (default: 8050). Ignored in Jupyter.
        open_browser: Whether to auto-open the browser. Ignored in Jupyter.

    Returns:
        In Jupyter: a NetworkWidget (display it by making it the last expression).
        In terminal: None (blocks until Ctrl+C).
    """
    if _is_jupyter():
        from .widget import NetworkWidget

        return NetworkWidget.from_net(net)

    _show_server(net, port, open_browser)


def _show_server(net, port: int, open_browser: bool) -> None:
    """Start a local FastAPI server to visualize the network."""
    from .adapter import net_to_json
    from .server import app, set_network

    network_json = net_to_json(net)
    set_network(network_json)

    if open_browser:
        threading.Timer(1.5, lambda: webbrowser.open(f"http://localhost:{port}")).start()

    print(f"pandapower-viz running at http://localhost:{port}")
    print("Press Ctrl+C to stop.")

    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=port, log_level="warning")

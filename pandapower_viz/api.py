"""Public API for pandapower-viz."""
import threading
import webbrowser


def show(
    net,
    port: int = 8050,
    open_browser: bool = True,
) -> None:
    """Visualize a pandapower network in the browser.

    Starts a local web server and opens the visualization.
    Press Ctrl+C to stop.

    Args:
        net: A pandapower network (with or without power flow results).
        port: Port for the local server (default: 8050).
        open_browser: Whether to auto-open the browser.
    """
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

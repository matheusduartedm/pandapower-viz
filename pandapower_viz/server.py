"""Local web server for the pandapower-viz frontend."""
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

app = FastAPI(title="pandapower-viz")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global state: the network JSON to serve
_network_json: str | None = None

STATIC_DIR = Path(__file__).parent / "_static"


def set_network(network_json: str) -> None:
    """Set the network data to serve via the API."""
    global _network_json
    _network_json = network_json


@app.get("/api/network")
def get_network():
    """Return the loaded network as JSON."""
    if _network_json is None:
        return JSONResponse({"error": "No network loaded"}, status_code=404)
    return JSONResponse(content=json.loads(_network_json))


# Serve frontend static files (built Vite app)
if STATIC_DIR.exists() and (STATIC_DIR / "index.html").exists():
    # Serve assets with proper MIME types
    if (STATIC_DIR / "assets").exists():
        app.mount("/assets", StaticFiles(directory=STATIC_DIR / "assets"), name="assets")

    @app.get("/{path:path}")
    def serve_frontend(path: str = ""):
        """Serve the SPA — all routes return index.html."""
        file_path = STATIC_DIR / path
        if file_path.is_file() and file_path.suffix in {".js", ".css", ".ico", ".svg", ".png"}:
            return FileResponse(file_path)
        return FileResponse(STATIC_DIR / "index.html")


import json  # noqa: E402 — needed for get_network

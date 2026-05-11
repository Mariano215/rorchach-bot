#!/usr/bin/env python3
"""
Local dev proxy — serves the app AND proxies AI endpoints with CORS headers.
Usage: python3 proxy.py
Then open: http://localhost:8080/Inkblot%20Agent.html
"""

import http.server, urllib.request, urllib.error, os, sys

WIN_IP   = "100.120.203.53"
ROUTES   = {
    "/whisper/":     f"http://{WIN_IP}:8010/",
    "/chatterbox/":  f"http://{WIN_IP}:8095/",
    "/ollama/":      f"http://{WIN_IP}:11434/",
}
PORT = 8080

CORS = {
    "Access-Control-Allow-Origin":  "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

class Handler(http.server.SimpleHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(204)
        for k, v in CORS.items():
            self.send_header(k, v)
        self.end_headers()

    def _proxy(self):
        for prefix, upstream in ROUTES.items():
            if self.path.startswith(prefix):
                target = upstream + self.path[len(prefix):]
                length = int(self.headers.get("Content-Length", 0))
                body   = self.rfile.read(length) if length else None
                req    = urllib.request.Request(
                    target, data=body, method=self.command,
                    headers={k: v for k, v in self.headers.items()
                             if k.lower() not in ("host", "content-length")},
                )
                try:
                    with urllib.request.urlopen(req, timeout=30) as r:
                        data = r.read()
                        self.send_response(r.status)
                        for k, v in CORS.items():
                            self.send_header(k, v)
                        ct = r.headers.get("Content-Type", "application/octet-stream")
                        self.send_header("Content-Type", ct)
                        self.send_header("Content-Length", str(len(data)))
                        self.end_headers()
                        self.wfile.write(data)
                except urllib.error.HTTPError as e:
                    data = e.read()
                    self.send_response(e.code)
                    for k, v in CORS.items():
                        self.send_header(k, v)
                    self.send_header("Content-Length", str(len(data)))
                    self.end_headers()
                    self.wfile.write(data)
                except Exception as e:
                    msg = str(e).encode()
                    self.send_response(502)
                    for k, v in CORS.items():
                        self.send_header(k, v)
                    self.send_header("Content-Length", str(len(msg)))
                    self.end_headers()
                    self.wfile.write(msg)
                return True
        return False

    def do_GET(self):
        if not self._proxy():
            super().do_GET()

    def do_POST(self):
        if not self._proxy():
            self.send_response(404)
            self.end_headers()

    def log_message(self, fmt, *args):
        prefix = "[PROXY]" if any(self.path.startswith(p) for p in ROUTES) else "[FILE ]"
        print(f"{prefix} {self.address_string()} {fmt % args}")

os.chdir(os.path.dirname(os.path.abspath(__file__)))
print(f"Serving on http://localhost:{PORT}")
for p, u in ROUTES.items():
    print(f"  {p}  →  {u}")
http.server.HTTPServer(("", PORT), Handler).serve_forever()

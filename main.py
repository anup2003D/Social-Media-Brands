import http.server
import socketserver
import webbrowser
import socket
import os

HOST = "localhost"
PREFERRED_PORT = 8080

def find_free_port(start=PREFERRED_PORT):
    """Try ports starting from `start` until one is free."""
    for port in range(start, start + 20):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            if s.connect_ex((HOST, port)) != 0:   # port is free
                return port
    raise RuntimeError("No free port found between 8080–8099.")

class QuietHandler(http.server.SimpleHTTPRequestHandler):
    """Suppress the per-request log lines in the terminal."""
    def log_message(self, format, *args):
        pass   # comment this out if you want to see request logs

def start():
    os.chdir(os.path.dirname(os.path.abspath(__file__)))

    port = find_free_port()

    # Allow reuse so restarting quickly doesn't cause "address in use" errors
    socketserver.TCPServer.allow_reuse_address = True

    with socketserver.TCPServer((HOST, port), QuietHandler) as httpd:
        url = f"http://{HOST}:{port}/index.html"
        print(f"\n✅  ColabMap is running!")
        print(f"🌐  Open this in your browser → {url}")
        print(f"🛑  Press Ctrl+C to stop the server.\n")
        webbrowser.open(url)
        httpd.serve_forever()

if __name__ == "__main__":
    start()


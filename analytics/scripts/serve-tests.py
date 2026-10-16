"""Static fixture server with room for concurrent pages and SW precaching."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from functools import partial


class TestServer(ThreadingHTTPServer):
    request_queue_size = 128


class Handler(SimpleHTTPRequestHandler):
    def handle(self):
        try:
            super().handle()
        except (BrokenPipeError, ConnectionResetError):
            # Closing a fixture tab may cancel its image/font requests.
            pass


if __name__ == "__main__":
    root = Path(__file__).resolve().parents[2]
    TestServer(("127.0.0.1", 4173), partial(Handler, directory=str(root))).serve_forever()

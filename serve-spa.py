#!/usr/bin/env python3
import http.server
import os
import sys

PORT = 10112
DIRECTORY = sys.argv[1] if len(sys.argv) > 1 else os.getcwd()

class SPAHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def do_GET(self):
        path = self.translate_path(self.path.split('?')[0])
        if os.path.isfile(path):
            super().do_GET()
        else:
            _, ext = os.path.splitext(path)
            if ext and ext != '.html':
                self.send_error(404)
            else:
                self.path = '/index.html'
                super().do_GET()

    def log_message(self, fmt, *args):
        print(f'{self.address_string()} - {fmt % args}')

if __name__ == '__main__':
    os.chdir(DIRECTORY)
    print(f'Serving {DIRECTORY} on http://0.0.0.0:{PORT}')
    with http.server.HTTPServer(('', PORT), SPAHandler) as httpd:
        httpd.serve_forever()

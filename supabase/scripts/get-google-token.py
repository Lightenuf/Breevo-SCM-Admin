#!/usr/bin/env python3
"""
scm@lightenuf.com 계정의 승인을 받아 '갱신 토큰'을 저장합니다.

한 번만 실행하면 됩니다. 이 토큰을 Supabase에 넣어두면
앞으로 어드민이 메일을 보낼 때마다 자동으로 인증됩니다.

사용법:  python3 get-google-token.py
"""

import json
import os
import urllib.parse
import urllib.request
import webbrowser
from http.server import BaseHTTPRequestHandler, HTTPServer

SECRET_DIR = os.path.expanduser('~/.breevo-secrets')
CLIENT_FILE = os.path.join(SECRET_DIR, 'google-oauth-client.json')
TOKEN_FILE = os.path.join(SECRET_DIR, 'google-refresh-token.json')

REDIRECT = 'http://localhost:4455'
SCOPES = (
    'https://www.googleapis.com/auth/gmail.send '
    'https://www.googleapis.com/auth/drive.file'
)

received = {}


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        query = urllib.parse.urlparse(self.path).query
        params = urllib.parse.parse_qs(query)

        received['code'] = params.get('code', [None])[0]
        received['error'] = params.get('error', [None])[0]

        self.send_response(200)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.end_headers()

        if received['code']:
            msg = '승인이 완료되었습니다. 이 창을 닫고 터미널로 돌아가세요.'
        else:
            msg = '승인이 취소되었거나 실패했습니다. 터미널을 확인해주세요.'

        self.wfile.write(f'''
            <html><head><meta charset="utf-8"></head>
            <body style="font-family:-apple-system,sans-serif;
                         display:grid;place-items:center;height:100vh;margin:0">
              <div style="text-align:center">
                <h2 style="font-weight:700">{msg}</h2>
              </div>
            </body></html>
        '''.encode('utf-8'))

    def log_message(self, *args):
        pass


def main():
    with open(CLIENT_FILE) as f:
        conf = json.load(f)

    key = list(conf.keys())[0]
    client_id = conf[key]['client_id']
    client_secret = conf[key]['client_secret']

    auth_url = 'https://accounts.google.com/o/oauth2/v2/auth?' + urllib.parse.urlencode({
        'client_id': client_id,
        'redirect_uri': REDIRECT,
        'response_type': 'code',
        'scope': SCOPES,
        'access_type': 'offline',
        'prompt': 'consent',
    })

    print()
    print('=' * 70)
    print('브라우저가 열립니다. scm@lightenuf.com 계정으로 승인해주세요.')
    print()
    print('열리지 않으면 아래 주소를 브라우저에 직접 붙여넣으세요:')
    print()
    print(auth_url)
    print('=' * 70)
    print()
    print('승인을 기다리는 중...')

    webbrowser.open(auth_url)

    server = HTTPServer(('localhost', 4455), Handler)
    server.handle_request()
    server.server_close()

    if received.get('error'):
        print(f'\n승인이 거부되었습니다: {received["error"]}')
        return

    if not received.get('code'):
        print('\n승인 코드를 받지 못했습니다.')
        return

    print('승인 확인. 토큰을 받아오는 중...')

    data = urllib.parse.urlencode({
        'code': received['code'],
        'client_id': client_id,
        'client_secret': client_secret,
        'redirect_uri': REDIRECT,
        'grant_type': 'authorization_code',
    }).encode()

    req = urllib.request.Request('https://oauth2.googleapis.com/token', data=data)

    with urllib.request.urlopen(req) as res:
        token = json.load(res)

    if 'refresh_token' not in token:
        print('\n갱신 토큰을 받지 못했습니다. 다시 시도해주세요.')
        return

    os.makedirs(SECRET_DIR, exist_ok=True)

    with open(TOKEN_FILE, 'w') as f:
        json.dump({
            'client_id': client_id,
            'client_secret': client_secret,
            'refresh_token': token['refresh_token'],
        }, f, indent=2, ensure_ascii=False)

    os.chmod(TOKEN_FILE, 0o600)

    print()
    print('완료되었습니다.')
    print(f'저장 위치: {TOKEN_FILE}')
    print()
    print('이 파일에는 메일 발송 권한이 들어있습니다. 외부에 공유하지 마세요.')


if __name__ == '__main__':
    main()

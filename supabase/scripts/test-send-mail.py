#!/usr/bin/env python3
"""
Gmail 발송이 실제로 되는지 확인하는 시험용 스크립트입니다.

받는 사람은 scm@lightenuf.com (본인) 으로 고정되어 있습니다.
나인로지스 등 외부로는 절대 보내지 않습니다.
"""

import base64
import json
import os
import urllib.parse
import urllib.request
from email.message import EmailMessage
from datetime import datetime

TOKEN_FILE = os.path.expanduser('~/.breevo-secrets/google-refresh-token.json')

TO = 'scm@lightenuf.com'   # 본인에게만 보냅니다
FROM_NAME = '라이트이너프 SCM'


def get_access_token(conf):
    data = urllib.parse.urlencode({
        'client_id': conf['client_id'],
        'client_secret': conf['client_secret'],
        'refresh_token': conf['refresh_token'],
        'grant_type': 'refresh_token',
    }).encode()

    req = urllib.request.Request('https://oauth2.googleapis.com/token', data=data)

    with urllib.request.urlopen(req) as res:
        return json.load(res)['access_token']


def main():
    with open(TOKEN_FILE) as f:
        conf = json.load(f)

    print('접근 권한을 확인하는 중...')
    access_token = get_access_token(conf)
    print('확인됨.')

    now = datetime.now().strftime('%Y.%m.%d %H:%M:%S')

    msg = EmailMessage()
    msg['To'] = TO
    msg['From'] = f'{FROM_NAME} <{TO}>'
    msg['Subject'] = f'[테스트] 새 발주 어드민 메일 발송 확인 ({now})'
    msg.set_content(
        '새 발주 어드민(GitHub + Supabase)에서 보낸 시험 메일입니다.\n\n'
        '이 메일이 도착했다면 Gmail 연결이 정상입니다.\n'
        '실제 요청서 발송은 아직 시작하지 않았습니다.\n\n'
        f'발송 시각: {now}\n'
    )

    raw = base64.urlsafe_b64encode(msg.as_bytes()).decode()

    req = urllib.request.Request(
        'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
        data=json.dumps({'raw': raw}).encode(),
        headers={
            'Authorization': f'Bearer {access_token}',
            'Content-Type': 'application/json',
        },
    )

    print(f'{TO} 으로 시험 메일을 보내는 중...')

    with urllib.request.urlopen(req) as res:
        result = json.load(res)

    print()
    print('발송 성공했습니다.')
    print(f'메일 ID: {result.get("id")}')
    print()
    print('scm@lightenuf.com 받은편지함과 보낸편지함을 확인해보세요.')


if __name__ == '__main__':
    main()

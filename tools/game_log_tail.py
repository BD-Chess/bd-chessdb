"""Read private game JSONL with a token from a local file; never print that token."""
import argparse
import json
import os
from pathlib import Path
import sys
import time
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urlsplit, urlunsplit
from urllib.request import Request, build_opener, HTTPRedirectHandler
from uuid import UUID


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def read_token(path):
    token = Path(path).read_text(encoding='utf-8-sig').strip()
    if not 32 <= len(token) <= 512 or any(c.isspace() for c in token):
        raise ValueError('Invalid token file')
    return token


def endpoint(url):
    parts = urlsplit(url)
    if parts.scheme != 'https' or not parts.hostname or parts.username or parts.password or parts.query or parts.fragment:
        raise ValueError('Expected HTTPS endpoint without credentials/query')
    if parts.path.rstrip('/') != '/.netlify/functions/game-guide':
        raise ValueError('Expected game-guide endpoint')
    return urlunsplit((parts.scheme, parts.netloc, parts.path.rstrip('/'), '', ''))


def fetch_page(url, token, params, opener=None):
    req = Request(url + '?' + urlencode(params), headers={
        'Authorization': 'Bearer ' + token, 'Accept': 'application/x-ndjson, application/json', 'Cache-Control': 'no-store'
    })
    with (opener or build_opener(NoRedirect())).open(req, timeout=15) as response:
        raw = response.read(4000001)
        if len(raw) > 4000000:
            raise ValueError('Response too large')
    return raw.decode('utf-8')


def read_events(text, session, since):
    rows = []
    for line in text.splitlines():
        if not line.strip():
            continue
        row = json.loads(line)
        seq = row.get('seq')
        if type(seq) is not int or seq <= since or row.get('game_session_id') != session:
            raise ValueError('Invalid sequence/session')
        since = seq
        rows.append(row)
    return rows, since


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('session', nargs='?')
    parser.add_argument('--url', default=os.environ.get('GAME_LOG_URL', 'https://www.mdlxdcc.org/.netlify/functions/game-guide'))
    parser.add_argument('--token-file', default=os.environ.get('GAME_LOG_TOKEN_FILE'))
    parser.add_argument('--since', type=int, default=0)
    parser.add_argument('--follow', action='store_true')
    parser.add_argument('--recent', action='store_true')
    args = parser.parse_args(argv)
    if not args.token_file or args.since < 0 or (args.recent and (args.follow or args.session)) or (not args.recent and not args.session):
        parser.error('Supply --token-file (or GAME_LOG_TOKEN_FILE) and session, or --recent')
    try:
        url, token = endpoint(args.url), read_token(args.token_file)
        if args.recent:
            data = json.loads(fetch_page(url, token, {'logs': 'recent'}))
            print(json.dumps(data, ensure_ascii=False).replace(token, '[redacted]'))
            return 0
        session = str(UUID(args.session))
        if UUID(session).version != 4:
            raise ValueError('Expected UUID v4')
        since = args.since
        while True:
            rows, since = read_events(fetch_page(url, token, {'log': session, 'since': since}), session, since)
            for row in rows:
                print(json.dumps(row, ensure_ascii=False).replace(token, '[redacted]'), flush=True)
            if len(rows) >= 20:
                continue
            if not args.follow:
                return 0
            time.sleep(2)
    except KeyboardInterrupt:
        return 0
    except HTTPError as exc:
        print('Game log HTTP error: ' + str(exc.code), file=sys.stderr)
    except (OSError, ValueError, KeyError, URLError):
        # Never print exceptions, response bodies, headers, URL or local credential paths.
        print('Game log unavailable or invalid input.', file=sys.stderr)
    return 1


if __name__ == '__main__':
    raise SystemExit(main())

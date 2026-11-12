#!/usr/bin/env python3
"""Fail a release when a newly published, indexable HTML page is unsearchable.

This checks paths and public metadata only; it never copies page bodies into
search. Protected/noindex pages may remain unlisted. Run after checking out
both the previous and new commit, before freezing any release artifact.
"""
import argparse
from html.parser import HTMLParser
import json
from pathlib import Path, PurePosixPath
import re
import subprocess
from urllib.parse import unquote, urlsplit

# Existing routes with noindex/private deployment headers. Keep aligned with
# netlify.toml/_headers; an explicit robots=noindex page is also exempt.
PRIVATE_PREFIXES = (
    'bd/o/', 'bd/bbsh', 'bd/bd_kardiolog', 'wl/',
    'ai8/ai8-state', 'nara/dualframe-lab/', 'omnicpq/',
)
PRIVATE_PARTS = {'private', 'secret', 'secrets', 'vault', 'internal'}


class Robots(HTMLParser):
    def __init__(self):
        super().__init__()
        self.noindex = False

    def handle_starttag(self, tag, attrs):
        if tag.lower() != 'meta':
            return
        fields = {k.lower(): (v or '') for k, v in attrs}
        if fields.get('name', '').lower() in {'robots', 'googlebot', 'bingbot'}:
            self.noindex |= 'noindex' in fields.get('content', '').lower()


def normal_url(value):
    if not isinstance(value, str):
        return None
    parsed = urlsplit(value)
    if parsed.scheme or parsed.netloc or not parsed.path.startswith('/') or parsed.path.startswith('//'):
        return None
    path = unquote(parsed.path).replace('\\', '/').lower().strip('/')
    if path == 'index.html':
        return ''
    if path.endswith('/index.html'):
        return path[:-11].rstrip('/')
    if path.endswith(('.html', '.htm')):
        path = path.rsplit('.', 1)[0]
    return path.rstrip('/')


def is_private(rel):
    low = rel.as_posix().lower()
    return (any(low.startswith(prefix) for prefix in PRIVATE_PREFIXES)
            or any(part in PRIVATE_PARTS for part in low.split('/')))


def is_noindex(path):
    with path.open('rb') as stream:
        head = stream.read(262144).decode('utf-8', 'replace')
    if '"schema":"BD_ACCESS_V1"' in head:
        return True
    parser = Robots()
    parser.feed(head)
    return parser.noindex


def missing_new_pages(root, paths, index):
    known = {normal_url(item.get('url')) for item in index['items']
             if isinstance(item, dict) and isinstance(item.get('title'), str) and item['title'].strip()}
    missing = []
    for name in sorted(set(paths)):
        p = PurePosixPath(name)
        if not p.parts or p.parts[0] != 'public' or '..' in p.parts or p.suffix.lower() not in {'.html', '.htm'}:
            continue
        rel = PurePosixPath(*p.parts[1:])
        if is_private(rel):
            continue
        path = root.joinpath(*p.parts)
        if path.is_symlink() or not path.is_file():
            raise ValueError('NEW_HTML_NOT_REGULAR: ' + name)
        if normal_url('/' + rel.as_posix()) in known or is_noindex(path):
            continue
        missing.append(name)
    return missing


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--base')
    parser.add_argument('--head')
    args = parser.parse_args()
    root = Path(__file__).resolve().parent.parent
    index = json.loads((root / 'public/site-search-index.json').read_text(encoding='utf-8'))
    if (not isinstance(index, dict) or not isinstance(index.get('items'), list)
            or index.get('total_pages') != len(index['items']) or index.get('body_indexed') is not False):
        raise SystemExit('Invalid public search index')
    if bool(args.base) != bool(args.head):
        raise SystemExit('Both --base and --head are required together')
    if args.base:
        if not all(re.fullmatch(r'[0-9a-f]{40,64}', v or '') for v in (args.base, args.head)):
            raise SystemExit('Expected exact commit identifiers')
        result = subprocess.run(['git', '-C', str(root), 'diff', '--name-only', '--diff-filter=A',
                                 '--no-renames', '-z', args.base, args.head, '--', 'public/'],
                                check=True, stdout=subprocess.PIPE)
        names = [v.decode('utf-8') for v in result.stdout.split(b'\0') if v]
        missing = missing_new_pages(root, names, index)
        if missing:
            raise SystemExit('New public HTML missing from site-search-index.json:\n' + '\n'.join(missing))
        print('Public search freshness: newly added discoverable pages are indexed.')
    else:
        print('Public search index metadata verified.')


if __name__ == '__main__':
    main()

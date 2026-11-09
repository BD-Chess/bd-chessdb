#!/usr/bin/env python3
"""Build the essay pages from their sources.

  src.html      Slovene source; also holds the shared <style> and <script>
  src.en.html   English source; takes style and script from the Slovene one
  staves.py     the opening figure (three music staves)

Abbreviations are written [[KEY]] or [[KEY|shown text]]. Every token becomes a link
to its glossary entry (<dt id="k-...">), which the page script shows as a popup on
hover, focus or tap. The build fails if a token has no glossary entry, and it
reports any abbreviation left untagged in the running text.

Usage:  python3 -I build.py [--hero=peta|oda] [--compare] [--out=DIR]
Writes: DIR/index.html (sl) and DIR/en/index.html (en); DIR defaults to the parent folder.
In the site repository: python3 -I scripts/bogastvo-obstoja/build.py --out=public/bogastvo-obstoja
"""
import pathlib
import re
import sys
from html.parser import HTMLParser

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import staves  # noqa: E402  (opening figure, see staves.py)

# which music the third staff of the opening figure shows: 'peta' or 'oda'
HERO = 'peta'

COMMON = {
    'BD': 'bd', 'GPT': 'gpt', 'AGI': 'agi', 'ASI': 'asi', 'AC': 'ac', 'RC': 'rc',
    'CFH': 'cfh', 'CCH': 'cch', 'ToE': 'toe', 'DCC': 'dcc', 'MDL×DCC': 'mdlxdcc',
    'LZ': 'lz', 'AI8': 'ai8', '8Z': '8z', 'T2T': 't2t', 'CLV': 'clv', 'V4': 'v4', 'E0.1': 'e01',
}
LANGS = {
    'sl': {'src': 'src.html', 'out': 'index.html',
           'slug': dict(COMMON, UI='ui', DNK='dnk'), 'watch': {'DNA', 'MDLxDCC', 'MDL'}},
    'en': {'src': 'src.en.html', 'out': 'en/index.html',
           'slug': dict(COMMON, AI='ai', DNA='dna'), 'watch': {'DNK', 'UI', 'MDLxDCC', 'MDL'}},
}


def expand(src, slug):
    used = {}

    def rep(m):
        key, text = m.group(1), m.group(2) or m.group(1)
        if key not in slug:
            sys.exit('build: unknown term [[%s]]' % key)
        used[key] = used.get(key, 0) + 1
        return '<a class="k" href="#k-%s">%s</a>' % (slug[key], text)

    out = re.sub(r'\[\[([^\]|]+)(?:\|([^\]]+))?\]\]', rep, src)
    for key, s in slug.items():
        if 'id="k-%s"' % s not in out:
            sys.exit('build: no glossary entry for %s (expected id="k-%s")' % (key, s))
        if key not in used:
            print('build: note, %s is defined but never used' % key)
    return out, used


class Lint(HTMLParser):
    """Collect visible text that sits outside links, the glossary and non-prose blocks."""
    VOID = {'br', 'hr', 'img', 'input', 'meta', 'link', 'source', 'wbr', 'stop', 'circle', 'rect', 'path', 'use', 'ellipse'}

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.stack = []
        self.skip = 0
        self.chunks = []

    def handle_starttag(self, tag, attrs):
        if tag in self.VOID:
            return
        a = dict(attrs)
        cls = (a.get('class') or '').split()
        bad = (tag in ('a', 'style', 'script', 'svg', 'title', 'head')
               or a.get('id') == 'kratice' or 'bits' in cls or 'nolint' in cls)
        self.stack.append((tag, bad))
        self.skip += bad

    def handle_endtag(self, tag):
        if tag in self.VOID:
            return
        while self.stack:
            t, bad = self.stack.pop()
            self.skip -= bad
            if t == tag:
                break

    def handle_data(self, data):
        if not self.skip:
            self.chunks.append(data)


def lint(out, watch):
    p = Lint()
    p.feed(out)
    text = ' '.join(p.chunks)
    problems = []
    for key in sorted(watch, key=len, reverse=True):
        pat = r'(?<![\w×])' + re.escape(key) + r'(?![\w×.]\w|\w)'
        hits = re.findall(pat, text)
        if hits:
            problems.append('%s ×%d' % (key, len(hits)))
    others = sorted(set(re.findall(r'(?<![\w×])(?=[A-ZČŠŽ0-9]*[A-ZČŠŽ])[A-ZČŠŽ0-9]{2,}(?![\w×])', text)))
    return problems, [o for o in others if o not in watch]


def compare(sl_src):
    """Write a small page that shows both variants of the opening figure, for choosing."""
    style = re.search(r'<style>.*?</style>', sl_src, flags=re.S).group(0)
    figs = []
    for i, (variant, name) in enumerate((('peta', 'A · Peta simfonija, 1. stavek'), ('oda', 'B · Oda radosti (Deveta simfonija)'))):
        fig = staves.hero(variant, 'sl', with_defs=(i == 0))
        fig = re.sub(r'\[\[([^\]|]+)(?:\|([^\]]+))?\]\]', lambda m: m.group(2) or m.group(1), fig)
        figs.append('<section><h2>%s</h2>%s</section>' % (name, fig))
    page = ('<!doctype html><html lang="sl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">'
            '<title>Primerjava uvodne slike</title>' + style +
            '<style>.cmp{display:grid;grid-template-columns:repeat(auto-fit,minmax(18rem,1fr));gap:3rem;padding:2rem 0 4rem}'
            '.cmp h2{font-family:var(--sans);font-size:1rem;font-weight:600;margin:0 0 1.2rem}.cmp .art{max-width:32rem}.cmp section{margin:0}</style></head>'
            '<body><div class="wrap"><h1 style="font-size:2rem;margin:2rem 0 0">Uvodna slika: katera glasba?</h1><div class="cmp">'
            + ''.join(figs) + '</div></div></body></html>')
    (HERE.parent / 'primerjava-uvodne-slike.html').write_text(page, encoding='utf-8')
    print('build: wrote primerjava-uvodne-slike.html')


def main():
    variant = next((x.split('=', 1)[1] for x in sys.argv[1:] if x.startswith('--hero=')), HERO)
    out_dir = pathlib.Path(next((x.split('=', 1)[1] for x in sys.argv[1:] if x.startswith('--out=')), HERE.parent))
    sl_src = (HERE / 'src.html').read_text(encoding='utf-8')
    css = re.search(r'<style>(.*?)</style>', sl_src, flags=re.S).group(1)
    js = re.search(r'<script>(.*?)</script>', sl_src, flags=re.S).group(1)
    if '--compare' in sys.argv:
        compare(sl_src)
    failed = False
    for lang, cfg in LANGS.items():
        path = HERE / cfg['src']
        if not path.exists():
            print('build: %s missing, skipping %s' % (cfg['src'], lang))
            continue
        src = path.read_text(encoding='utf-8')
        if lang != 'sl':
            for marker, shared in (('/*SHARED-CSS*/', css), ('/*SHARED-JS*/', js)):
                assert src.count(marker) == 1, marker
                src = src.replace(marker, shared)
        assert src.count('<!--HERO-->') == 1
        src = src.replace('<!--HERO-->', staves.hero(variant, lang))
        slug = cfg['slug']
        out, used = expand(src, slug)
        problems, others = lint(out, set(slug) | cfg['watch'])
        target = out_dir / cfg['out']
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(out, encoding='utf-8')
        print('build: [%s] wrote %s, %d bytes, %d tagged terms (%d distinct)'
              % (lang, cfg['out'], len(out.encode()), sum(used.values()), len(used)))
        if problems:
            failed = True
            print('build: [%s] UNTAGGED abbreviations in running text: %s' % (lang, '; '.join(problems)))
        else:
            print('build: [%s] no untagged abbreviations in running text' % lang)
        if others:
            print('build: [%s] other all-caps tokens to review: %s' % (lang, ', '.join(others)))
    return 1 if failed else 0


if __name__ == '__main__':
    sys.exit(main())

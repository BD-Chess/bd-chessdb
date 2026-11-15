#!/usr/bin/env python3
"""Build the story pages (third version, "zgodba") from their sources.

  zgodba.src.html      Slovene source
  zgodba.src.en.html   English source

The shared <style> and <script> come from src.html (the essay, second version) and the
opening figure from staves.py, so the two versions keep one look. build.py and its
sources are not touched by this script.

The story uses no abbreviations and has no glossary, so the figure caption is written
here instead of the essay's caption, which carries a glossary token and a popup.

Usage:  python3 -I build_zgodba.py [--out=DIR]
Writes: DIR/index.html (sl) and DIR/en/index.html (en); DIR defaults to ../zgodba.
In the site repository:
        python3 -I scripts/bogastvo-obstoja/build_zgodba.py --out=public/bogastvo-obstoja/zgodba
"""
import pathlib
import re
import sys

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import staves  # noqa: E402  (opening figure, see staves.py)

HERO = 'peta'
LANGS = {
    'sl': {'src': 'zgodba.src.html', 'out': 'index.html',
           'caption': 'Tretja vrstica je začetek Beethovnove Pete simfonije. Bojan jo sliši takole: '
                      '»Svet je takšen, kot je. Kako ga čutiš, je pa tvoje.« '
                      'Loka s piko nad dolgima notama sta koroni, znak, da se ton drži.'},
    'en': {'src': 'zgodba.src.en.html', 'out': 'en/index.html',
           'caption': "The third staff is the opening of Beethoven's Fifth Symphony. Bojan hears it like this: "
                      '“The world is the way it is. How you feel it is yours.” '
                      'The arcs with a dot above the two long notes are fermatas, the sign that a tone is held.'},
}


def hero(lang, caption):
    fig = staves.hero(HERO, lang)
    fig, n = re.subn(r'<figcaption>.*?</figcaption>', lambda m: '<figcaption>%s</figcaption>' % caption, fig, flags=re.S)
    assert n == 1, 'figure caption not found'
    return fig


def main():
    out_dir = pathlib.Path(next((x.split('=', 1)[1] for x in sys.argv[1:] if x.startswith('--out=')), HERE.parent / 'zgodba'))
    essay = (HERE / 'src.html').read_text(encoding='utf-8')
    css = re.search(r'<style>(.*?)</style>', essay, flags=re.S).group(1)
    js = re.search(r'<script>(.*?)</script>', essay, flags=re.S).group(1)
    for lang, cfg in LANGS.items():
        src = (HERE / cfg['src']).read_text(encoding='utf-8')
        for marker, shared in (('/*SHARED-CSS*/', css), ('/*SHARED-JS*/', js), ('<!--HERO-->', hero(lang, cfg['caption']))):
            assert src.count(marker) == 1, marker
            src = src.replace(marker, shared)
        for leftover in ('[[', 'data-unfold', 'SHARED-', '<!--HERO'):
            assert leftover not in src, 'leftover %r in %s' % (leftover, cfg['src'])
        target = out_dir / cfg['out']
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(src, encoding='utf-8')
        print('build_zgodba: [%s] wrote %s, %d bytes' % (lang, target, len(src.encode())))
    return 0


if __name__ == '__main__':
    sys.exit(main())

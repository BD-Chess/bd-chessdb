"""The opening figure: three music staves (one held tone, white noise, music).

The third staff exists in two variants:
  peta  Beethoven, Symphony No. 5, first movement, bars 1-5 (C minor, three flats)
  oda   Beethoven, Symphony No. 9, "Ode to Joy" theme, bars 1-8 (written in C major)

Glyph outlines (treble clef, flat, eighth rest, fermata) are stored in glyphs.json;
they were exported once from the Noto Music font (SIL Open Font License 1.1).
"""
import json
import pathlib

HERE = pathlib.Path(__file__).resolve().parent
G = json.loads((HERE / 'glyphs.json').read_text(encoding='utf-8'))

W, H = 640, 100
LINES = [30, 40, 50, 60, 70]                 # staff lines, top (F5) to bottom (E4)
Y = {'C4': 80, 'D4': 75, 'E4': 70, 'F4': 65, 'G4': 60, 'A4': 55, 'B4': 50, 'E5': 35}
S = 76.0 / G['gclef']['h']                   # one scale for every glyph
LEFT = 46                                    # first usable x after the clef


def glyph_defs():
    paths = ''.join('<path id="g-%s" d="%s"/>' % (k, v['d']) for k, v in G.items())
    return '<svg class="glyphs" width="0" height="0" aria-hidden="true"><defs>%s</defs></svg>' % paths


def glyph(name, x, y):
    return '<use class="gl" href="#g-%s" transform="translate(%.1f %.1f) scale(%.4f)"/>' % (name, x, y, S)


def staff(extra=''):
    lines = ''.join('<path d="M0 %dH%d"/>' % (y, W) for y in LINES)
    return '<g class="st">%s%s</g>%s' % (lines, extra, glyph('gclef', 6, 13))


def head(x, y, hollow=False):
    return ('<ellipse class="%s" cx="%.1f" cy="%.1f" rx="5.6" ry="4" transform="rotate(-20 %.1f %.1f)"/>'
            % ('hh' if hollow else 'hf', x, y, x, y))


def stem(x, y, up=True, length=30):
    if up:
        return '<path class="sm" d="M%.1f %.1fV%.1f"/>' % (x + 5.1, y - 1.2, y - length)
    return '<path class="sm" d="M%.1f %.1fV%.1f"/>' % (x - 5.1, y + 1.2, y + length)


def row_tone():
    return staff() + '<path class="hold" d="M%d 55H626"/>' % (LEFT + 4)


def row_noise():
    seed = [20261109]

    def rnd():
        seed[0] = (seed[0] * 1103515245 + 12345) & 0x7fffffff
        return seed[0] / 0x7fffffff

    notes = sorted((LEFT + 4 + rnd() * (624 - LEFT), 12 + int(rnd() * 16) * 5 + 1, rnd() < .5) for _ in range(92))
    return staff() + '<g class="nt">' + ''.join(head(x, y) + stem(x, y, up, 24) for x, y, up in notes) + '</g>'


def row_oda():
    bars = [
        [('E4', 1), ('E4', 1), ('F4', 1), ('G4', 1)],
        [('G4', 1), ('F4', 1), ('E4', 1), ('D4', 1)],
        [('C4', 1), ('C4', 1), ('D4', 1), ('E4', 1)],
        [('E4', 1.5), ('D4', .5), ('D4', 2)],
        [('E4', 1), ('E4', 1), ('F4', 1), ('G4', 1)],
        [('G4', 1), ('F4', 1), ('E4', 1), ('D4', 1)],
        [('C4', 1), ('C4', 1), ('D4', 1), ('E4', 1)],
        [('D4', 1.5), ('C4', .5), ('C4', 2)],
    ]
    bw = (W - LEFT - 2) / 8
    beat = (bw - 14) / 4
    g, extra = [], []
    for i, bar in enumerate(bars):
        bx, t = LEFT + bw * i, 0.0
        for pitch, dur in bar:
            if len(bar) == 3:
                x = bx + {0.0: 10, 1.5: 10 + 1.4 * beat, 2.0: 10 + 2.45 * beat}[t]
            else:
                x = bx + 10 + t * beat
            y = Y[pitch]
            if pitch == 'C4':
                extra.append('<path d="M%.1f 80H%.1f"/>' % (x - 9.5, x + 9.5))
            g.append(head(x, y, hollow=(dur == 2)) + stem(x, y))
            if dur == 1.5:
                g.append('<circle class="hf" cx="%.1f" cy="%.1f" r="1.7"/>' % (x + 10.5, y - 2.5 if y in LINES else y))
            if dur == .5:
                g.append('<path class="sm" d="M%.1f %.1fc1 7 9 8 7 18"/>' % (x + 5.1, y - 30))
            t += dur
        assert abs(t - 4) < 1e-9
        extra.append('<path d="M%.1f 30V70"/>' % min(bx + bw, W - .5))
    return staff(''.join(extra)) + '<g class="nt">' + ''.join(g) + '</g>'


def row_peta():
    flat_h = G['flat']['h'] * S
    key = ''.join(glyph('flat', x, Y[p] - .80 * flat_h) for x, p in ((38, 'B4'), (48, 'E5'), (58, 'A4')))
    edges = [80, 220, 314, 454, 536, 632]            # bar lines of bars 1-5
    g, extra = [], []

    def motif(x0, pitch):
        y = Y[pitch]
        xs = [x0 + 54, x0 + 83, x0 + 112]
        g.append(glyph('rest8', x0 + 14, 41))
        for x in xs:
            g.append(head(x, y) + stem(x, y))
        g.append('<path class="bm" d="M%.1f %.1fH%.1f"/>' % (xs[0] + 4.4, y - 28.2, xs[-1] + 5.8))

    def long_note(x, pitch, fermata):
        y = Y[pitch]
        g.append(head(x, y, hollow=True) + stem(x, y))
        if fermata:
            g.append(glyph('fermata', x - G['fermata']['w'] * S / 2, 5))
        return x, y

    motif(edges[0], 'G4')                                   # bar 1: rest, G G G
    long_note(edges[1] + 40, 'E4', True)                    # bar 2: E flat, fermata
    motif(edges[2], 'F4')                                   # bar 3: rest, F F F
    xa, ya = long_note(edges[3] + 36, 'D4', False)          # bar 4: D, tied
    xb, _ = long_note(edges[4] + 42, 'D4', True)            # bar 5: D, fermata
    g.append('<path class="tie" d="M%.1f %.1fQ%.1f %.1f %.1f %.1f"/>' % (xa + 6, ya + 7, (xa + xb) / 2, ya + 17, xb - 6, ya + 7))
    for x in edges[1:]:
        extra.append('<path d="M%d 30V70"/>' % x)
    return staff(''.join(extra)) + key + '<g class="nt">' + ''.join(g) + '</g>'


TEXT = {
    'sl': {
        'tone': ('en sam ton', 'Notno črtovje z eno samo debelo ravno črto: en držan ton'),
        'noise': ('beli šum', 'Notno črtovje, čez katero so brez reda natresene note'),
        'music': 'glasba',
        'peta': ('Notno črtovje z začetkom Beethovnove Pete simfonije: trije kratki toni in en dolg, dvakrat',
                 'Tretja vrstica je začetek Beethovnove Pete simfonije. [[BD]] jo sliši takole: '
                 '<span class="unfold" tabindex="0" data-unfold="u-svet">»Svet je takšen, kot je. Kako ga čutiš, je pa tvoje.«</span> '
                 'Loka s piko nad dolgima notama sta koroni, znak, da se ton drži.'),
        'oda': ('Notno črtovje s prvimi osmimi takti teme Ode radosti',
                'Tretja vrstica je tema Ode radosti iz Beethovnove Devete simfonije. Ista trojica se v 5. poglavju vrne kot trije nizi iz arhitekture [[AI8]].'),
    },
    'en': {
        'tone': ('a single tone', 'A music staff with one thick straight line: a single held tone'),
        'noise': ('white noise', 'A music staff with notes scattered across it in no order'),
        'music': 'music',
        'peta': ("A music staff with the opening of Beethoven's Fifth Symphony: three short notes and a long one, twice",
                 "The third staff is the opening of Beethoven's Fifth Symphony. [[BD]] hears it like this: "
                 '<span class="unfold" tabindex="0" data-unfold="u-svet">“The world is the way it is. How you feel it is yours.”</span> '
                 'The arcs with a dot above the two long notes are fermatas, the sign that a tone is held.'),
        'oda': ('A music staff with the first eight bars of the Ode to Joy theme',
                "The third staff is the Ode to Joy theme from Beethoven's Ninth Symphony. The same three return in chapter 5 as three sequences from the [[AI8]] architecture."),
    },
}
ROWS = {'peta': row_peta, 'oda': row_oda}


def _row(label, cls, alt, inner):
    return ('      <div class="srow%s"><span class="slab">%s</span><svg class="staff" viewBox="0 0 %d %d" '
            'role="img" aria-label="%s">%s</svg></div>' % (cls, label, W, H, alt, inner))


def hero(variant, lang='sl', with_defs=True):
    tx = TEXT[lang]
    alt, cap = tx[variant]
    return '\n'.join([
        '  <figure class="art">',
        ('    ' + glyph_defs()) if with_defs else '',
        '    <div class="score">',
        _row(tx['tone'][0], '', tx['tone'][1], row_tone()),
        _row(tx['noise'][0], '', tx['noise'][1], row_noise()),
        _row(tx['music'], ' live', alt, ROWS[variant]()),
        '    </div>',
        '    <figcaption>%s</figcaption>' % cap,
        '  </figure>'])

"""Build-only transport bootstrap. The delivered game is plain standalone HTML.
Sources are content-addressed below; no runtime Base64 loader is used.
"""
from pathlib import Path
import base64,gzip,hashlib,json,runpy,shutil
HERE=Path(__file__).resolve().parent
encoded=''.join((HERE/'source-parts'/f'part-{i:02}.txt').read_text().strip() for i in range(1,9))
assert len(encoded)==45152,'Source transport length'
compressed=base64.b64decode(encoded,validate=True)
assert hashlib.sha256(compressed).hexdigest()=='cf7c149a60320b1735b585c90bdaa038410f7e496cf3f1054d9a94e2d8d56129','Source transport digest'
raw=gzip.decompress(compressed)
assert len(raw)==103084 and hashlib.sha256(raw).hexdigest()=='ba4d8455012a01894e2b8b6f64876614d5bf8521148fb20306b7819aa4de4447','Source bundle identity'
files=json.loads(raw)
assert set(files)=={'nav-style.css', 'nav-core.js', 'fixtures.json', 'build.py', 'nav-ui.js', 'test.cjs', 'browser.py', 'live_check.py'},'Unexpected source members'
src=HERE/'src';src.mkdir(exist_ok=True)
for name,text in files.items():
    assert isinstance(text,str) and Path(name).name==name
    (src/name).write_text(text,encoding='utf-8')
runpy.run_path(str(src/'build.py'),run_name='__main__')
output=Path('sudoku-evidence/8zSudoku.html').read_bytes()
assert hashlib.sha256(output).hexdigest()=='5b37dbd27b2e675bad763d606c5b573bcd6c2b967e8b441a81e796d40d45188a','Built HTML differs from locally tested candidate'
shutil.copytree(src,Path('sudoku-evidence/source'),dirs_exist_ok=True)

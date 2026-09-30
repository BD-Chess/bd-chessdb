import pathlib, hashlib, subprocess
p=pathlib.Path('public/S/app/app-solve-playback.js')
b=p.read_bytes()
assert hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()=='b8edb803f72484f8bcd56c1b4a80055cedaab882', 'APP changed since review; stop rather than overwrite'
s=b.decode()
a=' const externalRenderObserver=new MutationObserver('
assert s.count(a)==1
fragment=pathlib.Path('tools/sudoku-sensor-guide/guide.inc.js').read_text()
# Safari touch does not always focus the tapped button. Always restore the guide trigger.
assert fragment.count('guidePreviousFocus=document.activeElement;')==1
fragment=fragment.replace('guidePreviousFocus=document.activeElement;',"guidePreviousFocus=$('appSensorGuideOpen');")
s=s.replace(a,fragment+'\n'+a)
assert s.count('.app-pos-sensor:nth-child(')==4
s=s.replace('.app-pos-sensor:nth-child(','.app-pos-sensor:nth-of-type(')
p.write_text(s)
subprocess.run(['node','--check',str(p)],check=True)
subprocess.run(['node','scripts/build-sudoku-app-preview.cjs'],check=True)
subprocess.run(['node','scripts/build-sudoku-app-preview.cjs','--check'],check=True)

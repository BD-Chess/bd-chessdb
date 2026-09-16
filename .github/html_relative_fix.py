from pathlib import Path
from urllib.parse import urlsplit, urlunsplit
import posixpath,re,json,sys

ROOT=Path('public')
HTML=sorted(set(list(ROOT.rglob('*.html'))+list(ROOT.rglob('*.htm'))))
ATTR_RE=re.compile(r'''(?P<attr>href|src|action|poster|formaction)\s*=\s*(?P<q>["'])(?P<url>.*?)(?P=q)''',re.I)
HOSTS={'mdlxdcc.org','www.mdlxdcc.org'}
SERVICE_PREFIXES=('/.netlify/','/api/')
changed=[]; edits=0; skipped_service=[]

def is_metadata_tag(line,start,end):
    a=line.rfind('<',0,start); b=line.find('>',end)
    if a<0 or b<0:return False
    tag=line[a:b+1]
    low=tag.lower()
    if low.startswith('<meta'): return True
    if low.startswith('<link') and re.search(r'rel\s*=\s*["\'][^"\']*canonical',tag,re.I): return True
    return False

def rel_for(file,url):
    p=urlsplit(url)
    if p.scheme in ('http','https'):
        if (p.hostname or '').lower() not in HOSTS:return None
        path=p.path or '/'
    elif not p.scheme and not p.netloc and p.path.startswith('/') and not p.path.startswith('//'):
        path=p.path
    else:return None
    if any(path.startswith(x) for x in SERVICE_PREFIXES):
        return ('SERVICE',url)
    start=file.parent.relative_to(ROOT).as_posix()
    if start=='.':start=''
    base=start or '.'
    target=path.lstrip('/')
    if not target:
        rel=posixpath.relpath('.',base)
        if rel=='.': rel='./'
        elif not rel.endswith('/'): rel+='/'
    else:
        rel=posixpath.relpath(target,base)
        if path.endswith('/') and not rel.endswith('/'): rel+='/'
        if rel=='.': rel='./'
        elif not rel.startswith('.'):
            rel='./'+rel
    return urlunsplit(('', '', rel, p.query, p.fragment))

for file in HTML:
    old=file.read_text(encoding='utf-8',errors='replace')
    out=[]
    for line_no,line in enumerate(old.splitlines(True),1):
        def repl(m):
            global edits
            u=m.group('url').strip()
            if is_metadata_tag(line,m.start(),m.end()):return m.group(0)
            result=rel_for(file,u)
            if result is None:return m.group(0)
            if isinstance(result,tuple):
                skipped_service.append({'file':file.as_posix(),'line':line_no,'url':u})
                return m.group(0)
            if result==u:return m.group(0)
            edits+=1
            return f"{m.group('attr')}={m.group('q')}{result}{m.group('q')}"
        out.append(ATTR_RE.sub(repl,line))
    new=''.join(out)
    if new!=old:
        file.write_text(new,encoding='utf-8')
        changed.append(file.as_posix())

# Validate: no remaining same-site navigational/static attrs or root-relative attrs, except service endpoints and metadata.
remaining=[]
for file in HTML:
    for line_no,line in enumerate(file.read_text('utf-8',errors='replace').splitlines(),1):
        for m in ATTR_RE.finditer(line):
            if is_metadata_tag(line,m.start(),m.end()):continue
            u=m.group('url').strip(); p=urlsplit(u)
            same_abs=p.scheme in ('http','https') and (p.hostname or '').lower() in HOSTS
            root_rel=(not p.scheme and not p.netloc and p.path.startswith('/') and not p.path.startswith('//'))
            if not (same_abs or root_rel):continue
            if any(p.path.startswith(x) for x in SERVICE_PREFIXES):continue
            remaining.append({'file':file.as_posix(),'line':line_no,'attr':m.group('attr').lower(),'url':u})

report={'html_files_scanned':len(HTML),'changed_files':len(changed),'edits':edits,'changed':changed,'skipped_service_endpoints':skipped_service,'remaining_unfixed':remaining}
Path('/tmp/html-relative-fix-report.json').write_text(json.dumps(report,indent=2,ensure_ascii=False),encoding='utf-8')
print(json.dumps({k:report[k] for k in ('html_files_scanned','changed_files','edits')},ensure_ascii=False))
print('service_endpoints',len(skipped_service),'remaining',len(remaining))
if remaining:
    for r in remaining[:30]:print(r,file=sys.stderr)
    raise SystemExit(2)

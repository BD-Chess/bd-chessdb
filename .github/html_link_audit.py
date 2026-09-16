from pathlib import Path
import re, json

ROOT=Path('public')
HTML=list(ROOT.rglob('*.html'))+list(ROOT.rglob('*.htm'))
ATTR_RE=re.compile(r'''(?P<attr>href|src|action|poster|formaction)\s*=\s*(?P<q>["'])(?P<url>.*?)(?P=q)''',re.I)
ABS_HOST_RE=re.compile(r'^https?://(?:www\.)?mdlxdcc\.org(?P<path>/[^?#]*)?(?P<suffix>[?#].*)?$',re.I)
CSS_ROOT_RE=re.compile(r'url\(\s*(["\']?)(/[^)"\']+)\1\s*\)',re.I)
JS_ROOT_RE=re.compile(r'''(?:fetch|location\.(?:assign|replace)|window\.open|new\s+URL)\s*\(\s*(["'])(/[^"']+)\1''',re.I)
META_TAG_RE=re.compile(r'<(?:link|meta)\b[^>]*>',re.I)
JSONLD_RE=re.compile(r'<script\b[^>]*type=["\']application/ld\+json["\'][^>]*>[\s\S]*?</script>',re.I)
PROTECTED_MARKERS=('data-8z-blob','8Z SHIELD','bd-password-manager','bd-owner','shield-inline','protected')

records=[]
for p in sorted(set(HTML)):
    text=p.read_text(encoding='utf-8',errors='replace')
    lines=text.splitlines()
    protected=any(m.lower() in text.lower() for m in PROTECTED_MARKERS)
    for i,line in enumerate(lines,1):
        for m in ATTR_RE.finditer(line):
            u=m.group('url').strip()
            kind=None
            mm=ABS_HOST_RE.match(u)
            if mm:
                # SEO metadata is intentionally absolute and reported separately.
                tag_start=line.rfind('<',0,m.start())
                tag_end=line.find('>',m.end())
                tag=line[tag_start:tag_end+1] if tag_start>=0 and tag_end>=0 else ''
                relcanon=bool(re.search(r'rel\s*=\s*["\'][^"\']*canonical',tag,re.I))
                meta=tag.lower().startswith('<meta') or relcanon
                kind='same_domain_metadata' if meta else 'same_domain_attribute'
            elif u.startswith('/') and not u.startswith('//'):
                kind='root_relative_attribute'
            if kind:
                records.append({'file':p.as_posix(),'line':i,'kind':kind,'attr':m.group('attr').lower(),'url':u,'protected':protected})
        for m in CSS_ROOT_RE.finditer(line):
            records.append({'file':p.as_posix(),'line':i,'kind':'root_relative_css','attr':'url()','url':m.group(2),'protected':protected})
        for m in JS_ROOT_RE.finditer(line):
            records.append({'file':p.as_posix(),'line':i,'kind':'root_relative_js_call','attr':'js','url':m.group(2),'protected':protected})

from collections import Counter, defaultdict
by_kind=Counter(r['kind'] for r in records)
by_file=defaultdict(list)
for r in records: by_file[r['file']].append(r)
summary={
  'html_files_scanned':len(set(HTML)),
  'files_with_findings':len(by_file),
  'findings':len(records),
  'by_kind':dict(by_kind),
  'protected_files_with_findings':sum(1 for f,rs in by_file.items() if any(r['protected'] for r in rs)),
}
out={'summary':summary,'files':dict(by_file)}
Path('/tmp/html-link-audit.json').write_text(json.dumps(out,indent=2,ensure_ascii=False),encoding='utf-8')
md=['# HTML link audit','',f"Scanned **{summary['html_files_scanned']}** HTML/HTM files; **{summary['files_with_findings']}** files have findings; **{summary['findings']}** findings total.",'']
for k,v in sorted(by_kind.items()): md.append(f'- {k}: {v}')
md += ['', '## Files']
for f,rs in sorted(by_file.items()):
    md.append(f"\n### `{f}`" + (' — protected-like' if any(r['protected'] for r in rs) else ''))
    for r in rs[:100]: md.append(f"- L{r['line']} {r['kind']} `{r['attr']}` → `{r['url']}`")
    if len(rs)>100: md.append(f'- … {len(rs)-100} more')
Path('/tmp/html-link-audit.md').write_text('\n'.join(md)+'\n',encoding='utf-8')
print(json.dumps(summary,ensure_ascii=False))

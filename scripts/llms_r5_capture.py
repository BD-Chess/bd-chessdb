#!/usr/bin/env python3
"""Read-only, bounded first-party upstream recapture. No credentials or writes to upstream."""
import concurrent.futures as cf, datetime as dt, hashlib, json, pathlib, re, urllib.parse, urllib.request
OUT=pathlib.Path('r5-source-audit'); OUT.mkdir(exist_ok=True)
D=json.loads(pathlib.Path('public/llms/sources.json').read_text())
STAMP=dt.datetime.now(dt.timezone.utc).isoformat(); LIMIT=12_000_000
HEADERS={'User-Agent':'Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0','Accept':'application/json, text/html, text/csv, */*'}
def get(pair):
 sid,url=pair
 try:
  with urllib.request.urlopen(urllib.request.Request(url,headers=HEADERS),timeout=22) as r:
   b=r.read(LIMIT+1); ct=r.headers.get('Content-Type','')
   row={'source_id':sid,'url':url,'final_url':r.geturl(),'status':r.status,'content_type':ct,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest(),'checked_at':STAMP,'last_modified':r.headers.get('Last-Modified')}
   if len(b)<=LIMIT:
    name=hashlib.sha256(url.encode()).hexdigest()[:16]+'-'+sid+'.bin'; (OUT/name).write_bytes(b);row['file']=name
   else: row['truncated']=True
   return row
 except Exception as e:return {'source_id':sid,'url':url,'status':'ERROR','error':str(e)[:300],'checked_at':STAMP}
def unique(xs):return list(dict.fromkeys(xs))
pairs=[]
for s in D['accepted']:
 sid=s['source_id']; choices=[u for u in s.get('urls',[]) if isinstance(u,str) and re.match(r'^https://[a-zA-Z0-9.-]+/',u) and not any(x in u for x in (' (','{','}'))]
 data=[u for u in choices if re.search(r'(\.json|\.csv|\.yaml|\.yml|\.zip)(?:\?|$)|raw\.githubusercontent\.com',u,re.I)]
 pairs.extend((sid,u) for u in unique(data[:1]+choices[:1]))
 if sid=='arc_prize': pairs.extend((sid,'https://arcprize.org/media/data/leaderboard/v'+v+'.json') for v in ('1','2','3'))
 if sid=='artificial_analysis': pairs.append((sid,'https://artificialanalysis.ai/leaderboards/models'))
 if sid=='epoch_ai':pairs.append((sid,'https://epoch.ai/data/benchmark_data.zip'))
 if sid=='vals_ai':pairs.extend((sid,u) for u in choices if '/benchmarks/' in u and '_astro/' not in u)
 if sid=='terminal_bench': pairs.extend((sid,u) for u in choices if 'hub.harborframework.com' in u)
# Arena direct complete parquet files avoid 100+ row API requests.
for config in ('text','text_style_control','text_factuality','webdev','agent','agent_capability','agent_task_outcome','agent_tool_efficiency','agent_steerability','search','search_factuality'):
 pairs.append(('lmarena','https://huggingface.co/datasets/lmarena-ai/leaderboard-dataset/resolve/main/'+config+'/latest-00000-of-00001.parquet'))
pairs.append(('lmarena','https://huggingface.co/api/datasets/lmarena-ai/leaderboard-dataset'))
pairs=unique(pairs)
with cf.ThreadPoolExecutor(max_workers=10) as ex: rows=list(ex.map(get,pairs))
# Discover real current Vals assets from current benchmark pages.
v=[]
for r in rows:
 if r['source_id']=='vals_ai' and r.get('file') and '/benchmarks/' in r['url']:
  body=(OUT/r['file']).read_text(errors='replace')
  v.extend(('vals_ai',urllib.parse.urljoin('https://www.vals.ai',a)) for a in re.findall(r'/_astro/benchmark_view_[A-Za-z0-9_.-]+\.json',body))
with cf.ThreadPoolExecutor(max_workers=6) as ex: rows.extend(ex.map(get,unique(v)))
report={'schema':'ai8-llm-r5-probe-v1','date':STAMP[:10],'checked_at':STAMP,'source_count':len(D['accepted']),'probes':rows,'success_count':sum(r['status']==200 for r in rows),'error_count':sum(r['status']=='ERROR' for r in rows)}
(OUT/'probe-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
print(json.dumps({k:v for k,v in report.items() if k!='probes'}),flush=True)

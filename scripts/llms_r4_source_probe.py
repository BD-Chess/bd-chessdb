#!/usr/bin/env python3
"""Read-only independent upstream probe for LLM index source list, 2026-11-23.
No access tokens; does not alter existing published scores. Saves source checks
and source-data payloads as SHA-256-addressed evidence.
"""
import concurrent.futures
import datetime as dt
import hashlib
import json
import os
import pathlib
import re
import socket
import ssl
import urllib.error
import urllib.parse
import urllib.request

BASE=pathlib.Path("public/llms")
OUT=pathlib.Path("r4-source-audit")
OUT.mkdir(parents=True,exist_ok=True)
SOURCE=json.loads((BASE/"sources.json").read_text(encoding="utf-8"))
FSTAMP=dt.datetime.now(dt.timezone.utc).isoformat()
USER_AGENT="Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0"
MAX_BODY=8_000_000
HEADERS={"User-Agent": USER_AGENT,"Accept":"application/json, text/csv, text/html, application/yaml, text/plain;q=0.8"}
def select_urls(src):
  choices=[]
  for u in src.get("urls",[]):
    if not isinstance(u,str): continue
    parsed=urllib.parse.urlparse(u)
    if parsed.scheme!="https" or not parsed.netloc or parsed.username or parsed.password: continue
    if parsed.hostname in {"localhost","127.0.0.1","169.254.169.254"}: continue
    choices.append(u)
  data=[u for u in choices if re.search(r"(\.json|\.csv|\.yaml|\.yml)(?:\?|$)|raw\.githubusercontent\.com|datasets-server\.huggingface\.co",u,re.I)]
  result=list(dict.fromkeys(data[:1]+choices[:1]))
  target=src.get("source_id","")
  if target=="lmarena":
    result=[
      "https://datasets-server.huggingface.co/rows?dataset=lmarena-ai/leaderboard-dataset&config="+config+"&split=latest&offset="+str(offset)+"&length=100"
      for config,total in (("agent",100),("text_style_control",11400),("webdev",700))
      for offset in range(0,total,100)
    ]
  elif target=="vals_ai":
    pages=[u for u in choices if "/benchmarks/" in u]
    result=[]
    for page in pages:
      try:
        with urllib.request.urlopen(urllib.request.Request(page,headers=HEADERS),timeout=16) as res:
          body=res.read(2_000_000).decode("utf-8","replace")
        matches=re.findall(r'/_astro/benchmark_view_[A-Za-z0-9_.-]+\.json',body)
        result.extend(urllib.parse.urljoin("https://www.vals.ai",v) for v in matches)
      except Exception as exc:
        print("VALS_PAGE_ERROR",page,str(exc)[:100],flush=True)
    result=list(dict.fromkeys(result))
  return list(dict.fromkeys(result))
def probe(job):
  sid,u=job
  try:
    req=urllib.request.Request(u,headers=HEADERS)
    with urllib.request.urlopen(req,timeout=18,context=ssl.create_default_context()) as r:
      content=r.read(MAX_BODY+1)
      short=content[:MAX_BODY]
      hdr=dict(r.headers.items())
      ctype=hdr.get("Content-Type","")
      return {"source_id":sid,"url":u,"status":r.status,"final_url":r.geturl(),
              "content_type":ctype,"length":len(content),"truncated":len(content)>MAX_BODY,
              "sha256_sample":hashlib.sha256(short).hexdigest(),"etag":hdr.get("ETag"),
              "last_modified":hdr.get("Last-Modified"),"checked_at_utc":FSTAMP,
              "sample":short if not len(content)>MAX_BODY and (any(t in ctype.lower() for t in ["json","csv","yaml","text/plain","application/zip"]) or sid in {"artificial_analysis","vals_ai","terminal_bench","lmarena"}) else b""}
  except Exception as e:
    return {"source_id":sid,"url":u,"status":"ERROR","error":str(e)[:400],"checked_at_utc":FSTAMP,"sample":b""}
jobs=[(s["source_id"],u) for s in SOURCE.get("accepted",[]) if s["source_id"] in {"lmarena","vals_ai"} for u in select_urls(s)]
print("READ_ONLY_SOURCE_PROBES",len(jobs),"SOURCES",len(SOURCE.get("accepted",[])),flush=True)
with concurrent.futures.ThreadPoolExecutor(max_workers=12) as pool:
  rows=list(pool.map(probe,jobs))
saved=[]
for i,row in enumerate(rows):
  b=row.pop("sample",b"")
  if b and len(b)>0:
    filename=f"source-{i:03d}-{row['source_id']}.bin"
    path=OUT/filename
    path.write_bytes(b)
    row["payload_path"]=str(path)
    saved.append(filename)
report={
 "schema":"ai8-llm-source-probe-v1",
 "date":"2026-11-23",
 "at_utc":FSTAMP,
 "baseline_capture":SOURCE.get("fetched"),
 "source_count":len(SOURCE.get("accepted",[])),
 "probes_count":len(rows),
 "success_count":sum(isinstance(r.get("status"),int) and 200<=r["status"]<300 for r in rows),
 "error_count":sum(r["status"]=="ERROR" for r in rows),
 "snapshots_count":len(saved),
 "note":"A response check is NOT a verified refreshed leaderboard. Source values must be re-extracted and compared before scoring.",
 "probes":rows
}
(OUT/"probe-report.json").write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding="utf-8")
print(json.dumps({k:v for k,v in report.items() if k!="probes"}),flush=True)

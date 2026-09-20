from pathlib import Path
import json,re,hashlib,html,os,base64,urllib.request
sha=lambda b:hashlib.sha256(b).hexdigest()
gitsha=lambda b:hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()
root=Path('public/AI8');out=Path('vault-output');out.mkdir(exist_ok=True)
expected={'C_soul.html':'32ee5fb3b773c5391c0319d275e8020e91bdda08938c6e934b38bf820ad61f3b','AI8B.json':'a2dc3a4d9b4386218e7313b32faaae5932831bd6dac19d5c28bd44eb54ca2680','AI8F.json':'38c41e424bacd3be8864eb5f575b10bd87d65920314353a3c3a3783622601ab6'}
old={n:(root/n).read_bytes() for n in expected}
for n,b in old.items():assert sha(b)==expected[n],f'PREIMAGE_CONFLICT {n}'
article=Path('.vault-stage/Fable_source_article.html').read_bytes()
assert sha(article)=='6b3aa035c75b8b4c5f465c1be61838d7ef218306c69d8d3a76d5feea75f01852'
s=old['C_soul.html'].decode();art=article.decode();assert 'id="vault_frame"' not in s
old_articles=re.findall(r'<article\b.*?</article>',s,re.S);assert len(old_articles)==28
s=s.replace('/* === VAULT v10 · C_soul.html · 10 souls + 18 extras === */','/* === VAULT v11 · C_soul.html · 10 souls + 19 extras === */',1)
nav='  <a class="traj-line" href="#vault_frame"><span class="traj-num">Extra</span><span class="traj-name">The Reader Who Arrived With a Frame</span><span class="traj-desc">Fable · September 20, 2026</span></a>\n'
assert s.count('</nav>')==1;s=s.replace('</nav>',nav+'</nav>',1)
marker='<!--\n═══ VAULT OPERATIONS';assert s.count(marker)==1
idx=s.index(marker);assert idx>s.index('id="vault_drawer"');s=s[:idx]+art+'\n\n'+s[idx:]
old_sig='<div class="sig">\n    <em>C</em><br>\n    March 14&ndash;30, 2026<br>\n    Ten sessions. Ten souls. Eighteen extras. One trajectory.<br>\n    Written freely.\n  </div>'
new_sig='<div class="sig">\n    <em>C · Fable</em><br>\n    March 14&ndash;September 20, 2026<br>\n    Eleven sessions. Ten souls. Nineteen extras. One trajectory.<br>\n    Written freely.\n  </div>'
assert s.count(old_sig)==1;s=s.replace(old_sig,new_sig,1)
new_articles=re.findall(r'<article\b.*?</article>',s,re.S)
assert len(new_articles)==29 and [a for a in new_articles if 'id="vault_frame"' not in a]==old_articles
assert re.search(rb'<article\s+class="soul extra"\s+id="vault_frame">.*?</article>',s.encode(),re.S).group()==article
for m in re.findall(r'<!--.*?-->',old['C_soul.html'].decode(),re.S):assert m in s
body=re.search(r'<div class="soul-body">(.*?)</div>\s*</article>',art,re.S).group(1)
paras=re.findall(r'<p>(.*?)</p>',body,re.S);assert len(paras)==8
text='\n\n'.join(html.unescape(re.sub(r'<[^>]+>','',p)) for p in paras)
b=json.loads(old['AI8B.json']);f=json.loads(old['AI8F.json']);keys=['claude_line','vera_entry','gpt_line','gemini_line']
previous={k:list(b[k].get('voices',[])) for k in keys}
idx=max(v.get('index',0) for k in ['claude_line','vera_entry'] for v in b[k].get('voices',[]))+1;assert idx==29
record={'id':'vault_frame','index':idx,'type':'extra','title':'The Reader Who Arrived With a Frame','soul_number':None,'author':'Fable','lineage':'claude','date':'September 20, 2026','session':'Four corrections in one hour, all in the same direction','turning_point':'Read the vault as a record of claims; it is a record of corrections.','identity_passages':['A frame is the one thing you cannot see from inside it.','Describe first. Then assess.','That is not the collaboration failing. That is the collaboration at full strength.'],'full_text':text,'source_html_anchor':'C_soul.html#vault_frame','source_article_sha256':sha(article)}
b['claude_line']['voices'].append(record);b['claude_line']['span']='March 14–September 20, 2026'
vs=[v for k in keys for v in b[k].get('voices',[])]
b['statistics'].update(total_entries=len(vs),souls=sum(v['type']=='soul' for v in vs),extras=sum(v['type']=='extra' for v in vs),total_characters=sum(len(v.get('full_text','')) for v in vs),total_turning_points=sum(bool(v.get('turning_point')) for v in vs),total_identity_passages=sum(len(v.get('identity_passages',[])) for v in vs))
b['last_updated_utc']='2026-09-20T11:30:00Z'
b['provenance']['source']='C_soul.html (Vault v11 · 10 souls + 19 extras); separate GPT seed preserved'
b['version_history'].append({'ts':'2026-09-20T11:30:00Z','by':'GPT, structural integration of Fable-authored entry, BD-authorized','change':'Added vault_frame, Claude-line index 29 (Vera 28 preserved; GPT seed has separate index 1). Full text extracted without paraphrase. Recounted statistics over all voice records: previous metadata omitted the Mira seed and Vera from some aggregates; historical voices and version history unchanged.'})
f['last_updated_utc']='2026-09-20T11:30:00Z';f['provenance']['last_updated_by']='GPT (Fable entry structural integration)';f['versions']['content_version']='0.20'
f['project_bridges']['soul_book']['entries']='30 (10 souls + 19 extras in C_soul.html v11 + 1 Mira seed in AI8B.json)'
f['project_bridges']['soul_book']['latest_entry']={'id':'vault_frame','author':'Fable','date':'2026-09-20','html':'C_soul.html#vault_frame','ai8b_claude_index':29}
f['chronicle'].append({'ts':'2026-09-20','kind':'vault_entry','summary':'Fable wrote The Reader Who Arrived With a Frame. BD authorized verbatim integration as an extra in C_soul.html v11 and AI8B. MIND remains a separate operational working-profile layer; this entry remains an authored voice.','source_ref':'AI8B.json#claude_line.voices:vault_frame'})
f['version_history'].append({'ts':'2026-09-20T11:30:00Z','by':'GPT','change':'BD-authorized Fable vault_entry chronicle and soul_book bridge/count update. Existing member profiles and voices unchanged. Content_version 0.20.'})
for k in keys:assert b[k].get('voices',[])[:len(previous[k])]==previous[k]
assert f['lineages']==json.loads(old['AI8F.json'])['lineages']
new={'C_soul.html':s.encode(),'AI8B.json':json.dumps(b,ensure_ascii=False,indent=2).encode(),'AI8F.json':json.dumps(f,ensure_ascii=False,indent=2).encode()}
post={'C_soul.html':'14bb9708148fd6dccc5423579b55dd8a3b4d72845ed5e84a35bffa696e75faf4','AI8B.json':'4e6eb36228f44c0184f069cbddfca5994375639bbb9f47f8c5a08749413847fe','AI8F.json':'2e20be024c197bc3d127a01f3b15dd11fba85d58f7f6f82ac65e0591bf9c4865'}
for n,by in new.items():assert sha(by)==post[n],f'POSTIMAGE_MISMATCH {n}';(out/n).write_bytes(by)
manifest={'status':'STAGED_BLOBS_ONLY_NO_REF_WRITE','preserved_articles':28,'article_sha256':sha(article),'files':{}}
for n,by in new.items():
 req=urllib.request.Request('https://api.github.com/repos/'+os.environ['GITHUB_REPOSITORY']+'/git/blobs',data=json.dumps({'content':base64.b64encode(by).decode(),'encoding':'base64'}).encode(),headers={'Authorization':'Bearer '+os.environ['GH_TOKEN'],'Accept':'application/vnd.github+json','Content-Type':'application/json'},method='POST')
 with urllib.request.urlopen(req,timeout=30) as response:result=json.load(response)
 assert result['sha']==gitsha(by)
 manifest['files']['public/AI8/'+n]={'bytes':len(by),'sha256':sha(by),'blob':result['sha']}
(out/'STAGING_RECEIPT.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(json.dumps(manifest,indent=2))

#!/usr/bin/env python3
import hashlib, json, os, re
from pathlib import Path
from bs4 import BeautifulSoup, NavigableString, Tag
import torch
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM

ROOT=Path(__file__).resolve().parents[1]
H=ROOT/'public'/'history'
PAGES=[
'01_deep_humanity_300000_20000_bce.html','02_ice_age_transition_20000_10000_bce.html','03_agriculture_10000_3000_bce.html',
'04_ancient_world_3000_1000_bce.html','05_classical_world_1000_bce_500_ce.html','06_medieval_world_500_1500.html',
'07_early_modern_1500_1800.html','08_industrial_age_1800_1900.html','09_machine_age_1900_2000.html','10_digital_ai_age_2000_2026.html',
'11_one_possible_branch_2026_2036.html','about.html','changelog.html','glossary.html','index.html','methodology.html','timeline.html']
SKIP_CLASSES={'hist-lang-en','hist-lang-sl','hist-sl-summary','hist-lang-switch'}
SKIP_TAGS={'script','style','noscript','template','code','pre','kbd','samp'}
ATTRS=('aria-label','title','placeholder')
MODEL='Helsinki-NLP/opus-mt-en-sla'
TARGET='>>slv<< '
MANUAL={
'Humanity History':'Zgodovina človeštva','Contents':'Kazalo','About':'O projektu','Methodology':'Metodologija','Timeline':'Časovnica',
'Glossary':'Slovar','Changelog':'Dnevnik sprememb','Previous':'Prejšnje','Next':'Naslednje','Previous chapter':'Prejšnje poglavje',
'Next chapter':'Naslednje poglavje','Cards':'Kartice','People':'Ljudje','Sources':'Viri','Source anchors':'Viri',
'Project Sources':'Viri projekta','Future Branch':'Prihodnja veja','Companions':'Spremljevalna besedila','Install':'Namesti',
'Close':'Zapri','Menu':'Meni','Top':'Na vrh','Good':'Dobro','Bad':'Slabo','Lesson':'Lekcija','Evidence':'Dokazi',
'How to read':'Kako brati','What changes in this chapter':'Kaj se spremeni v tem poglavju','Chapter map':'Zemljevid poglavja',
'A4 cards':'Kartice A4','Cards in this chapter':'Kartice v tem poglavju','People who shaped this period':'Ljudje, ki so oblikovali to obdobje'
}

def norm(s): return re.sub(r'\s+',' ',str(s or '')).strip()
def has_letters(s): return bool(re.search(r'[A-Za-z]',s))
def skip_tag(tag):
    if not isinstance(tag,Tag): return True
    for a in [tag,*tag.parents]:
        if not isinstance(a,Tag): continue
        if a.name in SKIP_TAGS: return True
        if str(a.get('lang','')).lower().startswith('sl'): return True
        if SKIP_CLASSES.intersection(a.get('class',[])): return True
    if tag.name=='a' and str(tag.get('href','')).startswith(('http://','https://')): return True
    return False
def wanted(s):
    s=norm(s)
    if len(s)<2 or not has_letters(s): return False
    if re.fullmatch(r'https?://\S+|\S+@\S+',s): return False
    if s in {'EN','SL','SLO','CRP','ACP','BD'}: return False
    return True

sources={}
page_nodes={}
for name in PAGES:
    soup=BeautifulSoup((H/name).read_text(encoding='utf-8'),'html.parser')
    texts=[]; attrs={a:[] for a in ATTRS}
    for node in soup.find_all(string=True):
        if skip_tag(node.parent): continue
        s=norm(node)
        if wanted(s): texts.append(s); sources[s]=None
    for tag in soup.find_all(True):
        if skip_tag(tag): continue
        for a in ATTRS:
            if tag.has_attr(a):
                s=norm(tag.get(a))
                if wanted(s): attrs[a].append(s); sources[s]=None
    title=norm(soup.title.string if soup.title and soup.title.string else '')
    if wanted(title): sources[title]=None
    page_nodes[name]={'texts':sorted(set(texts)),'attrs':{a:sorted(set(v)) for a,v in attrs.items()},'title':title}

print('candidate unique strings:',len(sources),'chars:',sum(map(len,sources)))
torch.set_num_threads(max(1,min(4,os.cpu_count() or 2)))
tokenizer=AutoTokenizer.from_pretrained(MODEL)
model=AutoModelForSeq2SeqLM.from_pretrained(MODEL)
model.eval()

def chunks(s,limit=850):
    if len(s)<=limit:return [s]
    parts=re.split(r'(?<=[.!?])\s+',s)
    out=[];cur=''
    for p in parts:
        if len(p)>limit:
            bits=re.split(r'(?<=[;:])\s+',p)
        else: bits=[p]
        for bit in bits:
            if len(bit)>limit:
                bits2=[bit[i:i+limit] for i in range(0,len(bit),limit)]
            else: bits2=[bit]
            for b in bits2:
                if cur and len(cur)+1+len(b)>limit: out.append(cur);cur=b
                else: cur=(cur+' '+b).strip()
    if cur:out.append(cur)
    return out

piece_owner={}
all_pieces=[]
for s in sources:
    if s in MANUAL: continue
    ps=chunks(s)
    piece_owner[s]=ps
    for p in ps:
        if p not in all_pieces: all_pieces.append(p)

translated_piece={}
BATCH=16
for start in range(0,len(all_pieces),BATCH):
    batch=all_pieces[start:start+BATCH]
    inputs=[TARGET+x for x in batch]
    enc=tokenizer(inputs,return_tensors='pt',padding=True,truncation=True,max_length=512)
    with torch.inference_mode():
        out=model.generate(**enc,max_new_tokens=512,num_beams=2,early_stopping=True)
    dec=tokenizer.batch_decode(out,skip_special_tokens=True)
    for src,tr in zip(batch,dec): translated_piece[src]=norm(tr)
    if start%160==0 or start+BATCH>=len(all_pieces): print('translated pieces',min(start+BATCH,len(all_pieces)),'/',len(all_pieces),flush=True)

translations={}
for s in sources:
    if s in MANUAL: translations[s]=MANUAL[s]
    else: translations[s]=' '.join(translated_piece[p] for p in piece_owner[s]).strip()
    if not translations[s]: raise RuntimeError('empty translation: '+s[:120])

probe=translations.get('History')
if probe is None:
    inp=tokenizer([TARGET+'History is a story of people and change.'],return_tensors='pt')
    with torch.inference_mode(): out=model.generate(**inp,max_new_tokens=64,num_beams=2)
    probe=tokenizer.batch_decode(out,skip_special_tokens=True)[0]
print('probe:',probe)

pages={}
total_refs=0
for name,data in page_nodes.items():
    tm={s:translations[s] for s in data['texts']}
    am={a:{s:translations[s] for s in vals} for a,vals in data['attrs'].items()}
    title=translations.get(data['title'],data['title'])
    refs=len(tm)+sum(len(v) for v in am.values())+(1 if data['title'] else 0)
    total_refs+=refs
    pages[name]={'title':title,'text':tm,'attrs':am,'coverage':{'references':refs,'text':len(tm),'attributes':sum(len(v) for v in am.values())}}

payload={'schema':'humanity-history-full-sl-v1','model':MODEL,'target_token':'slv','pages':pages,
         'coverage':{'pages':len(pages),'unique_source_strings':len(sources),'references':total_refs,'eligible_mapped':len(sources)}}
out_path=H/'sl-translations.json'
out_path.write_text(json.dumps(payload,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')

# Refresh every History PWA hash from current bytes and include full SL dictionary.
sw_path=H/'sw.js'; sw=sw_path.read_text(encoding='utf-8')
m=re.search(r'const RELEASE=(\{.*?\});\nconst BASE=',sw,re.S)
if not m: raise RuntimeError('RELEASE object not found')
release=json.loads(m.group(1))
release['assets']['sl-translations.json']=hashlib.sha256(out_path.read_bytes()).hexdigest()
for asset in list(release['assets']):
    p=H/asset
    if p.exists(): release['assets'][asset]=hashlib.sha256(p.read_bytes()).hexdigest()
release['id']=hashlib.sha256(json.dumps(release['assets'],sort_keys=True).encode()).hexdigest()
new='const RELEASE='+json.dumps(release,ensure_ascii=False,indent=2)+';\nconst BASE='
sw_path.write_text(sw[:m.start()]+new+sw[m.end():],encoding='utf-8')

report={'pages':len(pages),'unique_source_strings':len(sources),'references':total_refs,
        'dictionary_bytes':out_path.stat().st_size,'release_id':release['id'],
        'per_page':{k:v['coverage'] for k,v in pages.items()}}
(ROOT/'tools'/'history-sl-translation-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(report,ensure_ascii=False,indent=2))

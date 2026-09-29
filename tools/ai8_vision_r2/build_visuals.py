#!/usr/bin/env python3
"""AI8 Lab visual family R2. One content source; two languages, themes and layouts.
Generates self-contained SVG and WebP. Does not read private data or change any page.
"""
from pathlib import Path
import hashlib, html, io, json
from PIL import Image, ImageFont
import cairosvg

REV = '20260929-r2'
CONTENT = {
 'sl': {
  'title':['Od projektov do','živega laboratorija.'],
  'subtitle':'En človek. AI sodelavci. Znanje, ki se ohranja in nadgrajuje.',
  'vision':'RAZVOJNA VIZIJA', 'stages':[
   ['Danes',['BD + GPT + Claude vodimo projekte.','TSP, Sudoku, ChessBest, Trip in splet.','BD povezuje delo med sejami.'],'Temelji in izkušnje'],
   ['Prvi WL runtime',['Python na HOME in WORK.','Inbox ukazi, rezultati na Drive.','LE_START / LE_CHECK','8zCockpit kot izvajalec.'],'Zanesljiva izvedba'],
   ['Povezan laboratorij',['GPT / Claude kot arhitekta.','Codex in Claude Code kot delavca.','Spomin, pogovori in dokazila.','Več hostov, manj ročnega prenosa.'],'Kontinuiteta in sodelovanje'],
   ['Projektni multiplikator',['Nove arene in orodja.','TSP → Trip prenosi.','ChessBest: Top Picks in DCC.','Gradnja → testi → izboljšava.'],'Učinek se množi'],
   ['Živ AI8 Lab',['Usklajuje delo med gradniki.','Predlaga, gradi, testira, izboljšuje.','Razvija projekte in sebe.','BD ostaja partner in usmerjevalec.'],'Odprta razvojna pot']],
  'potential':'Potencial kopičenja učinkov', 'now':'DANES', 'future':'SKOZI ČAS →',
  'loops':'Dve zanki. Skupno učenje.',
  'steps':['Naloga','Izvedba','Dokazi','Analiza','Izboljšava','Nov tek'],
  'project':'Boljši projekti', 'lab':'Boljši način dela laboratorija',
  'footer':'Iste ideje. Več možnosti. Večji učinek.',
  'note':'Ilustrativna pot in potencial — ne izmerjena rast ali časovna napoved.',
  'alt':'Pet korakov BD × AI Lab: od današnjih projektov prek lokalnega izvajanja in povezanega sodelovanja do laboratorija, ki razvija projekte in sebe.'
 },
 'en': {
  'title':['From projects to','a living laboratory.'],
  'subtitle':'One person. AI collaborators. Knowledge that endures and grows.',
  'vision':'A DEVELOPMENT VISION', 'stages':[
   ['Today',['BD + GPT + Claude lead projects.','TSP, Sudoku, ChessBest, Trip and the web.','BD connects the work across sessions.'],'Foundations and experience'],
   ['First WL runtime',['Python on HOME and WORK.','Inbox commands, results on Drive.','LE_START / LE_CHECK','8zCockpit as the executor.'],'Reliable execution'],
   ['Connected laboratory',['GPT / Claude as architects.','Codex and Claude Code as workers.','Memory, dialogue and evidence.','More hosts, less manual handover.'],'Continuity and collaboration'],
   ['Project multiplier',['New arenas and tools.','TSP → Trip ports.','ChessBest: Top Picks and DCC.','Build → test → improve.'],'Impact compounds'],
   ['Living AI8 Lab',['Coordinates work across components.','Proposes, builds, tests, improves.','Develops projects and itself.','BD remains a partner and guide.'],'An open-ended path']],
  'potential':'Potential for compounding impact', 'now':'TODAY', 'future':'THROUGH TIME →',
  'loops':'Two loops. Shared learning.',
  'steps':['Task','Execute','Evidence','Analyse','Improve','Next run'],
  'project':'Better projects', 'lab':'A better way for the Lab to work',
  'footer':'Same ideas. More possibilities. Greater impact.',
  'note':'An illustrative path and potential — not measured growth or a time forecast.',
  'alt':'Five stages of BD × AI Lab: from today’s projects through local execution and connected collaboration to a laboratory developing both projects and itself.'
 }
}
PALETTES = {
 'light':dict(bg='#f3f6f4',ink='#18323a',muted='#52666b',line='#cfddda',card='#ffffff',mount=['#dfeae6','#ccded7','#b8d0c8'],sky='#e1ece8',soft='#e9f1ed',acc=['#687e90','#2076a0','#24816e','#98702c','#367e51']),
 'dark':dict(bg='#101c24',ink='#edf3f2',muted='#b1c7ca',line='#334852',card='#1a2c35',mount=['#1c303b','#253e46','#2c4a50'],sky='#20333a',soft='#172a32',acc=['#a3b8c8','#7ebde1','#76c6b6','#e3bd73','#a1d2a3'])
}
FONT='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
BOLD='/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
def font(size,bold=False): return ImageFont.truetype(BOLD if bold else FONT,round(size*10))
def wrap(text,size,width,bold=False):
 f=font(size,bold);lines=[];line=''
 for word in text.split():
  trial=(line+' '+word).strip()
  if line and f.getlength(trial)/10>width: lines.append(line);line=word
  else: line=trial
 if line: lines.append(line)
 return lines

def make_svg(lang,theme,mobile):
 c=CONTENT[lang];p=PALETTES[theme];w,h=(480,1900) if mobile else (1800,1120)
 out=[]
 def add(s): out.append(s)
 def text(x,y,lines,size=24,weight=400,fill=None,lh=None,anchor='start',spacing=None):
  if isinstance(lines,str):lines=[lines]
  extra=f' letter-spacing="{spacing}"' if spacing is not None else ''
  add(f'<text x="{x}" y="{y}" fill="{fill or p["ink"]}" font-size="{size}" font-weight="{weight}" text-anchor="{anchor}"{extra}>')
  for i,line in enumerate(lines):add(f'<tspan x="{x}" dy="{0 if i==0 else (lh or size*1.3)}">{html.escape(line)}</tspan>')
  add('</text>');return y+max(0,len(lines)-1)*(lh or size*1.3)
 def rect(x,y,ww,hh,fill,rx=20,stroke=None):add(f'<rect x="{x}" y="{y}" width="{ww}" height="{hh}" rx="{rx}" fill="{fill}"'+(f' stroke="{stroke}"' if stroke else '')+'/>')
 def icon(k,x,y,color,size=34):
  shapes=[
   '<circle cx="16" cy="8" r="4"/><path d="M7 27v-4a9 9 0 0 1 18 0v4Z"/>',
   '<rect x="3" y="4" width="26" height="18" rx="3"/><path d="M10 28h12M16 22v6M8 10l4 3-4 3M17 16h7"/>',
   '<circle cx="16" cy="6" r="3"/><circle cx="6" cy="25" r="3"/><circle cx="26" cy="25" r="3"/><circle cx="16" cy="16" r="3"/><path d="M16 9v4M14 18l-6 5M18 18l6 5M9 25h14"/>',
   '<path d="M5 28V19h5v9M14 28V12h5v16M23 28V4h5v24M3 28h28"/>',
   '<path d="M16 16C8-1 1 7 3 16s10 9 13 0c8-17 15-9 13 0s-10 9-13 0Z"/>'
  ]
  add(f'<g transform="translate({x},{y}) scale({size/32})" fill="none" stroke="{color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">{shapes[k]}</g>')
 add(f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}" role="img" aria-labelledby="title desc" lang="{lang}">')
 add(f'<title id="title">BD × AI Lab / AI8 — {html.escape(" ".join(c["title"]))}</title><desc id="desc">{html.escape(c["alt"]+" "+c["note"])}</desc>')
 add('<defs><linearGradient id="path" x1="0" y1="1" x2="1" y2="0"><stop stop-color="'+p['acc'][1]+'"/><stop offset="1" stop-color="'+p['acc'][4]+'"/></linearGradient></defs>')
 add('<g font-family="DejaVu Sans, sans-serif">');rect(0,0,w,h,p['bg'],0)
 # Hand-built landscape geometry: decorative, without numerical performance data.
 mx,my,mw,mh=(270,35,235,167) if mobile else (1130,0,670,245)
 add(f'<g transform="translate({mx},{my}) scale({mw/670},{mh/245})" opacity="{.38 if mobile else .85}">')
 add(f'<circle cx="440" cy="65" r="53" fill="{p["sky"]}"/>')
 add(f'<path d="M0 245 60 204 122 214 180 128 220 161 270 104 312 135 380 62 408 104 455 15 523 102 552 67 607 152 670 134 670 245Z" fill="{p["mount"][0]}"/>')
 add(f'<path d="M0 245 89 222 156 185 187 199 266 155 314 181 382 116 423 151 455 15 479 152 532 114 581 176 614 139 670 193 670 245Z" fill="{p["mount"][1]}"/>')
 add(f'<path d="M0 245 166 222 212 236 295 195 339 214 389 182 449 222 511 185 546 201 609 158 670 195 670 245Z" fill="{p["mount"][2]}"/>')
 add(f'<path d="m423 151 32-136 24 137-27-41Z" fill="{p["bg"]}" opacity=".55"/>')
 add('</g>')
 if mobile:
  text(28,39,'BD × AI LAB / AI8',16,700,p['muted'],spacing=1.2)
  text(28,86,c['title'],34,700,lh=43)
  text(28,168,wrap(c['subtitle'],18,415),18,400,p['muted'],lh=26)
  text(28,231,c['vision'],12,700,p['acc'][2],spacing=1.6)
  add(f'<path d="M43 276V1511" stroke="{p["acc"][2]}" stroke-width="2" fill="none" stroke-dasharray="4 8"/>')
  for i,(title,bullets,caption) in enumerate(c['stages']):
   x,y,cw,ch=74,252+i*262,378,247;a=p['acc'][i]
   rect(x,y,cw,ch,p['card'],19,p['line']);rect(x,y+22,3,36,a,1)
   add(f'<circle cx="43" cy="{y+30}" r="17" fill="{p["bg"]}" stroke="{a}" stroke-width="2"/>');text(43,y+36,str(i+1),16,700,a,anchor='middle')
   titlelines=wrap(title,23.5,cw-100,True)
   bottom=text(x+22,y+36,titlelines,23.5,700,lh=29)
   icon(i,x+cw-51,y+23,a,29)
   yy=bottom+30
   for bullet in bullets:
    lines=wrap(bullet,19.5,cw-55)
    add(f'<circle cx="{x+23}" cy="{yy-6}" r="2.5" fill="{a}"/>')
    yy=text(x+36,yy,lines,19.5,fill=p['muted'],lh=25)+28
   assert yy-28<=y+ch-17,(lang,title,yy,y+ch)
  text(28,1620,c['loops'],25,700)
  for i,t in enumerate(c['steps']):
   xx=28+(i%3)*146; yy=1643+(i//3)*58
   rect(xx,yy,132,42,p['soft'],11,p['line']);text(xx+66,yy+27,t,17,600,p['ink'],anchor='middle')
   if i%3<2:text(xx+139,yy+27,'›',17,400,p['muted'],anchor='middle')
  add(f'<path d="M433 1688v12H22v49q0 7 7 7h378" fill="none" stroke="{p["line"]}" stroke-width="1.5"/>')
  text(28,1778,c['project']+'  ↔',17,700,p['acc'][1]);text(28,1803,c['lab'],17,700,p['acc'][2])
  text(28,1850,wrap(c['note'],13,420),13,400,p['muted'],lh=20)
 else:
  text(64,59,'BD × AI LAB / AI8',21,700,p['muted'],spacing=2)
  text(64,129,c['title'],57,700,lh=68)
  text(66,244,c['subtitle'],25,400,p['muted'])
  text(1736,270,c['vision'],16,700,p['acc'][2],anchor='end',spacing=2)
  for i,(title,bullets,caption) in enumerate(c['stages']):
   x,y,cw,ch=64+i*338,300,316,430;a=p['acc'][i]
   rect(x,y,cw,ch,p['card'],23,p['line']);rect(x+24,y+22,52,5,a,2)
   text(x+24,y+66,f'0{i+1}',24,700,a);icon(i,x+cw-59,y+39,a,32)
   titlelines=wrap(title,27,cw-44,True)
   text(x+24,y+112,titlelines,27,700,lh=34)
   yy=y+177
   for bullet in bullets:
    lines=wrap(bullet,22,cw-60)
    add(f'<circle cx="{x+25}" cy="{yy-7}" r="3" fill="{a}"/>')
    yy=text(x+40,yy,lines,22,fill=p['muted'],lh=29)+38
   assert yy-38<y+ch-10,(lang,title,yy,y+ch)
   text(x+cw/2,887,wrap(caption,18,cw-15,True),18,700,p['muted'],lh=24,anchor='middle')
  # Future path is dashed, qualitative and deliberately uncalibrated.
  add(f'<path d="M64 863H1736" stroke="{p["line"]}" stroke-width="1.5" fill="none"/>')
  add('<path d="M82 850 Q156 848 222 845" stroke="url(#path)" stroke-width="5" fill="none"/>')
  add('<path d="M222 845 C350 842 427 834 560 830 S783 830 898 811 S1120 808 1236 785 S1512 782 1574 754 Q1650 751 1748 719" stroke="url(#path)" stroke-width="5" stroke-dasharray="10 8" fill="none"/>')
  for i,(x,y) in enumerate([(222,845),(560,830),(898,811),(1236,785),(1574,754)]):
   add(f'<path d="M{x} {y+12}V863" stroke="{p["line"]}" stroke-dasharray="3 5"/>')
   add(f'<circle cx="{x}" cy="{y}" r="11" fill="{p["acc"][i]}" stroke="{p["bg"]}" stroke-width="4"/>')
  text(80,774,c['potential'],22,600,p['acc'][2]);text(80,804,c['now']+'  →  '+c['future'],13,600,p['muted'],spacing=1)
  rect(64,931,1672,143,p['soft'],22,p['line'])
  text(90,971,c['loops'],27,700)
  # A single ordered experiment loop with two explicit beneficiaries.
  for i,t in enumerate(c['steps']):
   xx=90+i*180
   rect(xx,991,159,49,p['card'],12,p['line']);text(xx+79.5,1023,t,20,600,anchor='middle')
   if i<5:text(xx+170,1023,'→',21,400,p['muted'],anchor='middle')
  add(f'<path d="M1159 1041v9q0 9-9 9H102q-12 0-12-12v-7m-4 6 4-6 4 6" fill="none" stroke="{p["acc"][2]}" stroke-width="1.5"/>')
  text(1248,995,c['project'],21,700,p['acc'][1]);text(1248,1027,wrap(c['lab'],20,450),20,700,p['acc'][2],lh=25)
  text(64,1101,c['note'],16,400,p['muted']);text(1736,1101,'MDL×DCC · '+REV,14,500,p['muted'],anchor='end')
 add('</g></svg>');return '\n'.join(out)

def build(dest):
 dest=Path(dest);dest.mkdir(parents=True,exist_ok=True);assets={}
 for lang in CONTENT:
  for theme in PALETTES:
   for layout in ['desktop','mobile']:
    key=f'{lang}-{layout}-{theme}';name='ai8-lab-growth-'+key
    svg=make_svg(lang,theme,layout=='mobile');(dest/(name+'.svg')).write_text(svg,encoding='utf-8')
    width=1440 if layout=='mobile' else 2700
    png=cairosvg.svg2png(bytestring=svg.encode(),output_width=width)
    im=Image.open(io.BytesIO(png)).convert('RGB')
    im.save(dest/(name+'.webp'),'WEBP',quality=93,method=6)
    d=(dest/(name+'.webp')).read_bytes()
    assets[key]={'file':name+'.webp','svg':name+'.svg','width':im.width,'height':im.height,'bytes':len(d),'sha256':hashlib.sha256(d).hexdigest()}
 (dest/'manifest.json').write_text(json.dumps({'revision':REV,'assets':assets},indent=2)+'\n',encoding='utf-8')
 (dest/'content.json').write_text(json.dumps(CONTENT,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 return assets
if __name__=='__main__':
 import argparse
 a=argparse.ArgumentParser();a.add_argument('destination');args=a.parse_args();print(json.dumps(build(args.destination),indent=2))

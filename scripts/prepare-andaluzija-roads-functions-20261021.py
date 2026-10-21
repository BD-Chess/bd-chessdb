"""Overlay only the reviewed travel function onto the verified frozen packages."""
import json
import os
from pathlib import Path
import shutil

root=Path(os.environ['ALBUM_FROZEN_ROOT'])
for path in ['functions/andaluzija-ai.mjs','functions/lib/andaluzija-ai-knowledge.mjs','public/BD/O/izleti/andaluzija-page.mjs']:
 shutil.copy2(path,root/path)
for path in ['SKILL.md','references/actions.md','references/page-guide.md']:
 rel='public/ai/skills/andaluzija-2027-guide/'+path
 shutil.copy2(rel,root/rel)
reg=root/'public/ai/skills/registry.json'
old=json.loads(reg.read_text());new=json.loads(Path('public/ai/skills/registry.json').read_text())
entry,=[e for e in new['skills'] if e['id']=='andaluzija-2027-guide']
old['skills']=[entry if e['id']==entry['id'] else e for e in old['skills']]
reg.write_text(json.dumps(old,ensure_ascii=False,indent=2)+'\n')
print('Only the Andaluzija AI function overlay and its pinned public knowledge prepared.')

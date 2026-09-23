import json,hashlib
from pathlib import Path
h=lambda b:hashlib.sha256(b).hexdigest()
changes={}
for manifest in sorted(Path('.stage1').glob('*.json')):
 for e in json.loads(manifest.read_text()):
  p=Path(e['path']);assert not p.is_absolute() and '..' not in p.parts
  assert p.parts[0] in ['game','server','docs','tests','CLAUDE.md','HANDOFF.md']
  raw=p.read_bytes();assert h(raw)==e['before'],f'before mismatch {p}'
  text=raw.decode('utf-8')
  for start,end,insert in reversed(e['ops']):text=text[:start]+insert+text[end:]
  output=text.encode('utf-8');assert h(output)==e['after'],f'after mismatch {p}'
  changes[p]=output
for p,b in changes.items():p.write_bytes(b);print('Verified and applied',p)

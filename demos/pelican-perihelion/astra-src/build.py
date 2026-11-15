from pathlib import Path
import base64,re
src=Path(__file__).resolve().parent
root=src.parent
files=['rider','machine','world','track','shoal','film']
art='\n'.join((src/(name+'.js')).read_text() for name in files)
def escape(s): return re.sub(r'</script',r'<\\/script',s,flags=re.I)
page=(src/'player.html').read_text().replace('{{LIBRARY}}',escape((root/'qa/three.bundle.js').read_text())).replace('{{ART}}',escape(art))
audio=(root/'qa/score.m4a').read_bytes()
(root/'perihelion.html').write_text(page.replace('{{SCORE}}','data:audio/mp4;base64,'+base64.b64encode(audio).decode()))

"""Export this scene's data and embedded resources without executing Spline."""
from pathlib import Path
import sys,json,hashlib,base64,array,collections
sys.path.insert(0,str(Path(__file__).resolve().parent.parent))
import splineformat as s
base=Path('.cache/conversion').resolve()
assets=base/'dist/assets';assets.mkdir(exist_ok=True,parents=True)
root,info=s.read_scene(Path(sys.argv[1]) if len(sys.argv)>1 else base.parent/'scene.splinecode');view=s.SceneView(root)
def asset(raw,suffix):
    name=hashlib.sha256(raw).hexdigest()+'.'+suffix
    p=assets/name
    if not p.exists():p.write_bytes(raw)
    return 'assets/'+name
def convert(value,seen=None):
    value=view.unwrap(value)
    if isinstance(value,s.Extension):return {'extension':value.code,'value':convert(value.following)}
    if isinstance(value,(bytes,memoryview,bytearray)):
        return {'$asset':asset(bytes(value),s.media_suffix(value))}
    if isinstance(value,str) and value.startswith('data:') and ';base64,' in value[:256]:
        prefix,b64=value.split(',',1)
        return {'$asset':asset(base64.b64decode(b64),prefix.split('/')[1].split(';')[0]),'mimeType':prefix[5:].split(';')[0]}
    if isinstance(value,list):
        if len(value)>=128 and all(type(v) in (int,float) for v in value):
            if all(type(v) is int and -128<=v<=255 for v in value):
                raw=bytes(v&255 for v in value)
                if raw.startswith(b'DRACO'):return {'$draco':asset(raw,'drc')}
            a=array.array('d',value)
            if sys.byteorder!='little':a.byteswap()
            return {'$array':asset(a.tobytes(),'f64'),'length':len(value)}
        return [convert(v) for v in value]
    if isinstance(value,dict):return {k:convert(v) for k,v in value.items()}
    if isinstance(value,s.Map):return {'$map':[[convert(k),convert(v)] for k,v in value.pairs]}
    return value
document=convert(root)
(base/'dist/scene.json').write_text(json.dumps(document,separators=(',',':')))
print('exported',len(list(assets.iterdir())),'assets', (base/'dist/scene.json').stat().st_size,'JSON bytes')
scene=document['scene']; print('scene settings',json.dumps({k:v for k,v in scene.items() if k!='objects'})[:6000])
print('fonts',json.dumps(document['shared']['fonts'])[:6000])
pending=list(scene['objects']);samples={};events={};materials=[]
while pending:
 n=pending.pop();pending.extend(n.get('children',[]));d=n['data']
 if d.get('type') in ['Instance','Component','OrthographicCamera','DirectionalLight','Page'] and d['type'] not in samples:samples[d['type']]=d
 if d.get('geometry',{}).get('type')=='TextGeometry' and 'TextGeometry' not in samples:samples['TextGeometry']=d
 for e in d.get('events') or []:
  events.setdefault(e['data']['type'],e['data'])
 if d.get('material') and len(materials)<2:materials.append(d['material'])
print('SAMPLES',json.dumps(samples)[:14000]);print('EVENTS',json.dumps(events)[:8000]);print('MATERIALS',json.dumps(materials)[:5000])

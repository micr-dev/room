"""Render original vs converted UV samplers with Mesa; never uses a browser."""
import json,sys,subprocess,io
from pathlib import Path
import moderngl,numpy as np
from PIL import Image,ImageDraw
base=Path(__file__).resolve().parent;dist=base.parent/'assets/runtime';ctx=moderngl.create_standalone_context(backend='egl');out=base/'renders';out.mkdir(exist_ok=True)
W,H=640,360
vs='''#version 330
in vec2 position;out vec2 rawUV;out vec3 localPosition;void main(){rawUV=position*.5+.5;localPosition=vec3(position.x,position.y,.5);gl_Position=vec4(position,0,1);}'''
vbo=ctx.buffer(np.array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1],dtype='f4').tobytes())
# Runtime uvTexture's exact sampling equation; matrix is built independently in Python.
reference='''vec2 uvs=(mat*vec3(rawUV*2.-1.,1.)/2.+0.5).xy;vec4 tmp=texture(tex,uvs);float lalpha=tmp.a;if(crop&&any(notEqual(clamp(uvs,0.,1.),uvs)))lalpha=0.;frag=vec4(tmp.rgb,lalpha);'''
def render(body,image,repeat,offset,rotation,crop,spec,video=False):
 program=ctx.program(vertex_shader=vs,fragment_shader='#version 330\nin vec2 rawUV;in vec3 localPosition;uniform sampler2D tex;uniform mat3 mat;uniform bool crop;out vec4 frag;void main(){'+body+'}')
 texture=ctx.texture(image.size,4,image.transpose(Image.Transpose.FLIP_TOP_BOTTOM).tobytes());texture.repeat_x=texture.repeat_y=spec.get('wrapping',1001)==1000;texture.filter=(moderngl.LINEAR if video else {1003:moderngl.NEAREST,1004:moderngl.NEAREST_MIPMAP_NEAREST,1005:moderngl.NEAREST_MIPMAP_LINEAR,1006:moderngl.LINEAR,1007:moderngl.LINEAR_MIPMAP_NEAREST,1008:moderngl.LINEAR_MIPMAP_LINEAR}.get(spec.get('minFilter',1008),moderngl.LINEAR_MIPMAP_LINEAR),moderngl.LINEAR if video else moderngl.NEAREST if spec.get('magFilter',1006)==1003 else moderngl.LINEAR);
 if not video:texture.build_mipmaps();
 texture.use(0);program['tex']=0
 if 'crop' in program:program['crop']=crop
 if 'mat' in program:
  r=np.deg2rad(rotation);c,s=np.cos(r),np.sin(r);R=np.array([[c,-s,0],[s,c,0],[0,0,1]],dtype='f4');S=np.array([[repeat[0],0,offset[0]],[0,repeat[1],offset[1]],[0,0,1]],dtype='f4');program['mat'].write((R@S).T.tobytes())
 target=ctx.texture((W,H),4);fbo=ctx.framebuffer(color_attachments=[target]);fbo.use();ctx.viewport=(0,0,W,H);ctx.vertex_array(program,[(vbo,'2f','position')]).render();pixels=np.frombuffer(fbo.read(components=4),dtype='u1').reshape(H,W,4)[::-1].copy();fbo.release();target.release();texture.release();program.release();return pixels
results=[];boards=[]
for case in json.loads((base/'../docs/verification/texture-cases.json').read_text()):
 path=dist/case['file'].removeprefix('assets/');spec=case['texture'];repeat=spec.get('repeat',[1,1]);offset=spec.get('offset',[0,0]);rotation=spec.get('rotation',0)
 if case['type']=='video':
  b=subprocess.check_output(['ffmpeg','-v','error','-i',str(path),'-frames:v','1','-f','image2pipe','-vcodec','png','-threads','1','-']);image=Image.open(io.BytesIO(b)).convert('RGBA')
 else:image=Image.open(path).convert('RGBA')
 ref=reference if case['projection']==0 else reference.replace('rawUV*2.-1.','vec2(atan(normalize(localPosition).z,normalize(localPosition).x)/6.283+0.5,asin(clamp(normalize(localPosition).y,-1.,1.))/3.1415+0.5)*2.-1.');actual_body='vec2 uvs='+case['glsl']+';vec4 tmp=texture(tex,uvs);float a=tmp.a;if(crop&&any(notEqual(clamp(uvs,0.,1.),uvs)))a=0.;frag=vec4(tmp.rgb,a);'
 if case['projection']==2:
  lod='vec2 df=fwidth(uvs);if(df.x>.5)df.x=0.;vec2 dimensions=vec2(textureSize(tex,0));vec4 tmp=textureLod(tex,uvs,log2(max(df.x,df.y)*min(dimensions.x,dimensions.y)));'
  ref=ref.replace('vec4 tmp=texture(tex,uvs);',lod);actual_body=actual_body.replace('vec4 tmp=texture(tex,uvs);',lod)
 expected=render(ref,image,repeat,offset,rotation,case['crop'],spec,case['type']=='video');actual=render(actual_body,image,repeat,offset,rotation,case['crop'],spec,case['type']=='video');delta=np.abs(actual.astype('i2')-expected.astype('i2'));maxerror=int(delta.max());differing=int(np.any(delta>0,axis=2).sum());results.append({'object':case['object'],'status':'pass' if maxerror<=1 else 'fail','max_channel_error':maxerror,'differing_pixels':differing,'pixels':W*H,'image_size':image.size})
 if case['object'] in ['gaming-folder-good.png','bg-full.png','others-folder-main.png']:
  board=Image.new('RGB',(W*2,H+30),'#222222');board.paste(Image.fromarray(expected).convert('RGB'),(0,30));board.paste(Image.fromarray(actual).convert('RGB'),(W,30));d=ImageDraw.Draw(board);d.text((12,8),'Original UV sampler: '+case['object'],fill='white');d.text((W+12,8),'Corrected Three.js UV sampler',fill='white');boards.append(board)
summary={'backend':ctx.info['GL_RENDERER'],'tested':sum(x['status']!='not_checked' for x in results),'passed':sum(x['status']=='pass' for x in results),'failed':sum(x['status']=='fail' for x in results),'not_checked':sum(x['status']=='not_checked' for x in results),'scope':'Isolated UV sampling; not full-scene or browser parity','cases':results};(base/'../docs/verification/texture-render-results.json').write_text(json.dumps(summary,indent=2));print(json.dumps({k:v for k,v in summary.items() if k!='cases'},indent=2))
if boards:
 montage=Image.new('RGB',(W*2,len(boards)*(H+30)));[montage.paste(b,(0,i*(H+30))) for i,b in enumerate(boards)];montage.save(out/'texture-comparison.png')
if summary['failed']:sys.exit(1)

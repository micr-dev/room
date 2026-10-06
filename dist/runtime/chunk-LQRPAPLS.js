import"./chunk-JVHWUGXG.js";var a=class{constructor(e,t={}){this.sourceCanvas=e,this.options={scanlineIntensity:t.scanlineIntensity??.4,scanlineCount:t.scanlineCount??730,barrelDistortion:t.barrelDistortion??.22,keystoneX:t.keystoneX??0,keystoneY:t.keystoneY??0,crtZoom:t.crtZoom??.82,fitStrength:t.fitStrength??.82,keystoneFit:t.keystoneFit??.06,borderCutoff:t.borderCutoff??0,vignetteIntensity:t.vignetteIntensity??.65,chromaticAberration:t.chromaticAberration??.002,moireStrength:t.moireStrength??1,noiseIntensity:t.noiseIntensity??.1,staticSpeed:t.staticSpeed??10,staticContrast:t.staticContrast??1,brightness:t.brightness??1.15,contrast:t.contrast??1.08,saturation:t.saturation??1.05,curveAmount:t.curveAmount??.08,...t},this.enabled=!0,this.time=0,this.init()}init(){this.createCopyCanvas(),this.createWebGLCanvas(),this.createShaders(),this.setupGeometry(),this.resize(),window.addEventListener("resize",()=>this.resize()),this.lastTime=performance.now(),this.render(),console.log("%c\u{1F5A5}\uFE0F CRT Effect enabled","color: #33ff66;")}createCopyCanvas(){this.copyCanvas=document.createElement("canvas"),this.copyCtx=this.copyCanvas.getContext("2d")}createWebGLCanvas(){if(this.glCanvas=document.createElement("canvas"),this.glCanvas.id="crt-output",this.glCanvas.style.cssText=`
      position: fixed;
      inset: 0;
      width: 100vw;
      height: 100vh;
      pointer-events: none;
      z-index: 9999;
    `,this.gl=this.glCanvas.getContext("webgl2",{alpha:!1,antialias:!1,preserveDrawingBuffer:!1}),this.gl||(this.gl=this.glCanvas.getContext("webgl",{alpha:!1,antialias:!1})),!this.gl)throw new Error("WebGL not supported");this.webgl2=this.gl instanceof WebGL2RenderingContext,document.body.appendChild(this.glCanvas)}resize(){let e=Math.min(window.devicePixelRatio,2),t=window.innerWidth,o=window.innerHeight;this.glCanvas.width=Math.floor(t*e),this.glCanvas.height=Math.floor(o*e),this.gl.viewport(0,0,this.glCanvas.width,this.glCanvas.height),this.resolution=[this.glCanvas.width,this.glCanvas.height],this.sourceCanvas.style.width=t+"px",this.sourceCanvas.style.height=o+"px"}createShaders(){let e=this.gl,t=this.webgl2?`#version 300 es
      in vec2 a_position;
      in vec2 a_texCoord;
      out vec2 v_texCoord;
      void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
        v_texCoord = a_texCoord;
      }
    `:`
      attribute vec2 a_position;
      attribute vec2 a_texCoord;
      varying vec2 v_texCoord;
      void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
        v_texCoord = a_texCoord;
      }
    `,o=this.webgl2?`#version 300 es
      precision highp float;
      in vec2 v_texCoord;
      out vec4 fragColor;
      
      uniform sampler2D u_tex;
      uniform float u_barrel;
      uniform float u_keystoneX;
      uniform float u_keystoneY;
      uniform float u_zoom;
      uniform float u_fitStrength;
      uniform float u_keystoneFit;
      uniform float u_borderCutoff;
      uniform float u_vignette;
      uniform float u_scanline;
      uniform float u_scanlineCount;
      uniform float u_chroma;
      uniform float u_moire;
      uniform float u_noise;
      uniform float u_staticSpeed;
      uniform float u_staticContrast;
      uniform float u_brightness;
      uniform float u_contrast;
      uniform float u_saturation;
      uniform float u_curve;
      uniform float u_time;
      
      float rand(vec2 co) {
        return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
      }
      
      vec2 barrel(vec2 uv, float k) {
        vec2 c = uv - 0.5;
        float r2 = dot(c, c);
        float f = 1.0 + r2 * k;
        return c * f + 0.5;
      }

      vec2 keystone(vec2 uv, float kx, float ky) {
        vec2 p = uv - 0.5;
        float sy = 1.0 + p.y * kx;
        float sx = 1.0 + p.x * ky;
        p.x *= sy;
        p.y *= sx;
        return p + 0.5;
      }
      
      void main() {
        float kTotal = u_barrel + u_curve * 0.5;
        float fit = 1.0 + u_fitStrength * max(kTotal, 0.0) + u_keystoneFit * (abs(u_keystoneX) + abs(u_keystoneY));
        vec2 uv = keystone(v_texCoord, u_keystoneX, u_keystoneY);
        uv = (uv - 0.5) / max(u_zoom * fit, 0.01) + 0.5;
        uv = barrel(uv, kTotal);
        vec2 uvBorder = uv;

        uv = clamp(uv, 0.0, 1.0);
        
        vec2 d = uv - 0.5;
        float dist = length(d);
        vec2 dir = dist > 0.0 ? normalize(d) : vec2(0.0);
        
        vec3 col;
        col.r = texture(u_tex, uv + dir * dist * u_chroma).r;
        col.g = texture(u_tex, uv).g;
        col.b = texture(u_tex, uv - dir * dist * u_chroma).b;
        
        float sl = sin(uv.y * u_scanlineCount * 3.14159) * 0.5 + 0.5;
        col *= mix(1.0, sl, u_scanline);
        
        float vig = 1.0 - smoothstep(0.3, 1.0, length(uv - 0.5) * u_vignette);
        col *= vig;
        
        float noisePhase = floor(u_time * max(u_staticSpeed, 0.01) * 24.0);
        float rawNoise = rand(gl_FragCoord.xy + vec2(noisePhase, noisePhase * 0.73));
        float shapedNoise = mix(rawNoise, step(0.5, rawNoise), clamp(u_staticContrast, 0.0, 1.0));
        col += (shapedNoise - 0.5) * u_noise;

        float moire = sin((uv.x + uv.y) * 900.0) * sin((uv.x - uv.y) * 900.0);
        col += moire * u_moire * 0.02;
        
        col = (col - 0.5) * u_contrast + 0.5;
        col *= u_brightness;
        
        float gray = dot(col, vec3(0.299, 0.587, 0.114));
        col = mix(vec3(gray), col, u_saturation);

        float edge = min(min(uvBorder.x, 1.0 - uvBorder.x), min(uvBorder.y, 1.0 - uvBorder.y));
        float border = step(max(u_borderCutoff, 0.0), edge);
        col *= border;
        
        fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
      }
    `:`
      precision highp float;
      varying vec2 v_texCoord;
      uniform sampler2D u_tex;
      uniform float u_barrel;
      uniform float u_keystoneX;
      uniform float u_keystoneY;
      uniform float u_zoom;
      uniform float u_fitStrength;
      uniform float u_keystoneFit;
      uniform float u_borderCutoff;
      uniform float u_vignette;
      uniform float u_scanline;
      uniform float u_scanlineCount;
      uniform float u_chroma;
      uniform float u_moire;
      uniform float u_noise;
      uniform float u_staticSpeed;
      uniform float u_staticContrast;
      uniform float u_brightness;
      uniform float u_contrast;
      uniform float u_saturation;
      uniform float u_curve;
      uniform float u_time;
      
      float rand(vec2 co) {
        return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
      }
      
      vec2 barrel(vec2 uv, float k) {
        vec2 c = uv - 0.5;
        return c * (1.0 + dot(c, c) * k) + 0.5;
      }

      vec2 keystone(vec2 uv, float kx, float ky) {
        vec2 p = uv - 0.5;
        float sy = 1.0 + p.y * kx;
        float sx = 1.0 + p.x * ky;
        p.x *= sy;
        p.y *= sx;
        return p + 0.5;
      }
      
      void main() {
        float kTotal = u_barrel + u_curve * 0.5;
        float fit = 1.0 + u_fitStrength * max(kTotal, 0.0) + u_keystoneFit * (abs(u_keystoneX) + abs(u_keystoneY));
        vec2 uv = keystone(v_texCoord, u_keystoneX, u_keystoneY);
        uv = (uv - 0.5) / max(u_zoom * fit, 0.01) + 0.5;
        uv = barrel(uv, kTotal);
        vec2 uvBorder = uv;

        uv = clamp(uv, 0.0, 1.0);
        
        vec2 d = uv - 0.5;
        float dist = length(d);
        vec2 dir = dist > 0.0 ? normalize(d) : vec2(0.0);
        
        vec3 col;
        col.r = texture2D(u_tex, uv + dir * dist * u_chroma).r;
        col.g = texture2D(u_tex, uv).g;
        col.b = texture2D(u_tex, uv - dir * dist * u_chroma).b;
        
        float sl = sin(uv.y * u_scanlineCount * 3.14159) * 0.5 + 0.5;
        col *= mix(1.0, sl, u_scanline);
        
        col *= 1.0 - smoothstep(0.3, 1.0, length(uv - 0.5) * u_vignette);
        
        float noisePhase = floor(u_time * max(u_staticSpeed, 0.01) * 24.0);
        float rawNoise = rand(gl_FragCoord.xy + vec2(noisePhase, noisePhase * 0.73));
        float shapedNoise = mix(rawNoise, step(0.5, rawNoise), clamp(u_staticContrast, 0.0, 1.0));
        col += (shapedNoise - 0.5) * u_noise;

        float moire = sin((uv.x + uv.y) * 900.0) * sin((uv.x - uv.y) * 900.0);
        col += moire * u_moire * 0.02;
        
        col = (col - 0.5) * u_contrast + 0.5;
        col *= u_brightness;
        
        float gray = dot(col, vec3(0.299, 0.587, 0.114));
        col = mix(vec3(gray), col, u_saturation);

        float edge = min(min(uvBorder.x, 1.0 - uvBorder.x), min(uvBorder.y, 1.0 - uvBorder.y));
        float border = step(max(u_borderCutoff, 0.0), edge);
        col *= border;
        
        gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
      }
    `,i=e.createShader(e.VERTEX_SHADER);e.shaderSource(i,t),e.compileShader(i);let n=e.createShader(e.FRAGMENT_SHADER);e.shaderSource(n,o),e.compileShader(n),this.program=e.createProgram(),e.attachShader(this.program,i),e.attachShader(this.program,n),e.linkProgram(this.program),this.uniforms={tex:e.getUniformLocation(this.program,"u_tex"),barrel:e.getUniformLocation(this.program,"u_barrel"),keystoneX:e.getUniformLocation(this.program,"u_keystoneX"),keystoneY:e.getUniformLocation(this.program,"u_keystoneY"),zoom:e.getUniformLocation(this.program,"u_zoom"),fitStrength:e.getUniformLocation(this.program,"u_fitStrength"),keystoneFit:e.getUniformLocation(this.program,"u_keystoneFit"),borderCutoff:e.getUniformLocation(this.program,"u_borderCutoff"),vignette:e.getUniformLocation(this.program,"u_vignette"),scanline:e.getUniformLocation(this.program,"u_scanline"),scanlineCount:e.getUniformLocation(this.program,"u_scanlineCount"),chroma:e.getUniformLocation(this.program,"u_chroma"),moire:e.getUniformLocation(this.program,"u_moire"),noise:e.getUniformLocation(this.program,"u_noise"),staticSpeed:e.getUniformLocation(this.program,"u_staticSpeed"),staticContrast:e.getUniformLocation(this.program,"u_staticContrast"),brightness:e.getUniformLocation(this.program,"u_brightness"),contrast:e.getUniformLocation(this.program,"u_contrast"),saturation:e.getUniformLocation(this.program,"u_saturation"),curve:e.getUniformLocation(this.program,"u_curve"),time:e.getUniformLocation(this.program,"u_time")},this.aPos=e.getAttribLocation(this.program,"a_position"),this.aTex=e.getAttribLocation(this.program,"a_texCoord")}setupGeometry(){let e=this.gl,t=new Float32Array([-1,-1,0,1,1,-1,1,1,-1,1,0,0,1,1,1,0]);this.vbo=e.createBuffer(),e.bindBuffer(e.ARRAY_BUFFER,this.vbo),e.bufferData(e.ARRAY_BUFFER,t,e.STATIC_DRAW),this.ibo=e.createBuffer(),e.bindBuffer(e.ELEMENT_ARRAY_BUFFER,this.ibo),e.bufferData(e.ELEMENT_ARRAY_BUFFER,new Uint16Array([0,1,2,2,1,3]),e.STATIC_DRAW),this.tex=e.createTexture(),e.bindTexture(e.TEXTURE_2D,this.tex),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.LINEAR)}render(){if(!this.enabled){requestAnimationFrame(()=>this.render());return}let e=performance.now();this.time=e/1e3;let t=this.gl,o=this.sourceCanvas.width,i=this.sourceCanvas.height,n=window.room?.renderer?.domElement===this.sourceCanvas?window.room.renderVersion:void 0,u=this.copyCanvas.width!==o||this.copyCanvas.height!==i;o>0&&i>0&&(u||n===void 0||this.sourceVersion!==n)&&((this.copyCanvas.width!==o||this.copyCanvas.height!==i)&&(this.copyCanvas.width=o,this.copyCanvas.height=i),this.copyCtx.drawImage(this.sourceCanvas,0,0),t.bindTexture(t.TEXTURE_2D,this.tex),t.texImage2D(t.TEXTURE_2D,0,t.RGBA,t.RGBA,t.UNSIGNED_BYTE,this.copyCanvas),this.sourceVersion=n),t.clearColor(0,0,0,1),t.clear(t.COLOR_BUFFER_BIT),t.useProgram(this.program),t.uniform1i(this.uniforms.tex,0),t.uniform1f(this.uniforms.barrel,this.options.barrelDistortion),t.uniform1f(this.uniforms.keystoneX,this.options.keystoneX),t.uniform1f(this.uniforms.keystoneY,this.options.keystoneY),t.uniform1f(this.uniforms.zoom,this.options.crtZoom),t.uniform1f(this.uniforms.fitStrength,this.options.fitStrength),t.uniform1f(this.uniforms.keystoneFit,this.options.keystoneFit),t.uniform1f(this.uniforms.borderCutoff,this.options.borderCutoff),t.uniform1f(this.uniforms.vignette,this.options.vignetteIntensity),t.uniform1f(this.uniforms.scanline,this.options.scanlineIntensity),t.uniform1f(this.uniforms.scanlineCount,this.options.scanlineCount),t.uniform1f(this.uniforms.chroma,this.options.chromaticAberration),t.uniform1f(this.uniforms.moire,this.options.moireStrength),t.uniform1f(this.uniforms.noise,this.options.noiseIntensity),t.uniform1f(this.uniforms.staticSpeed,this.options.staticSpeed),t.uniform1f(this.uniforms.staticContrast,this.options.staticContrast),t.uniform1f(this.uniforms.brightness,this.options.brightness),t.uniform1f(this.uniforms.contrast,this.options.contrast),t.uniform1f(this.uniforms.saturation,this.options.saturation),t.uniform1f(this.uniforms.curve,this.options.curveAmount),t.uniform1f(this.uniforms.time,this.time),t.bindBuffer(t.ARRAY_BUFFER,this.vbo),t.enableVertexAttribArray(this.aPos),t.vertexAttribPointer(this.aPos,2,t.FLOAT,!1,16,0),t.enableVertexAttribArray(this.aTex),t.vertexAttribPointer(this.aTex,2,t.FLOAT,!1,16,8),t.bindBuffer(t.ELEMENT_ARRAY_BUFFER,this.ibo),t.drawElements(t.TRIANGLES,6,t.UNSIGNED_SHORT,0),requestAnimationFrame(()=>this.render())}updateOptions(e){Object.assign(this.options,e)}start(){this.enabled=!0,this.glCanvas.style.display="block"}stop(){this.enabled=!1,this.glCanvas.style.display="none"}toggle(){this.enabled?this.stop():this.start()}dispose(){this.enabled=!1,this.glCanvas.remove()}};var r=null;function c(s){if(document.getElementById("crt-toggle-button"))return;let t=document.createElement("button");t.id="crt-toggle-button",t.type="button",t.title="Toggle CRT effect",t.setAttribute("aria-label","Toggle CRT effect"),t.innerHTML=`
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
      <rect x="3.5" y="4.5" width="17" height="11.5" rx="1.8" ry="1.8" fill="none" stroke="currentColor" stroke-width="1.5"/>
      <path d="M8 19h8M10.5 16.5v2.5M13.5 16.5v2.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
      <path d="M6.3 8.2h11.4M6.3 10.2h11.4M6.3 12.2h11.4" stroke="currentColor" stroke-width="1" stroke-linecap="round" opacity="0.75"/>
    </svg>
  `,t.style.cssText=`
    position: fixed;
    top: 10px;
    right: 10px;
    z-index: 10000;
    width: 28px;
    height: 28px;
    border: 1px solid rgba(255, 255, 255, 0.55);
    border-radius: 999px;
    background: rgba(0, 0, 0, 0.45);
    color: rgba(255, 255, 255, 0.82);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    opacity: 0.32;
    transition: opacity 140ms ease, background 140ms ease, color 140ms ease;
    padding: 0;
  `;let o=()=>{s.enabled?(t.style.opacity="0.32",t.style.background="rgba(0, 0, 0, 0.45)",t.style.color="rgba(255, 255, 255, 0.82)"):(t.style.opacity="0.52",t.style.background="rgba(20, 0, 0, 0.65)",t.style.color="rgba(255, 160, 160, 0.95)")};t.addEventListener("mouseenter",()=>{t.style.opacity=s.enabled?"0.56":"0.70"}),t.addEventListener("mouseleave",()=>{o()}),t.addEventListener("click",()=>{s.toggle(),o()}),o(),document.body.appendChild(t)}function h(s){return r?(console.warn("CRT effect already initialized"),r):(r=new a(s,{scanlineIntensity:.4,scanlineCount:730,barrelDistortion:.22,crtZoom:.82,fitStrength:.82,keystoneFit:.06,borderCutoff:0,keystoneX:0,keystoneY:0,vignetteIntensity:.65,chromaticAberration:.002,moireStrength:1,noiseIntensity:.1,staticSpeed:10,staticContrast:1,curveAmount:.08,brightness:1.15,contrast:1.08,saturation:1.05}),r.start(),c(r),window.crtEffect=r,window.toggleCRT=()=>r.toggle(),console.log("%cCRT Effect enabled","color: #33ff66; font-family: monospace;"),r)}export{h as initCRTEffect};

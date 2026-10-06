import * as T from "./vendor/three.module.js";
import { objectColor, halton } from "./outline.js";
import { temporalVertex, temporalFragment } from "./temporal.js";
import { NormalCache } from "./normal-cache.js";
import { pixelationGranularity } from "./parity-math.js";
export class Post {
  constructor(renderer) {
    this.renderer = renderer;
    this.normalCache = new NormalCache();
    renderer.domElement?.addEventListener("webglcontextrestored", () =>
      this.normalCache.invalidate(),
    );
    this.color = new T.WebGLRenderTarget(1, 1, { count: 2 });
    this.color.textures[1].type = T.HalfFloatType;
    this.color.depthTexture = new T.DepthTexture(1, 1, T.FloatType);
    this.history = new T.WebGLRenderTarget(1, 1);
    this.reconstructed = new T.WebGLRenderTarget(1, 1);
    this.frameIndex = 0;
    this.previous = new WeakMap();
    this.previousCameras = new WeakMap();
    this.identity = new T.Matrix4();
    this.black = new T.Color(0);
    this.velocityClear = new Float32Array([0, 0, 0, 1]);
    this.drawn = new Set();
    this.meshStates = new WeakMap();
    this.renderMeshes = [];
    this.normal = new T.WebGLRenderTarget(1, 1, {
      type: T.FloatType,
      minFilter: T.NearestFilter,
      magFilter: T.NearestFilter,
    });
    this.normal.depthTexture = new T.DepthTexture(1, 1, T.UnsignedIntType);
    this.normalMaterial = new T.ShaderMaterial({
      side: T.FrontSide,
      uniforms: {
        randomColor: { value: new T.Vector3() },
        depthContrast: { value: 1 },
      },
      vertexShader:
        "varying vec3 localNormal;void main(){localNormal=normal;gl_Position=projectionMatrix*(modelViewMatrix*vec4(position,1.0));}",
      fragmentShader:
        "varying vec3 localNormal;uniform vec3 randomColor;uniform float depthContrast;void main(){float d=(gl_FragCoord.z-.5)*depthContrast+.5;gl_FragColor=vec4(mix(mix(randomColor,normalize(localNormal),.2),vec3(d),.4),randomColor.r);}",
    });
    this.normalMaterial.onBeforeRender = (_r, _s, _c, _g, object) => {
      this.normalMaterial.uniforms.randomColor.value =
        this.meshStates.get(object).normalColor;
      this.normalMaterial.uniformsNeedUpdate = true;
    };
    this.outlineUniforms = {
      roomHalton: { value: new T.Vector2(...halton[0]) },
      roomNormalTex: { value: this.normal.texture },
      roomDepthTex: { value: this.normal.depthTexture },
      roomResolution: { value: new T.Vector2() },
      roomPixelRatio: { value: renderer.getPixelRatio() },
      roomOutlineEnabled: { value: 1 },
    };
    this.camera = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.scene = new T.Scene();
    this.material = new T.ShaderMaterial({
      depthTest: false,
      depthWrite: false,
      uniforms: {
        colorTex: { value: this.color.texture },
        resolution: { value: new T.Vector2() },
        pixelation: { value: 0 },
        outlineEnabled: this.outlineUniforms.roomOutlineEnabled,
      },
      vertexShader:
        "varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position,1.0);}",
      fragmentShader: `uniform sampler2D colorTex;uniform vec2 resolution;uniform float pixelation;varying vec2 vUv;void main(){vec2 uv=pixelation>0.0?(floor(vUv*resolution/pixelation)+.5)*pixelation/resolution:vUv;gl_FragColor=texture2D(colorTex,uv);}`,
    });
    this.material.toneMapped = false;
    const screen = new T.BufferGeometry();
    screen.setAttribute(
      "position",
      new T.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3),
    );
    screen.setAttribute(
      "uv",
      new T.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2),
    );
    this.quad = new T.Mesh(screen, this.material);
    this.quad.frustumCulled = false;
    this.scene.add(this.quad);
    this.temporal = new T.ShaderMaterial({
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
      vertexShader: temporalVertex,
      fragmentShader: temporalFragment,
      uniforms: {
        resolution: this.material.uniforms.resolution,
        inputBuffer: { value: this.color.texture },
        historyBuffer: { value: this.history.texture },
        velocityBuffer: { value: this.color.textures[1] },
        depthBuffer: { value: this.color.depthTexture },
      },
    });
  }
  resize(w, h) {
    this.normalCache.invalidate();
    this.color.setSize(w, h);
    this.normal.setSize(w, h);
    this.history.setSize(w, h);
    this.reconstructed.setSize(w, h);
    this.material.uniforms.resolution.value.set(w, h);
    this.outlineUniforms.roomResolution.value.set(w, h);
  }
  render(scene, camera, page) {
    // Synchronize once; the following passes share the same world transforms.
    const auto = scene.matrixWorldAutoUpdate;
    if (auto) scene.updateMatrixWorld();
    scene.matrixWorldAutoUpdate = false;
    try {
      return this.renderUpdated(scene, camera, page);
    } finally {
      scene.matrixWorldAutoUpdate = auto;
    }
  }
  renderUpdated(scene, camera, page) {
    const r = this.renderer,
      original = this.renderMeshes;
    original.length = 0;
    this.outlineUniforms.roomHalton.value.fromArray(halton[this.frameIndex]);
    scene.traverseVisible((o) => {
      if (!o.isMesh) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      let entry = this.meshStates.get(o);
      if (!entry) {
        entry = {
          object: o,
          drawHook: (...args) => {
            this.drawn.add(o);
            entry.originalHook?.apply(o, args);
          },
        };
        this.meshStates.set(o, entry);
      }
      entry.material = o.material;
      entry.visible = o.visible;
      original.push(entry);
      if (!mats.some((m) => m.userData.outline)) return;
      entry.normalColor ??= objectColor(
        o.userData.record?.renderUUID ?? o.userData.record?.id ?? o.uuid,
      );
    });
    if (this.normalCache.changed(scene, camera, original)) {
      for (const entry of original) {
        const mats = Array.isArray(entry.material)
          ? entry.material
          : [entry.material];
        if (!mats.some((m) => m.userData.outline)) entry.object.visible = false;
      }
      const bg = scene.background,
        override = scene.overrideMaterial;
      scene.background = this.black;
      scene.overrideMaterial = this.normalMaterial;
      this.normalMaterial.uniforms.depthContrast.value =
        (camera.far - camera.near) / 10000;
      r.setRenderTarget(this.normal);
      try {
        r.render(scene, camera);
      } catch (error) {
        this.normalCache.invalidate();
        throw error;
      } finally {
        scene.background = bg;
        scene.overrideMaterial = override;
        for (const entry of original) {
          entry.object.material = entry.material;
          entry.object.visible = entry.visible;
        }
      }
    }
    const projection = this.previousCameras.get(camera) ?? this.identity;
    this.drawn.clear();
    for (const entry of original) {
      const o = entry.object,
        modelView = this.previous.get(o) ?? this.identity;
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        m.userData.roomPreviousModelView ??= { value: modelView.clone() };
        m.userData.roomPreviousProjection ??= { value: projection.clone() };
        m.userData.roomPreviousModelView.value.copy(modelView);
        m.userData.roomPreviousProjection.value.copy(projection);
      }
      entry.originalHook = o.onAfterRender;
      o.onAfterRender = entry.drawHook;
    }
    const autoClear = r.autoClear;
    r.autoClear = false;
    const background = scene.background;
    scene.background = null;
    r.setRenderTarget(this.color);
    r.setClearColor(background ?? 0, 1);
    r.clear();
    const gl = r.getContext();
    gl.clearBufferfv(gl.COLOR, 1, this.velocityClear);
    r.render(scene, camera);
    scene.background = background;
    r.autoClear = autoClear;
    for (const entry of original)
      entry.object.onAfterRender = entry.originalHook;
    for (const o of this.drawn) {
      let matrix = this.previous.get(o);
      if (!matrix) {
        matrix = new T.Matrix4();
        this.previous.set(o, matrix);
      }
      matrix.copy(o.modelViewMatrix);
    }
    let previousProjection = this.previousCameras.get(camera);
    if (!previousProjection) {
      previousProjection = new T.Matrix4();
      this.previousCameras.set(camera, previousProjection);
    }
    previousProjection.copy(camera.projectionMatrix);
    this.temporal.uniforms.historyBuffer.value = this.history.texture;
    this.quad.material = this.temporal;
    r.setRenderTarget(this.reconstructed);
    r.render(this.scene, this.camera);
    this.quad.material = this.material;
    this.material.uniforms.colorTex.value = this.reconstructed.texture;
    this.material.uniforms.pixelation.value = page?.postprocessing?.pixelation
      ?.enabled
      ? pixelationGranularity(page.postprocessing.pixelation.granularity ?? 0)
      : 0;
    r.setRenderTarget(null);
    r.render(this.scene, this.camera);
    [this.history, this.reconstructed] = [this.reconstructed, this.history];
    this.frameIndex = (this.frameIndex + 1) % 16;
  }
}

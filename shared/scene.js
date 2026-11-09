import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

/** @param {unknown} error */
export function showError(error) {
  console.error(error);
  const status = document.querySelector("#status");
  if (status) {
    status.textContent = error instanceof Error ? error.message : String(error);
    status.setAttribute("data-state", "error");
  }
}

/** @param {ReturnType<typeof import('@landofassets/runtime').createLoaResolver>} assets */
export async function startScene(assets) {
  const viewport = /** @type {HTMLElement} */ (document.querySelector("#viewport"));
  const status = /** @type {HTMLElement} */ (document.querySelector("#status"));
  const button = /** @type {HTMLButtonElement} */ (document.querySelector("#animate"));
  const source = /** @type {HTMLElement} */ (document.querySelector("#asset-source"));
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  viewport.append(renderer.domElement);

  const gl = renderer.getContext();
  const debug = gl.getExtension("WEBGL_debug_renderer_info");
  const gpu = debug
    ? String(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL))
    : "Renderer identity unavailable";
  const gpuLabel = document.querySelector("#gpu");
  if (gpuLabel) gpuLabel.textContent = `GPU: ${gpu}`;
  // Expose the actual identity; never report software rendering as a verified GPU run.
  if (/swiftshader|llvmpipe|lavapipe|software rasterizer/i.test(gpu)) {
    renderer.dispose();
    throw new Error(`Hardware GPU required; received ${gpu}`);
  }

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.minDistance = 3;
  controls.maxDistance = 18;
  controls.maxPolarAngle = Math.PI * 0.52;
  const hemisphere = new THREE.HemisphereLight(0xc7e9ff, 0xb88860, 2.8);
  scene.add(hemisphere);
  const key = new THREE.DirectionalLight(0xfff2df, 4);
  key.position.set(3, 7, 5);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xa2d7ff, 3);
  rim.position.set(-4, 3, -3);
  scene.add(rim);

  const manager = new THREE.LoadingManager();
  manager.setURLModifier(assets.urlModifier);
  manager.onError = (url) => showError(new Error(`Asset request failed: ${url}`));
  const url = assets.url("robot");
  source.textContent = `robot → ${url}`;
  status.textContent = "Loading pinned robot@1.0.0…";
  // The loader sees a stable binding name; only the resolver chooses its location.
  const gltf = await new GLTFLoader(manager).loadAsync("loa:robot");
  const box = new THREE.Box3().setFromObject(gltf.scene);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const scale = 3 / size.y;
  gltf.scene.scale.setScalar(scale);
  gltf.scene.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);
  scene.add(gltf.scene);
  const platform = new THREE.Mesh(
    new THREE.CylinderGeometry(2.05, 2.15, 0.15, 64),
    new THREE.MeshStandardMaterial({ color: 0xddd1bc, roughness: 0.8 }),
  );
  platform.position.y = -0.085;
  scene.add(platform);
  camera.position.set(5, 3.3, 7);
  controls.target.set(0, 1.5, 0);
  controls.update();

  const mixer = new THREE.AnimationMixer(gltf.scene);
  const clip = THREE.AnimationClip.findByName(gltf.animations, "Idle") ?? gltf.animations[0];
  if (clip) mixer.clipAction(clip).play();
  let playing = true;
  button.disabled = !clip;
  button.addEventListener("click", () => {
    playing = !playing;
    button.textContent = playing ? "Pause animation" : "Play animation";
  });
  const resize = () => {
    const { width, height } = viewport.getBoundingClientRect();
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(viewport);
  resize();
  const timer = new THREE.Timer();
  timer.connect(document);
  let firstRender = true;
  renderer.setAnimationLoop(() => {
    timer.update();
    if (playing) mixer.update(Math.min(timer.getDelta(), 0.1));
    controls.update();
    renderer.render(scene, camera);
    if (firstRender) {
      status.textContent = `Loaded · ${gltf.animations.length} animation clips · ${renderer.info.render.triangles.toLocaleString()} triangles`;
      status.dataset.state = "ready";
      firstRender = false;
    }
  });
  window.addEventListener(
    "pagehide",
    () => {
      renderer.setAnimationLoop(null);
      observer.disconnect();
      timer.dispose();
      controls.dispose();
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          for (const material of Array.isArray(object.material)
            ? object.material
            : [object.material])
            material.dispose();
        }
      });
      renderer.dispose();
    },
    { once: true },
  );
}

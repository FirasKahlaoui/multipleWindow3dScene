import WindowManager from "./WindowManager.js";

const t = THREE;
let camera, scene, renderer, world;
let near, far;
let pixR = window.devicePixelRatio ? window.devicePixelRatio : 1;
let objects = [];
let sceneOffsetTarget = { x: 0, y: 0 };
let sceneOffset = { x: 0, y: 0 };

let today = new Date();
today.setHours(0);
today.setMinutes(0);
today.setSeconds(0);
today.setMilliseconds(0);
today = today.getTime();

let internalTime = getTime();
let windowManager;
let initialized = false;
let config = {
  shape: "cube",
  wireframe: true,
  rotationSpeed: 1.0,
  background: "black",
};

// Background elements
let starField;
let gradientBackground;

// get time in seconds since beginning of the day (so that all windows use the same time)
function getTime() {
  return (new Date().getTime() - today) / 1000.0;
}

if (new URLSearchParams(window.location.search).get("clear")) {
  localStorage.clear();
} else {
  // this code is essential to circumvent that some browsers preload the content of some pages before you actually hit the url
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState != "hidden" && !initialized) {
      init();
    }
  });

  window.onload = () => {
    if (document.visibilityState != "hidden") {
      init();
    }
  };

  function init() {
    initialized = true;

    // add a short timeout because window.offsetX reports wrong values before a short period
    setTimeout(() => {
      setupScene();
      setupWindowManager();
      setupEventListeners();
      setupBackgrounds();
      resize();
      updateWindowShape(false);
      render();
      window.addEventListener("resize", resize);
    }, 500);
  }

  function setupScene() {
    camera = new t.OrthographicCamera(
      0,
      0,
      window.innerWidth,
      window.innerHeight,
      -10000,
      10000
    );

    camera.position.z = 2.5;
    near = camera.position.z - 0.5;
    far = camera.position.z + 0.5;

    scene = new t.Scene();
    scene.background = new t.Color(0x000000);
    scene.add(camera);

    renderer = new t.WebGLRenderer({
      antialias: true,
      depthBuffer: true,
      alpha: true,
    });
    renderer.setPixelRatio(pixR);

    world = new t.Object3D();
    scene.add(world);

    renderer.domElement.setAttribute("id", "scene");
    document.body.appendChild(renderer.domElement);
  }

  function setupBackgrounds() {
    // Create star field background
    starField = createStarField(2000);
    starField.visible = false;
    scene.add(starField);

    // Create gradient background
    gradientBackground = createGradientBackground();
    gradientBackground.visible = false;
    scene.add(gradientBackground);
  }

  function createStarField(count) {
    const stars = new t.Group();
    const geometry = new t.SphereGeometry(1, 4, 4);
    const material = new t.MeshBasicMaterial({ color: 0xffffff });

    for (let i = 0; i < count; i++) {
      const star = new t.Mesh(geometry, material);

      const x = t.MathUtils.randFloatSpread(2000);
      const y = t.MathUtils.randFloatSpread(2000);
      const z = t.MathUtils.randFloat(-500, -2000);

      star.position.set(x, y, z);
      star.scale.setScalar(t.MathUtils.randFloat(0.5, 2));

      stars.add(star);
    }

    return stars;
  }

  function createGradientBackground() {
    // Create a plane for the gradient
    const geometry = new t.PlaneGeometry(4000, 4000);
    const gradientTexture = createGradientTexture();
    const material = new t.MeshBasicMaterial({
      map: gradientTexture,
      transparent: true,
      depthWrite: false,
    });

    const plane = new t.Mesh(geometry, material);
    plane.position.z = -1000;
    return plane;
  }

  function createGradientTexture() {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;

    const context = canvas.getContext("2d");

    const gradient = context.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, "#1a237e");
    gradient.addColorStop(1, "#311b92");

    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);

    const texture = new t.CanvasTexture(canvas);
    return texture;
  }

  function setupWindowManager() {
    windowManager = new WindowManager();
    windowManager.setWinShapeChangeCallback(updateWindowShape);
    windowManager.setWinChangeCallback(windowsUpdated);
    windowManager.setConfigChangeCallback(configUpdated);

    // Custom metadata
    let metaData = { createdAt: new Date().toISOString() };

    // initialize window manager
    windowManager.init(metaData);

    // Get initial config
    config = windowManager.getConfig();
    applyConfig(config);

    // Update windows initially
    windowsUpdated();
  }

  function setupEventListeners() {
    // Shape selection
    document.getElementById("shape-select").addEventListener("change", (e) => {
      config.shape = e.target.value;
      windowManager.updateConfig(config);
      updateObjects();
    });

    // Wireframe toggle
    document
      .getElementById("wireframe-toggle")
      .addEventListener("input", (e) => {
        config.wireframe = e.target.value === "1";
        document.getElementById("wireframe-value").textContent =
          config.wireframe ? "On" : "Off";
        windowManager.updateConfig(config);
        updateObjects();
      });

    // Rotation speed
    document.getElementById("rotation-speed").addEventListener("input", (e) => {
      config.rotationSpeed = parseFloat(e.target.value);
      document.getElementById("rotation-value").textContent =
        config.rotationSpeed.toFixed(1);
      windowManager.updateConfig(config);
    });

    // Background selection
    document
      .getElementById("background-select")
      .addEventListener("change", (e) => {
        config.background = e.target.value;
        windowManager.updateConfig(config);
        updateBackground();
      });

    // Button to open a new window
    document.getElementById("new-window").addEventListener("click", () => {
      windowManager.openNewWindow();
    });

    // Button to reset all windows
    document.getElementById("reset-window").addEventListener("click", () => {
      windowManager.resetAllWindows();
    });

    // Toggle UI visibility
    document.getElementById("toggle-ui").addEventListener("click", () => {
      const panel = document.getElementById("ui-panel");
      panel.style.display = panel.style.display === "none" ? "block" : "none";
    });
  }

  function configUpdated(newConfig) {
    config = newConfig;
    applyConfig(config);
    updateObjects();
  }

  function applyConfig(config) {
    // Update UI to match config
    document.getElementById("shape-select").value = config.shape;
    document.getElementById("wireframe-toggle").value = config.wireframe
      ? "1"
      : "0";
    document.getElementById("wireframe-value").textContent = config.wireframe
      ? "On"
      : "Off";
    document.getElementById("rotation-speed").value = config.rotationSpeed;
    document.getElementById("rotation-value").textContent =
      config.rotationSpeed.toFixed(1);
    document.getElementById("background-select").value = config.background;

    updateBackground();
  }

  function updateBackground() {
    switch (config.background) {
      case "black":
        scene.background = new t.Color(0x000000);
        starField.visible = false;
        gradientBackground.visible = false;
        break;
      case "gradient":
        scene.background = null;
        starField.visible = false;
        gradientBackground.visible = true;
        break;
      case "stars":
        scene.background = new t.Color(0x000000);
        starField.visible = true;
        gradientBackground.visible = false;
        break;
    }
  }

  function windowsUpdated() {
    updateObjects();

    // Update window count in UI
    const windows = windowManager.getWindows();
    document.getElementById("window-count").textContent = windows.length;
  }

  function createGeometry(shape, size) {
    switch (shape) {
      case "cube":
        return new t.BoxGeometry(size, size, size);
      case "sphere":
        return new t.SphereGeometry(size / 2, 32, 32);
      case "torus":
        return new t.TorusGeometry(size / 2, size / 6, 16, 100);
      case "cone":
        return new t.ConeGeometry(size / 2, size, 32);
      case "cylinder":
        return new t.CylinderGeometry(size / 2, size / 2, size, 32);
      default:
        return new t.BoxGeometry(size, size, size);
    }
  }

  function updateObjects() {
    let wins = windowManager.getWindows();

    // remove all objects
    objects.forEach((obj) => {
      world.remove(obj);
    });

    objects = [];

    // add new objects based on the current window setup
    for (let i = 0; i < wins.length; i++) {
      let win = wins[i];

      let c = new t.Color();
      c.setHSL(i * 0.1, 1.0, 0.5);

      let s = 100 + i * 50;
      let geometry = createGeometry(config.shape, s);
      let material = new t.MeshBasicMaterial({
        color: c,
        wireframe: config.wireframe,
      });

      // Add some extras for non-wireframe mode
      if (!config.wireframe) {
        material.transparent = true;
        material.opacity = 0.8;
        material.side = t.DoubleSide;
      }

      let object = new t.Mesh(geometry, material);
      object.position.x = win.shape.x + win.shape.w * 0.5;
      object.position.y = win.shape.y + win.shape.h * 0.5;

      world.add(object);
      objects.push(object);
    }
  }

  function updateWindowShape(easing = true) {
    // storing the actual offset in a proxy that we update against in the render function
    sceneOffsetTarget = { x: -window.screenX, y: -window.screenY };
    if (!easing) sceneOffset = sceneOffsetTarget;
  }

  function render() {
    let t = getTime();

    windowManager.update();

    // calculate the new position based on the delta between current offset and new offset times a falloff value (to create the nice smoothing effect)
    let falloff = 0.05;
    sceneOffset.x =
      sceneOffset.x + (sceneOffsetTarget.x - sceneOffset.x) * falloff;
    sceneOffset.y =
      sceneOffset.y + (sceneOffsetTarget.y - sceneOffset.y) * falloff;

    // set the world position to the offset
    world.position.x = sceneOffset.x;
    world.position.y = sceneOffset.y;

    let wins = windowManager.getWindows();

    // Animate star field for star background
    if (starField.visible) {
      starField.children.forEach((star, i) => {
        const z = star.position.z + 0.5;
        if (z > -500) {
          star.position.z = -2000;
        } else {
          star.position.z = z;
        }
      });
    }

    // loop through all our objects and update their positions based on current window positions
    for (let i = 0; i < objects.length; i++) {
      let object = objects[i];
      let win = wins[i];
      let _t = t * config.rotationSpeed;

      let posTarget = {
        x: win.shape.x + win.shape.w * 0.5,
        y: win.shape.y + win.shape.h * 0.5,
      };

      object.position.x =
        object.position.x + (posTarget.x - object.position.x) * falloff;
      object.position.y =
        object.position.y + (posTarget.y - object.position.y) * falloff;

      // Add different rotation patterns based on shape
      switch (config.shape) {
        case "cube":
          object.rotation.x = _t * 0.5;
          object.rotation.y = _t * 0.3;
          break;
        case "sphere":
          object.rotation.y = _t * 0.3;
          break;
        case "torus":
          object.rotation.x = _t * 0.5;
          object.rotation.y = _t * 0.3;
          break;
        case "cone":
          object.rotation.x = Math.sin(_t * 0.5) * 0.2;
          object.rotation.y = _t * 0.5;
          break;
        case "cylinder":
          object.rotation.x = Math.sin(_t * 0.3) * 0.2;
          object.rotation.z = _t * 0.4;
          break;
        default:
          object.rotation.x = _t * 0.5;
          object.rotation.y = _t * 0.3;
      }
    }

    renderer.render(scene, camera);
    requestAnimationFrame(render);
  }

  // resize the renderer to fit the window size
  function resize() {
    let width = window.innerWidth;
    let height = window.innerHeight;

    camera = new t.OrthographicCamera(0, width, 0, height, -10000, 10000);
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  }
}

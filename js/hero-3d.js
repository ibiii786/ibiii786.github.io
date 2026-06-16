// ==========================================================================
// Hero 3D background
// Morphing blob with orbiting orbs, orbital rings, and cosmic particles.
// Mouse-reactive parallax. Optimized for fast init.
// ==========================================================================

(function () {
  const canvasWrap = document.getElementById('hero-canvas');
  if (!canvasWrap || typeof THREE === 'undefined') return;

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isMobile = window.innerWidth < 768;

  let scene, camera, renderer, clock, sceneGroup;
  let blobGroup, orbs = [], particles;
  let pointerX = 0, pointerY = 0;
  let targetRotX = 0, targetRotY = 0;
  let smoothRotX = 0, smoothRotY = 0;
  let scrollY = 0, targetScrollY = 0;
  let animationId = null;

  // Colors
  const COL_VIOLET = 0xC084FC;
  const COL_ROSE = 0xF0ABFC;
  const COL_WARM = 0xFBB8AC;
  const COL_DEEP = 0x7C3AED;
  const COL_TEAL = 0x67E8F9;

  init();

  function init() {
    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x08060E, 0.06);

    camera = new THREE.PerspectiveCamera(
      42,
      canvasWrap.clientWidth / canvasWrap.clientHeight,
      0.1,
      100
    );
    camera.position.set(0, 0, 10);

    sceneGroup = new THREE.Group();
    sceneGroup.position.set(2.5, -0.2, 0);
    scene.add(sceneGroup);

    blobGroup = new THREE.Group();
    sceneGroup.add(blobGroup);

    renderer = new THREE.WebGLRenderer({ antialias: !isMobile, alpha: false });
    // Cap pixel ratio: 1.5 on mobile, 2 on desktop
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2));
    renderer.setSize(canvasWrap.clientWidth, canvasWrap.clientHeight);
    renderer.setClearColor(0x08060E, 1);
    canvasWrap.appendChild(renderer.domElement);

    clock = new THREE.Clock();

    buildBlob();
    buildOrbs();
    buildParticles();
    addLights();

    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onScroll, { passive: true });

    // Pause animation when tab is hidden to save CPU/battery
    document.addEventListener('visibilitychange', onVisibilityChange);

    if (!prefersReducedMotion) {
      window.addEventListener('pointermove', onPointerMove);
      animate();
    } else {
      renderer.render(scene, camera);
    }
  }

  // =========================================================================
  // Blob — layered transparent spheres
  // =========================================================================
  function buildBlob() {
    // Layer 1: Deep core
    const coreGeo = new THREE.IcosahedronGeometry(1.3, 4);
    displaceGeometry(coreGeo, 0.15, 1.0);
    const coreMat = new THREE.MeshPhongMaterial({
      color: 0x4C1D95,
      emissive: 0x3B0764,
      emissiveIntensity: 0.8,
      shininess: 100,
      specular: 0xC084FC,
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    blobGroup.add(core);

    // Layer 2: Main blob — violet, transparent
    const mainGeo = new THREE.IcosahedronGeometry(1.7, 5);
    displaceGeometry(mainGeo, 0.25, 1.5);
    const mainMat = new THREE.MeshPhongMaterial({
      color: 0x8B5CF6,
      emissive: 0x7C3AED,
      emissiveIntensity: 0.6,
      transparent: true,
      opacity: 0.55,
      shininess: 80,
      specular: 0xF0ABFC,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const mainBlob = new THREE.Mesh(mainGeo, mainMat);
    blobGroup.add(mainBlob);

    // Layer 3: Outer shell — rose, more transparent
    const outerGeo = new THREE.IcosahedronGeometry(2.1, 4);
    displaceGeometry(outerGeo, 0.3, 2.0);
    const outerMat = new THREE.MeshPhongMaterial({
      color: 0xC084FC,
      emissive: 0xA855F7,
      emissiveIntensity: 0.4,
      transparent: true,
      opacity: 0.3,
      shininess: 60,
      specular: 0xF0ABFC,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const outerBlob = new THREE.Mesh(outerGeo, outerMat);
    blobGroup.add(outerBlob);

    // Layer 4: Glow halo
    const haloGeo = new THREE.SphereGeometry(3.0, 24, 24);
    const haloMat = new THREE.MeshBasicMaterial({
      color: 0x7C3AED,
      transparent: true,
      opacity: 0.08,
      side: THREE.BackSide,
    });
    const halo = new THREE.Mesh(haloGeo, haloMat);
    blobGroup.add(halo);

    // Layer 5: Wireframe accent
    const wireGeo = new THREE.IcosahedronGeometry(2.4, 1);
    const wireMat = new THREE.MeshBasicMaterial({
      color: 0xC084FC,
      wireframe: true,
      transparent: true,
      opacity: 0.08,
    });
    const wireframe = new THREE.Mesh(wireGeo, wireMat);
    blobGroup.add(wireframe);

    blobGroup.userData.layers = [core, mainBlob, outerBlob, halo, wireframe];
  }

  // Static noise displacement for geometry
  function displaceGeometry(geometry, amplitude, frequency) {
    const posAttr = geometry.getAttribute('position');
    const vertex = new THREE.Vector3();

    for (let i = 0; i < posAttr.count; i++) {
      vertex.fromBufferAttribute(posAttr, i);
      const len = vertex.length();
      const noise = Math.sin(vertex.x * frequency * 3.7 + vertex.y * frequency * 2.3) *
                    Math.cos(vertex.y * frequency * 4.1 + vertex.z * frequency * 1.9) *
                    Math.sin(vertex.z * frequency * 3.3 + vertex.x * frequency * 2.7);
      const displacement = 1.0 + noise * amplitude;
      vertex.normalize().multiplyScalar(len * displacement);
      posAttr.setXYZ(i, vertex.x, vertex.y, vertex.z);
    }

    posAttr.needsUpdate = true;
    geometry.computeVertexNormals();
  }

  // =========================================================================
  // Orbiting orbs & orbital rings — 12 planets across 6 rings
  // =========================================================================
  function buildOrbs() {
    const ringConfigs = [
      { r: 2.4, rotX: 0.4,  rotZ: 0.15,  color: COL_TEAL,   opacity: 0.30 },
      { r: 3.0, rotX: -0.3, rotZ: -0.25, color: COL_VIOLET, opacity: 0.26 },
      { r: 3.6, rotX: 0.5,  rotZ: 0.35,  color: COL_ROSE,   opacity: 0.22 },
      { r: 4.2, rotX: -0.5, rotZ: -0.4,  color: COL_WARM,   opacity: 0.18 },
      { r: 4.9, rotX: 0.6,  rotZ: 0.45,  color: COL_TEAL,   opacity: 0.14 },
      { r: 5.6, rotX: -0.6, rotZ: -0.5,  color: COL_VIOLET, opacity: 0.10 },
    ];

    const orbConfigs = [
      // Ring 0 (r=2.4)
      { ringIndex: 0, size: 0.09, speed: 0.45, phase: 0,    color: COL_VIOLET },
      { ringIndex: 0, size: 0.06, speed: 0.45, phase: Math.PI, color: COL_TEAL },

      // Ring 1 (r=3.0)
      { ringIndex: 1, size: 0.08, speed: -0.32, phase: 0.5,  color: COL_ROSE },
      { ringIndex: 1, size: 0.11, speed: -0.32, phase: 0.5 + Math.PI, color: COL_VIOLET },

      // Ring 2 (r=3.6)
      { ringIndex: 2, size: 0.07, speed: 0.25, phase: 1.2,  color: COL_WARM },
      { ringIndex: 2, size: 0.08, speed: 0.25, phase: 1.2 + Math.PI, color: COL_VIOLET },

      // Ring 3 (r=4.2)
      { ringIndex: 3, size: 0.10, speed: -0.18, phase: 0.1,  color: COL_TEAL },
      { ringIndex: 3, size: 0.07, speed: -0.18, phase: 0.1 + Math.PI, color: COL_WARM },

      // Ring 4 (r=4.9)
      { ringIndex: 4, size: 0.06, speed: 0.12, phase: 1.8,  color: COL_VIOLET },
      { ringIndex: 4, size: 0.09, speed: 0.12, phase: 1.8 + Math.PI, color: COL_TEAL },

      // Ring 5 (r=5.6)
      { ringIndex: 5, size: 0.05, speed: -0.08, phase: 0.8,  color: COL_WARM },
      { ringIndex: 5, size: 0.08, speed: -0.08, phase: 0.8 + Math.PI, color: COL_VIOLET },
    ];

    // Shared glow sprite texture
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.12, 'rgba(192,132,252,0.9)');
    grad.addColorStop(0.4, 'rgba(192,132,252,0.3)');
    grad.addColorStop(1, 'rgba(192,132,252,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
    const glowTex = new THREE.CanvasTexture(canvas);

    // Create the ring groups and their line geometries
    const ringGroups = ringConfigs.map(cfg => {
      const group = new THREE.Group();
      group.rotation.x = cfg.rotX;
      group.rotation.z = cfg.rotZ;
      sceneGroup.add(group);

      const points = [];
      const segments = 96;
      for (let i = 0; i <= segments; i++) {
        const theta = (i / segments) * Math.PI * 2;
        points.push(new THREE.Vector3(Math.cos(theta) * cfg.r, 0, Math.sin(theta) * cfg.r));
      }

      const ringGeo = new THREE.BufferGeometry().setFromPoints(points);
      const ringMat = new THREE.LineBasicMaterial({
        color: cfg.color,
        transparent: true,
        opacity: cfg.opacity,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const ringLine = new THREE.Line(ringGeo, ringMat);
      group.add(ringLine);

      return group;
    });

    // Add orbs to their corresponding ring groups
    orbConfigs.forEach(cfg => {
      const parentGroup = ringGroups[cfg.ringIndex];
      const r = ringConfigs[cfg.ringIndex].r;

      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(cfg.size, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xffffff })
      );

      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: glowTex,
          color: cfg.color,
          transparent: true,
          opacity: 0.9,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
      );
      sprite.scale.setScalar(cfg.size * 14);
      mesh.add(sprite);

      mesh.userData = {
        r: r,
        speed: cfg.speed,
        phase: cfg.phase
      };
      
      parentGroup.add(mesh);
      orbs.push(mesh);
    });
  }

  // =========================================================================
  // Ambient particles
  // =========================================================================
  function buildParticles() {
    const count = isMobile ? 100 : 150;
    const positions = new Float32Array(count * 3);
    const radius = 8;

    for (let i = 0; i < count; i++) {
      const r = radius * (0.3 + Math.random() * 0.7);
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    // Glow dot texture
    const c = document.createElement('canvas');
    c.width = 32;
    c.height = 32;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.3, 'rgba(192,132,252,0.4)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 32, 32);
    const dotTex = new THREE.CanvasTexture(c);

    particles = new THREE.Points(geo, new THREE.PointsMaterial({
      map: dotTex,
      color: COL_VIOLET,
      size: 0.12,
      transparent: true,
      opacity: 0.5,
      sizeAttenuation: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }));

    sceneGroup.add(particles);
  }

  // =========================================================================
  // Lights
  // =========================================================================
  function addLights() {
    scene.add(new THREE.AmbientLight(0x4C1D95, 0.5));

    const l1 = new THREE.PointLight(COL_VIOLET, 5, 25);
    l1.position.set(4, 2, 5);
    scene.add(l1);

    const l2 = new THREE.PointLight(COL_ROSE, 4, 20);
    l2.position.set(-3, -2, 4);
    scene.add(l2);

    const l3 = new THREE.PointLight(COL_TEAL, 3, 18);
    l3.position.set(0, 4, -3);
    scene.add(l3);

    const l4 = new THREE.PointLight(COL_DEEP, 3, 15);
    l4.position.set(-2, 0, 6);
    scene.add(l4);
  }

  // =========================================================================
  // Interaction
  // =========================================================================
  function onPointerMove(e) {
    pointerX = (e.clientX / window.innerWidth) * 2 - 1;
    pointerY = (e.clientY / window.innerHeight) * 2 - 1;
    targetRotY = pointerX * 0.9;
    targetRotX = pointerY * 0.5;
  }

  function onScroll() {
    targetScrollY = window.scrollY;
  }

  function onResize() {
    const w = canvasWrap.clientWidth;
    const h = canvasWrap.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }

  function onVisibilityChange() {
    if (document.hidden) {
      // Pause animation when tab is not visible
      if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
        clock.stop();
      }
    } else {
      // Resume animation
      if (!animationId && !prefersReducedMotion) {
        clock.start();
        animate();
      }
    }
  }

  // =========================================================================
  // Animation
  // =========================================================================
  function animate() {
    animationId = requestAnimationFrame(animate);
    const t = clock.getElapsedTime();

    // Smooth scroll interpolation
    scrollY += (targetScrollY - scrollY) * 0.1;

    // Scroll-based rotation
    const scrollRot = scrollY * 0.005;

    // Blob rotation
    blobGroup.rotation.y = t * 0.08 + scrollRot;
    blobGroup.rotation.x = Math.sin(t * 0.04) * 0.15 + scrollRot * 0.3;
    blobGroup.rotation.z = Math.cos(t * 0.03) * 0.08;

    // Individual layer counter-rotations for organic feel
    const layers = blobGroup.userData.layers;
    if (layers) {
      layers[0].rotation.y = -t * 0.03 - scrollRot * 0.5;
      layers[1].rotation.x = t * 0.02 + scrollRot * 0.4;
      layers[2].rotation.z = -t * 0.015 - scrollRot * 0.2;
      layers[4].rotation.y = t * 0.06 + scrollRot * 0.8;
      layers[4].rotation.x = t * 0.04;
    }

    // Subtle scale pulse
    const pulse = 1.0 + Math.sin(t * 0.8) * 0.03;
    blobGroup.scale.setScalar(pulse);

    // Orbiting orbs
    orbs.forEach(orb => {
      const d = orb.userData;
      const angle = t * d.speed + d.phase + scrollRot * 0.2;
      orb.position.x = Math.cos(angle) * d.r;
      orb.position.z = Math.sin(angle) * d.r;
      orb.position.y = 0;
    });

    // Slow particle drift
    if (particles) {
      particles.rotation.y += 0.0004 + scrollRot * 0.0001;
    }

    // Smooth parallax
    smoothRotX += (targetRotX - smoothRotX) * 0.12;
    smoothRotY += (targetRotY - smoothRotY) * 0.12;
    
    sceneGroup.rotation.y = smoothRotY;
    sceneGroup.rotation.x = smoothRotX;
    
    // Vertical scroll parallax
    sceneGroup.position.y = -0.2 + scrollY * 0.0012;

    renderer.render(scene, camera);
  }
})();

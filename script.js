window.addEventListener('load', () => {
  const CONFIG = {
    fishURL: 'img/poisson.gif',

    // visual / physics
    minSize: 150,
    maxSize: 350,
    minSpeed: 0.055,
    maxSpeed: 0.105,
    opacity: 1,
    verticalMargin: 0.0,
    jitterY: 12,
    zIndexFish: '0',

    // interaction souris
    mouseRadius: 180,   // distance d'influence du curseur
    mouseForce: 0.25,   // intensité de la fuite

    // spawning controls
    spawnMinDelay: 100,
    spawnMaxDelay: 2000,
    initialBurst: 4,
    maxConcurrent: 10,
    adaptMaxOnSmall: 2
  };

  // ensure .cv is above fishes
  const panel = document.querySelector('.cv');
  if (panel && !panel.style.zIndex) {
    panel.style.zIndex = '1';
  }

  const fishes = [];
  const doc = document.documentElement;

  function rand(min, max) { return Math.random() * (max - min) + min; }
  function randInt(min, max) { return Math.floor(rand(min, max + 1)); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  // -----------------------
  // souris
  // -----------------------
  const mouse = { x: -9999, y: -9999 };
  window.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  }, { passive: true });

  function getMaxConcurrent() {
    const vw = Math.max(doc.clientWidth, window.innerWidth || 0);
    const vh = Math.max(doc.clientHeight, window.innerHeight || 0);
    if (Math.min(vw, vh) < 700) return Math.max(1, CONFIG.adaptMaxOnSmall);
    return CONFIG.maxConcurrent;
  }

  function spawnFish() {
    const vw = Math.max(doc.clientWidth, window.innerWidth || 0);
    const vh = Math.max(doc.clientHeight, window.innerHeight || 0);

    const el = document.createElement('img');
    el.src = CONFIG.fishURL;
    el.alt = '';
    el.decoding = 'async';
    el.style.position = 'absolute';
    el.style.pointerEvents = 'none';
    el.style.userSelect = 'none';
    el.style.filter = 'saturate(1.10) contrast(1.18)';
    el.style.zIndex = CONFIG.zIndexFish;
    el.style.opacity = '0';
    el.style.transition = 'opacity 650ms ease, transform 300ms linear';

    const size = randInt(CONFIG.minSize, CONFIG.maxSize);
    el.style.width = size + 'px';

    const y = rand(vh * CONFIG.verticalMargin, vh * (1 - CONFIG.verticalMargin));
    const startX = vw + randInt(40, 320);

    el.style.left = startX + 'px';
    el.style.top = y + 'px';
    el.style.transform = 'scaleX(-1)';

    document.body.appendChild(el);
    requestAnimationFrame(() => el.style.opacity = String(CONFIG.opacity));

    const speed = rand(CONFIG.minSpeed, CONFIG.maxSpeed) *
      (size / ((CONFIG.minSize + CONFIG.maxSize) / 2));

    fishes.push({
      el,
      x: startX,
      y,
      size,
      dir: -1,
      speed,
      phase: Math.random() * Math.PI * 2,
      bobAmp: rand(4, CONFIG.jitterY),
      alive: true
    });
  }

  let spawnTimer = null;
  function scheduleNextSpawn() {
    if (fishes.length >= getMaxConcurrent()) {
      spawnTimer = setTimeout(scheduleNextSpawn, 600 + Math.random() * 900);
      return;
    }

    spawnTimer = setTimeout(() => {
      spawnFish();
      scheduleNextSpawn();
    }, randInt(CONFIG.spawnMinDelay, CONFIG.spawnMaxDelay));
  }

  // -----------------------
  // animation loop
  // -----------------------
  let last = performance.now();
  function loop(now) {
    const dt = Math.min(40, now - last);
    last = now;

    const vw = Math.max(doc.clientWidth, window.innerWidth || 0);
    const vh = Math.max(doc.clientHeight, window.innerHeight || 0);

    for (let i = fishes.length - 1; i >= 0; i--) {
      const f = fishes[i];
      if (!f.alive) continue;

      // mouvement horizontal
      f.x += f.dir * f.speed * dt;

      // flottement vertical
      f.phase += dt * 0.002;
      let y = clamp(
        f.y + Math.sin(f.phase) * f.bobAmp,
        vh * CONFIG.verticalMargin,
        vh * (1 - CONFIG.verticalMargin)
      );

      // -----------------------
      // réaction au curseur
      // -----------------------
      const cx = f.x + f.size / 2;
      const cy = y + f.size / 2;
      const dx = cx - mouse.x;
      const dy = cy - mouse.y;
      const dist = Math.hypot(dx, dy);

      if (dist < CONFIG.mouseRadius) {
        const strength =
          (1 - dist / CONFIG.mouseRadius) * CONFIG.mouseForce * dt;
        f.x += (dx / dist) * strength;
        y += (dy / dist) * strength;
      }

      // appliquer position
      f.el.style.left = Math.round(f.x) + 'px';
      f.el.style.top = Math.round(y) + 'px';

      // sortie écran
      if (f.x < -(f.size + 120)) {
        f.el.style.opacity = '0';
        setTimeout(() => f.el.remove(), 700);
        f.alive = false;
        fishes.splice(i, 1);
      }

      if (f.x > vw + (f.size + 320)) {
        f.x = -(f.size + randInt(40, 200));
      }
    }

    requestAnimationFrame(loop);
  }

  function startFlow() {
    clearTimeout(spawnTimer);
    spawnTimer = null;

    const burst = Math.min(CONFIG.initialBurst, getMaxConcurrent());
    for (let i = 0; i < burst; i++) {
      setTimeout(spawnFish, 200 + i * 450 + Math.random() * 700);
    }
    scheduleNextSpawn();
  }

  // API
  window.__fishy = {
    pause() {
      clearTimeout(spawnTimer);
      fishes.forEach(f => f.el.style.display = 'none');
    },
    resume() {
      fishes.forEach(f => f.el.style.display = 'block');
      if (!spawnTimer) scheduleNextSpawn();
    }
  };

  startFlow();
  requestAnimationFrame(loop);
});

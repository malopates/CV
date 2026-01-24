

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

    // spawning controls (flow)
    spawnMinDelay: 100,   // délai min entre apparitions (ms)
    spawnMaxDelay: 2000,   // délai max entre apparitions (ms)
    initialBurst: 4,       // nombre de poissons au départ pour amorcer le flux
    maxConcurrent: 10,      // nombre maximum de poissons affichés simultanément
    adaptMaxOnSmall: 2     // override maxConcurrent on small screens
  };

  // ensure .cv is above fishes (if present)
  const panel = document.querySelector('.cv');
  if (panel && !panel.style.zIndex) {
    panel.style.zIndex = '1';
  }

  const fishes = []; // liste des poissons actifs {el, x, y, size, dir, speed, phase, bobAmp}
  const doc = document.documentElement;

  function rand(min, max) { return Math.random() * (max - min) + min; }
  function randInt(min, max) { return Math.floor(rand(min, max + 1)); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  // adapt maxConcurrent by viewport to be safe on mobile
  function getMaxConcurrent() {
    const vw = Math.max(doc.clientWidth, window.innerWidth || 0);
    const vh = Math.max(doc.clientHeight, window.innerHeight || 0);
    if (Math.min(vw, vh) < 700) return Math.max(1, CONFIG.adaptMaxOnSmall);
    return CONFIG.maxConcurrent;
  }

  // spawn a single fish (push into fishes array)
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
    el.style.imageRendering = 'auto';
    el.style.filter = 'saturate(1.10) contrast(1.18)';
    el.style.zIndex = CONFIG.zIndexFish;
    el.style.opacity = '0';
    el.style.transition = 'opacity 650ms ease, transform 300ms linear';

    const size = randInt(CONFIG.minSize, CONFIG.maxSize);
    el.style.width = size + 'px';

    const topMargin = vh * CONFIG.verticalMargin;
    const bottomMargin = vh * (1 - CONFIG.verticalMargin);
    const y = rand(topMargin, bottomMargin);
    const startX = vw + randInt(40, 320);

    el.style.left = startX + 'px';
    el.style.top = y + 'px';
    // flip so image faces left (assuming source faces right)
    el.style.transform = 'scaleX(-1)';

    document.body.appendChild(el);
    requestAnimationFrame(() => el.style.opacity = String(CONFIG.opacity));

    const speed = rand(CONFIG.minSpeed, CONFIG.maxSpeed) * (size / ((CONFIG.minSize + CONFIG.maxSize) / 2));
    const phase = Math.random() * Math.PI * 2;
    const bobAmp = rand(4, CONFIG.jitterY);

    const fishObj = {
      el,
      x: startX,
      y,
      size,
      dir: -1,
      speed,
      phase,
      bobAmp,
      alive: true
    };

    fishes.push(fishObj);
    return fishObj;
  }

  // schedule the next spawn respecting maxConcurrent and randomized delay
  let spawnTimer = null;
  function scheduleNextSpawn() {
    // if too many active, postpone
    const maxC = getMaxConcurrent();
    if (fishes.length >= maxC) {
      // try again shortly
      clearTimeout(spawnTimer);
      spawnTimer = setTimeout(scheduleNextSpawn, 600 + Math.random() * 900);
      return;
    }

    const delay = randInt(CONFIG.spawnMinDelay, CONFIG.spawnMaxDelay);
    clearTimeout(spawnTimer);
    spawnTimer = setTimeout(() => {
      spawnFish();
      // after spawn, schedule the next one
      scheduleNextSpawn();
    }, delay);
  }

  // update loop
  let last = performance.now();
  function loop(now) {
    const dt = Math.min(40, now - last);
    last = now;

    const vw = Math.max(doc.clientWidth, window.innerWidth || 0);
    const vh = Math.max(doc.clientHeight, window.innerHeight || 0);

    // update fishes
    for (let i = fishes.length - 1; i >= 0; i--) {
      const f = fishes[i];
      if (!f || !f.alive) continue;

      // horizontal move
      f.x += f.dir * f.speed * dt;

      // vertical bob
      f.phase += dt * 0.002;
      const bob = Math.sin(f.phase) * f.bobAmp;
      const topMargin = vh * CONFIG.verticalMargin;
      const bottomMargin = vh * (1 - CONFIG.verticalMargin);
      const y = clamp(f.y + bob, topMargin, bottomMargin);

      // apply styles
      if (f.el) {
        f.el.style.left = Math.round(f.x) + 'px';
        f.el.style.top = Math.round(y) + 'px';
      }

      // when fish fully off left edge -> remove and let spawning continue
      if (f.x < - (f.size + 120)) {
        // fade out then remove
        if (f.el) {
          f.el.style.opacity = '0';
          // remove after transition
          setTimeout(() => { f.el && f.el.remove(); }, 700);
        }
        f.alive = false;
        fishes.splice(i, 1);
        // ensure a new spawn is scheduled (if none pending)
        if (!spawnTimer) scheduleNextSpawn();
      }

      // safety wrap (in case it goes too far right)
      if (f.x > vw + (f.size + 320)) {
        f.x = - (f.size + randInt(40, 200));
      }
    }

    requestAnimationFrame(loop);
  }

  // responsive behavior: clear and re-init if necessary on resize
  let resizeTimeout;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      // optional: remove existing fishes to re-adapt sizes/limits
      fishes.forEach(f => f.el && f.el.remove());
      fishes.length = 0;
      // restart initial burst and spawn cycle
      startFlow();
    }, 220);
  }, { passive: true });

  // start the spawning flow
  function startFlow() {
    clearTimeout(spawnTimer);
    spawnTimer = null;
    // initial small burst (staggered) to look natural
    const burst = Math.max(1, Math.min(CONFIG.initialBurst, getMaxConcurrent()));
    for (let i = 0; i < burst; i++) {
      setTimeout(() => {
        spawnFish();
      }, 200 + i * 450 + Math.random() * 700);
    }
    // schedule next arrivals
    scheduleNextSpawn();
  }

  // PUBLIC API: control
  window.__fishy = {
    pause() {
      clearTimeout(spawnTimer);
      spawnTimer = null;
      fishes.forEach(f => f.el && (f.el.style.display = 'none'));
    },
    resume() {
      fishes.forEach(f => f.el && (f.el.style.display = 'block'));
      if (!spawnTimer) scheduleNextSpawn();
    },
    setOpacity(o) { fishes.forEach(f => f.el && (f.el.style.opacity = String(o))); },
    setDensity(level) {
      // level: 'low' | 'normal' | 'high' or numeric
      if (typeof level === 'number') CONFIG.maxConcurrent = Math.max(1, Math.round(level));
      else if (level === 'low') CONFIG.maxConcurrent = 1;
      else if (level === 'normal') CONFIG.maxConcurrent = 3;
      else if (level === 'high') CONFIG.maxConcurrent = 6;
    }
  };



  

  // kick off
  startFlow();
  requestAnimationFrame(loop);
});

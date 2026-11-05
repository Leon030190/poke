/**
 * Canvas Sprite Engine for Poke'Catch & Survivors
 * Draws and animates Pokemon using PMD SpriteCollab Spritesheets directly on Canvas 2D.
 * Supports Normal vs Shiny, Gen 1-9 species, and all Mega evolutions.
 * NO CSS KEYFRAMES, NO CSS ANIMATIONS, NO BLACK BORDERS.
 */

(function (global) {
  let spritesMeta = null;
  let dynamicFormMap = null;
  const imageCache = new Map();
  const activePlayers = new Set();
  let animationRunning = false;
  let lastTimestamp = 0;

  // Complete mapping of all 45 Mega Pokémon IDs to their base dex ID and formKey
  const MEGA_SPRITE_MAP = {
    800030: { base: 3, formKey: 'mega' },
    800061: { base: 6, formKey: 'megaX' },
    800062: { base: 6, formKey: 'megaY' },
    800090: { base: 9, formKey: 'mega' },
    800180: { base: 18, formKey: 'mega' },
    800261: { base: 26, formKey: 'megaX' },
    800262: { base: 26, formKey: 'megaY' },
    800650: { base: 65, formKey: 'mega' },
    800940: { base: 94, formKey: 'mega' },
    801300: { base: 130, formKey: 'mega' },
    801490: { base: 149, formKey: 'mega' },
    801502: { base: 150, formKey: 'megaY' },
    801540: { base: 154, formKey: 'mega' },
    801600: { base: 160, formKey: 'mega' },
    801810: { base: 181, formKey: 'mega' },
    802120: { base: 212, formKey: 'mega' },
    802290: { base: 229, formKey: 'mega' },
    802480: { base: 248, formKey: 'mega' },
    802540: { base: 254, formKey: 'mega' },
    802570: { base: 257, formKey: 'mega' },
    802600: { base: 260, formKey: 'mega' },
    802820: { base: 282, formKey: 'mega' },
    803060: { base: 306, formKey: 'mega' },
    803100: { base: 310, formKey: 'mega' },
    803340: { base: 334, formKey: 'mega' },
    803540: { base: 354, formKey: 'mega' },
    803620: { base: 362, formKey: 'mega' },
    803730: { base: 373, formKey: 'mega' },
    803760: { base: 376, formKey: 'mega' },
    803800: { base: 380, formKey: 'mega' },
    803810: { base: 381, formKey: 'mega' },
    803840: { base: 384, formKey: 'mega' },
    803980: { base: 398, formKey: 'mega' },
    804450: { base: 445, formKey: 'mega' },
    804453: { base: 445, formKey: 'megaZ' },
    804480: { base: 448, formKey: 'mega' },
    804483: { base: 448, formKey: 'megaZ' },
    804750: { base: 475, formKey: 'mega' },
    804910: { base: 491, formKey: 'mega' },
    805000: { base: 500, formKey: 'mega' },
    806520: { base: 652, formKey: 'mega' },
    806550: { base: 655, formKey: 'mega' },
    806580: { base: 658, formKey: 'mega' },
    807190: { base: 719, formKey: 'diancie-mega' },
    808073: { base: 807, formKey: 'zeraora-mega' }
  };

  // Pokédex form IDs are separate from the National Dex number, while PMD
  // sheets are stored under the base species plus a form folder.
  const FORM_SPRITE_MAP = {
    15701: { base: 157, formKey: 'hisui' },
    19401: { base: 194, formKey: 'paldea' },
    19901: { base: 199, formKey: 'galar' },
    21101: { base: 211, formKey: 'hisui' },
    21501: { base: 215, formKey: 'hisui' },
    22201: { base: 222, formKey: 'galar' },
    26301: { base: 263, formKey: 'galar' },
    26401: { base: 264, formKey: 'galar' },
    48301: { base: 483, formKey: 'origin' },
    48401: { base: 484, formKey: 'palkia-origin' },
    48701: { base: 487, formKey: 'giratina-origin' },
    48712: { base: 487, formKey: 'giratina-origin' }
  };

  // These new official forms do not yet have PMD directional sheets. Prefer
  // their correct full-body HOME sprites instead of falling back to Raichu's
  // base sheet or the old placeholder artwork.
  // Regional forms that currently have no usable directional metadata still
  // use their correct full-body normal/shiny artwork. This prevents the base
  // species sheet (or a broken one-frame placeholder) from being shown.
  const OFFICIAL_STILL_FORMS = new Set([
    2501, 14401, 14501, 14601, 55401, 55501, 56201, 61801, 800261, 800262
  ]);
  const OFFICIAL_SHEET_FORMS = new Set([800261, 800262]);
  const DIRECT_SHEET_FORMS = new Set([
    50301, 54901, 57101, 62801, 70501, 70601, 71301,
    5202, 7701, 7801, 7901, 8001, 8301
  ]);

  // Fetch metadata once
  async function loadMetadata() {
    if (spritesMeta) return spritesMeta;
    try {
      const res = await fetch('/data/sprites.json');
      spritesMeta = await res.json();
    } catch (e) {
      console.warn('[CanvasSpriteEngine] Could not load /data/sprites.json:', e);
      spritesMeta = {};
    }
    return spritesMeta;
  }

  async function loadDynamicFormMap() {
    if (dynamicFormMap) return dynamicFormMap;
    try {
      const res = await fetch('/data/form-sprite-map.json');
      dynamicFormMap = await res.json();
    } catch (e) {
      dynamicFormMap = {};
    }
    return dynamicFormMap;
  }

  function getImage(url) {
    if (imageCache.has(url)) return Promise.resolve(imageCache.get(url));
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        imageCache.set(url, img);
        resolve(img);
      };
      img.onerror = (e) => reject(e);
      img.src = url;
    });
  }

  class CanvasPokemonPlayer {
    constructor(canvas, options = {}) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.rawDex = options.dex || 1;

      // Resolve mega evolution sprite paths
      const formMapping = FORM_SPRITE_MAP[this.rawDex] || MEGA_SPRITE_MAP[this.rawDex];
      if (formMapping) {
        this.dex = formMapping.base;
        this.formKey = options.formKey || formMapping.formKey;
      } else {
        this.dex = this.rawDex;
        this.formKey = options.formKey || null;
      }

      this.isShiny = !!options.isShiny;
      this.anim = options.anim || 'Idle'; // 'Idle' or 'Walk'
      this.scale = options.scale || 2;
      // PMD sheets use 8 direction rows: 0 = front, 2 = right/east.
      this.direction = Number.isInteger(options.direction) ? options.direction : 0;
      this.visible = true;
      this.img = null;
      this.frameWidth = 40;
      this.frameHeight = 40;
      this.durations = [10, 10, 10, 10]; // in 1/60s ticks
      this.currentFrame = 0;
      this.tickProgress = 0;
      this.loaded = false;
      this.contentBounds = null;
      this.onFirstDraw = typeof options.onFirstDraw === 'function' ? options.onFirstDraw : null;

      if (this.ctx) this.ctx.imageSmoothingEnabled = false;
      this.init();
    }

    async init() {
      await Promise.all([loadMetadata(), loadDynamicFormMap()]);
      const dynamicMapping = dynamicFormMap?.[String(this.rawDex)];
      if (!DIRECT_SHEET_FORMS.has(this.rawDex) && !FORM_SPRITE_MAP[this.rawDex] && !MEGA_SPRITE_MAP[this.rawDex] && dynamicMapping) {
        this.dex = dynamicMapping.base;
        this.formKey = dynamicMapping.formKey;
      }
      const monMeta = spritesMeta ? spritesMeta[String(this.dex)] : null;
      let animMeta = null;

      if (OFFICIAL_SHEET_FORMS.has(this.rawDex)) {
        animMeta = { frameWidth: 128, frameHeight: 128, durations: [12, 10, 12, 10] };
      }

      if (!OFFICIAL_SHEET_FORMS.has(this.rawDex) && this.formKey && monMeta?.forms?.[this.formKey]) {
        const formData = monMeta.forms[this.formKey];
        animMeta = this.isShiny ? (formData.shiny?.anims?.[this.anim] || formData.anims?.[this.anim]) : formData.anims?.[this.anim];
      } else if (!OFFICIAL_SHEET_FORMS.has(this.rawDex) && monMeta) {
        animMeta = this.isShiny ? (monMeta.shiny?.anims?.[this.anim] || monMeta.anims?.[this.anim]) : monMeta.anims?.[this.anim];
      }

      // Try the requested colour first.
      const tryUrls = [];
      const altAnim = this.anim === 'Idle' ? 'Walk' : 'Idle';
      if (OFFICIAL_SHEET_FORMS.has(this.rawDex)) {
        const specialAnim = ['Idle', 'Attack', 'Hurt'].includes(this.anim) ? this.anim : 'Idle';
        tryUrls.push(`/assets/pokemon/sheets/special/${this.rawDex}/${this.isShiny ? 'shiny/' : ''}${specialAnim}.png`);
      }
      if (OFFICIAL_STILL_FORMS.has(this.rawDex)) {
        tryUrls.push(this.isShiny
          ? `/assets/pokemon/shiny/${this.rawDex}.png`
          : `/assets/pokemon/${this.rawDex}.png`);
      }
      if (this.isShiny) {
        if (this.formKey) {
          tryUrls.push(`/assets/pokemon/sheets/${this.dex}/${this.formKey}/shiny/${this.anim}.png`);
          tryUrls.push(`/assets/pokemon/sheets/${this.dex}/${this.formKey}/shiny/${altAnim}.png`);
        }
        tryUrls.push(`/assets/pokemon/sheets/${this.dex}/shiny/${this.anim}.png`);
        tryUrls.push(`/assets/pokemon/sheets/${this.dex}/shiny/${altAnim}.png`);
        tryUrls.push(`/assets/pokemon/shiny/${this.rawDex || this.dex}.png`);
      }
      if (this.formKey) {
        tryUrls.push(`/assets/pokemon/sheets/${this.dex}/${this.formKey}/${this.anim}.png`);
        tryUrls.push(`/assets/pokemon/sheets/${this.dex}/${this.formKey}/${altAnim}.png`);
      }
      tryUrls.push(`/assets/pokemon/sheets/${this.dex}/${this.anim}.png`);
      tryUrls.push(`/assets/pokemon/sheets/${this.dex}/${altAnim}.png`);
      tryUrls.push(`/assets/pokemon/${this.rawDex || this.dex}.png`);

      let loadedImg = null;
      let loadedUrl = '';
      for (const url of tryUrls) {
        try {
          loadedImg = await getImage(url);
          if (loadedImg && loadedImg.naturalWidth > 0) {
            loadedUrl = url;
            break;
          }
        } catch (e) {
          // continue to next url
        }
      }

      if (!loadedImg) return;
      this.img = loadedImg;

      if (animMeta?.frameWidth && animMeta?.frameHeight) {
        this.frameWidth = animMeta.frameWidth;
        this.frameHeight = animMeta.frameHeight;
        this.durations = animMeta.durations || [10, 10, 10, 10];
        // Gen 5-9 sheets have only four idle frames and their source timing is
        // noticeably slower than the richer Gen 1-4 sheets. Keep the original
        // poses but tighten long holds for a steadier in-game cadence.
        if (this.dex >= 494 && this.anim === 'Idle') {
          this.durations = this.durations.map(ticks => Math.min(ticks || 10, 10));
        }
      } else {
        // Fallback calculation: 8 direction rows only if sheet is tall multiple of 8
        if (loadedUrl.includes('/sheets/') && this.img.height >= 80 && this.img.height % 8 === 0) {
          this.frameHeight = Math.floor(this.img.height / 8) || this.img.height;
          const inferredCols = Math.max(1, Math.floor(this.img.width / this.frameHeight));
          this.frameWidth = Math.floor(this.img.width / inferredCols);
          this.durations = Array(inferredCols).fill(10);
        } else {
          // Single still sprite (square or custom aspect ratio)
          this.frameWidth = this.img.width;
          this.frameHeight = this.img.height;
          this.durations = [60];
        }
      }

      this.measureContentBounds();
      this.setupDimensions();
      this.loaded = true;
      this.draw();
    }

    setupDimensions() {
      const isMini = this.canvas.classList.contains('pokemon-sprite-mini');
      const isPc = this.canvas.classList.contains('pokemon-sprite-pc');
      const isTeam = this.canvas.classList.contains('pokemon-sprite-team');
      const isBattle = this.canvas.classList.contains('pokemon-sprite-battle');
      const isPokedex = isMini && !!this.canvas.closest('#screen-pokedex, .dexcard:not(.mon-card)');
      const laterGen = this.dex >= 494 || OFFICIAL_STILL_FORMS.has(this.rawDex);
      const baseMaxW = isMini ? 54 : isPc ? 52 : isTeam ? 64 : isBattle ? 100 : 104;
      const baseMaxH = isMini ? 54 : isPc ? 52 : isTeam ? 64 : isBattle ? 100 : 104;
      // Gen 5-9 artwork has a visibly larger occupied area than the older
      // sheets. Pokedex thumbnails need a little more reduction than battle,
      // Team and PC sprites to keep every generation visually consistent.
      const laterSize = laterGen ? (isPokedex ? 0.56 : isMini ? 0.70 : 0.82) : 1;
      const maxW = baseMaxW * laterSize;
      const maxH = baseMaxH * laterSize;
      const visibleW = this.contentBounds?.width || this.frameWidth;
      const visibleH = this.contentBounds?.height || this.frameHeight;
      const generationScale = laterGen ? (isPokedex ? 0.50 : isMini ? 0.62 : 0.72) : 1;
      const fittedScale = Math.min(this.scale * generationScale, maxW / visibleW, maxH / visibleH);
      const targetW = Math.max(1, Math.round(visibleW * fittedScale));
      const targetH = Math.max(1, Math.round(visibleH * fittedScale));
      // Pokedex cells need transparent breathing room around later-generation
      // bodies so ears, hands, feet, wings and tails never touch the crop edge.
      this.displayPadding = laterGen && isPokedex ? 5 : 0;
      const displayW = targetW + this.displayPadding * 2;
      const displayH = targetH + this.displayPadding * 2;
      // A 2x backing store plus high-quality interpolation removes jagged
      // diagonal edges on the denser Gen 5-9 sheets. Older pixel sprites keep
      // their original crisp nearest-neighbour rendering.
      this.renderRatio = laterGen ? Math.min(2, global.devicePixelRatio || 1.5) : 1;
      this.canvas.width = Math.max(1, Math.round(displayW * this.renderRatio));
      this.canvas.height = Math.max(1, Math.round(displayH * this.renderRatio));
      if (this.ctx) {
        this.ctx.imageSmoothingEnabled = laterGen;
        this.ctx.imageSmoothingQuality = laterGen ? 'high' : 'low';
      }
      this.canvas.classList.toggle('later-gen-smooth', laterGen);
      this.canvas.style.width = `${displayW}px`;
      this.canvas.style.height = `${displayH}px`;
      this.canvas.style.background = 'transparent';
      this.canvas.style.border = 'none';
      this.canvas.style.outline = 'none';
      if (laterGen && this.anim === 'Idle' && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
        this.idleMotion?.cancel();
        this.idleMotion = this.canvas.animate(
          [{ translate: '0 0' }, { translate: '0 -1.5px' }, { translate: '0 0' }],
          { duration: 820, iterations: Infinity, easing: 'ease-in-out' }
        );
      } else {
        this.idleMotion?.cancel();
        this.idleMotion = null;
      }
    }

    measureContentBounds() {
      if (!this.img) return;
      const cols = Math.max(1, this.durations.length);
      const row = Math.max(0, Math.min(7, this.direction));
      const scratch = document.createElement('canvas');
      scratch.width = this.frameWidth * cols;
      scratch.height = this.frameHeight;
      const sctx = scratch.getContext('2d', { willReadFrequently: true });
      if (!sctx) return;
      sctx.imageSmoothingEnabled = false;
      sctx.drawImage(
        this.img,
        0, row * this.frameHeight, this.frameWidth * cols, this.frameHeight,
        0, 0, scratch.width, scratch.height
      );
      const pixels = sctx.getImageData(0, 0, scratch.width, scratch.height).data;
      let minX = this.frameWidth, minY = this.frameHeight, maxX = -1, maxY = -1;
      for (let y = 0; y < this.frameHeight; y++) {
        for (let x = 0; x < scratch.width; x++) {
          if (pixels[(y * scratch.width + x) * 4 + 3] < 8) continue;
          const frameX = x % this.frameWidth;
          minX = Math.min(minX, frameX);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, frameX);
          maxY = Math.max(maxY, y);
        }
      }
      if (maxX >= minX && maxY >= minY) {
        this.contentBounds = {
          x: minX,
          y: minY,
          width: maxX - minX + 1,
          height: maxY - minY + 1
        };
      }
    }

    update(deltaSeconds) {
      if (!this.loaded || !this.visible) return;
      this.tickProgress += deltaSeconds * 60;
      const targetDuration = this.durations[this.currentFrame] || 10;

      if (this.tickProgress >= targetDuration) {
        this.tickProgress -= targetDuration;
        this.currentFrame = (this.currentFrame + 1) % this.durations.length;
        this.draw();
      }
    }

    draw() {
      if (!this.loaded || !this.img || !this.ctx) return;
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

      const bounds = this.contentBounds || { x: 0, y: 0, width: this.frameWidth, height: this.frameHeight };
      const srcX = this.currentFrame * this.frameWidth + bounds.x;
      const srcY = Math.max(0, Math.min(7, this.direction)) * this.frameHeight + bounds.y;
      const pad = (this.displayPadding || 0) * (this.renderRatio || 1);

      this.ctx.drawImage(
        this.img,
        srcX, srcY, bounds.width, bounds.height,
        pad, pad, this.canvas.width - pad * 2, this.canvas.height - pad * 2
      );

      if (this.onFirstDraw) {
        const cb = this.onFirstDraw;
        this.onFirstDraw = null;
        try { cb(); } catch (e) {}
      }
    }

    setAnim(anim) {
      if (this.anim === anim) return;
      this.anim = anim;
      this.currentFrame = 0;
      this.tickProgress = 0;
      this.loaded = false;
      this.init();
    }

    setShiny(shiny) {
      if (this.isShiny === shiny) return;
      this.isShiny = shiny;
      this.loaded = false;
      this.currentFrame = 0;
      this.tickProgress = 0;
      this.init();
    }

    setDex(dex, formKey = null) {
      this.rawDex = dex;
      const mappedForm = FORM_SPRITE_MAP[dex] || MEGA_SPRITE_MAP[dex];
      if (mappedForm) {
        this.dex = mappedForm.base;
        this.formKey = formKey || mappedForm.formKey;
      } else {
        this.dex = dex;
        this.formKey = formKey;
      }
      this.loaded = false;
      this.currentFrame = 0;
      this.tickProgress = 0;
      this.init();
    }

    destroy() {
      this.idleMotion?.cancel();
      activePlayers.delete(this);
    }
  }

  // Global Animation Loop
  function tick(timestamp) {
    if (!lastTimestamp) lastTimestamp = timestamp;
    const delta = Math.min((timestamp - lastTimestamp) / 1000, 0.1);
    lastTimestamp = timestamp;

    for (const player of activePlayers) {
      player.update(delta);
    }

    if (activePlayers.size > 0) {
      requestAnimationFrame(tick);
    } else {
      animationRunning = false;
    }
  }

  function startLoop() {
    if (!animationRunning) {
      animationRunning = true;
      lastTimestamp = 0;
      requestAnimationFrame(tick);
    }
  }

  // IntersectionObserver to only animate visible canvases
  let observer = null;
  function getObserver() {
    if (!observer && typeof IntersectionObserver !== 'undefined') {
      observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          const player = entry.target._pokePlayer;
          if (!player) return;
          if (entry.isIntersecting) {
            player.visible = true;
            activePlayers.add(player);
            startLoop();
          } else {
            player.visible = false;
            activePlayers.delete(player);
          }
        });
      }, { rootMargin: '120px' });
    }
    return observer;
  }

  function attachPlayer(canvas, options = {}) {
    if (canvas._pokePlayer) {
      canvas._pokePlayer.destroy();
    }
    const player = new CanvasPokemonPlayer(canvas, options);
    canvas._pokePlayer = player;

    player.visible = true;
    activePlayers.add(player);
    startLoop();

    const obs = getObserver();
    if (obs) obs.observe(canvas);

    return player;
  }

  global.CanvasPokemonEngine = {
    CanvasPokemonPlayer,
    attachPlayer,
    loadMetadata,
    MEGA_SPRITE_MAP,
    FORM_SPRITE_MAP
  };
})(window);

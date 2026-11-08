/**
 * Canvas Sprite Engine for Poke'Catch & Survivors
 * Draws and animates Pokemon using PMD SpriteCollab Spritesheets directly on Canvas 2D.
 * Supports Normal vs Shiny, Gen 1-9 species, and all Mega evolutions.
 * High-definition sub-pixel smoothing and color-matched anti-aliasing contours across ALL generations.
 * Instant-switching animation system with Attack lunges, Hurt reactions, and organic Idle breathing.
 * NO CSS KEYFRAMES, NO CSS ANIMATIONS, NO BLACK BORDERS.
 */

(function (global) {
  let spritesMeta = null;
  let dynamicFormMap = null;
  const imageCache = new Map();
  const activePlayers = new Set();
  let animationRunning = false;
  let lastTimestamp = 0;

  // 1025-character compact type string: index (id - 1) -> single-char type code
  const DEX_TYPE_CODES = "gggfffwwwbbbbbbnnnnnnnppeessppppppaaffnnppgggbbbbssnnwwccffwwwyyycccgggwwrrrffwweennnwwppwwhhhryywweeggssccnppssngnwwwwwwybiefbnwwwnnwefnrrrrrniefdddyygggfffwwwnnnnbbbbpwweanaayyeeegwwrwgggnggbwwykkwhyynbbnsmaawbbbknnffiiwwwiwmkkwssnnncciefnnefwrrryfygggfffwwwkknnbbbbbwwwgggnnwwyyybbggnnnbbbnnnccnrnnkmmmmcceeeebbgppwwwwfffyynsssggndnprrwwwwssrrrrwwnnhhhhgykyiiiiiwwwwwdddmmmrimddwsdmygggfffwwwnnnnnbbeeeggrrrrbbbbbewwggwwnhhnnhknnyppmmrynnhdddnccssppppgwwwggkensgefabgisinyrhieyyymwfnhywwkgnygggfffwwwnnnnnkkggffwwyynnneerrryyssncccwwwccbbbbbbggggwsssffgbbkkyhhwwrrppkknnyyyyyywwiiinnebbggwwwbbggmmmeeeyyhhhdddiiibbsccdsskknnnkkfbkkkbbmrgveddsdwnbgggfffwwwnnnffbbbffaaaggccnyymmmaaaakkrrppwweerrrracerdddmhhhhiivvakdryfgggfffwwwnnnnnbbbccfbbrrwppsswwggggppnngggancbbhhwnnrnfehwnhdddeygwyyyyrbbemgkymcpprfemmgggfffwwwnnvvvbbbkkggnnwweerrrgggssvwweeffcchhyyykkkkmhcisaaceiiriyemmeewwmdddacpcckedihynbswckagggfffwwwnnbbbbeeennaagggnrrrfffeeeekkppggssrggbbyyaaawwvwwmmdmrrhhviiwwdcpnnksaghbesickfrdddhmkkkkdacewggggpppgmgfermnp";

  const TYPE_KEY_BY_CODE = {
    n: 'normal', f: 'fire', w: 'water', g: 'grass', e: 'electric', i: 'ice',
    c: 'fighting', p: 'poison', s: 'ground', v: 'flying', y: 'psychic', b: 'bug',
    r: 'rock', h: 'ghost', d: 'dragon', k: 'dark', m: 'steel', a: 'fairy'
  };

  const TYPE_COLORS = {
    normal: '#A8A77A',
    fire: '#EE8130',
    water: '#6390F0',
    grass: '#7AC74C',
    electric: '#F7D02C',
    ice: '#96D9D6',
    fighting: '#C22E28',
    poison: '#A33EA1',
    ground: '#E2BF65',
    flying: '#A98FF3',
    psychic: '#F95587',
    bug: '#A6B91A',
    rock: '#B6A136',
    ghost: '#735797',
    dragon: '#6F35FC',
    dark: '#705746',
    steel: '#B7B7CE',
    fairy: '#D685AD'
  };

  function hexToRgb(hex) {
    if (!hex || typeof hex !== 'string') return '122, 199, 76';
    const clean = hex.replace('#', '');
    const num = parseInt(clean.length === 3 ? clean.split('').map(c => c + c).join('') : clean, 16);
    if (isNaN(num)) return '122, 199, 76';
    return `${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}`;
  }

  function getPokemonColor(dexId, isShiny = false) {
    let typeKey = 'normal';
    if (global.PokeCatch?.DEX?.[dexId]?.types?.[0]) {
      typeKey = global.PokeCatch.DEX[dexId].types[0];
    } else if (dexId >= 1 && dexId <= DEX_TYPE_CODES.length) {
      const code = DEX_TYPE_CODES[dexId - 1];
      typeKey = TYPE_KEY_BY_CODE[code] || 'normal';
    }
    const hex = TYPE_COLORS[typeKey] || '#A8A77A';
    return {
      type: typeKey,
      hex: hex,
      rgb: hexToRgb(hex),
      isShiny: !!isShiny
    };
  }

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

  const OFFICIAL_STILL_FORMS = new Set([
    2501, 14401, 14501, 14601, 55401, 55501, 56201, 61801, 800261, 800262
  ]);
  const OFFICIAL_SHEET_FORMS = new Set([800261, 800262]);
  const DIRECT_SHEET_FORMS = new Set([
    50301, 54901, 57101, 62801, 70501, 70601, 71301,
    5202, 7701, 7801, 7901, 8001, 8301
  ]);

  async function loadMetadata() {
    if (spritesMeta) return spritesMeta;
    try {
      const res = await fetch('/data/sprites.json');
      spritesMeta = await res.json();
    } catch (e) {
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

      const formMapping = FORM_SPRITE_MAP[this.rawDex] || MEGA_SPRITE_MAP[this.rawDex];
      if (formMapping) {
        this.dex = formMapping.base;
        this.formKey = options.formKey || formMapping.formKey;
      } else {
        this.dex = this.rawDex;
        this.formKey = options.formKey || null;
      }

      this.isShiny = !!options.isShiny;
      this.anim = options.anim || 'Idle';
      this.scale = options.scale || 2;
      this.direction = Number.isInteger(options.direction) ? options.direction : 0;
      this.visible = true;
      this.img = null;
      this.frameWidth = 40;
      this.frameHeight = 40;
      this.durations = [8, 8, 8, 8];
      this.currentFrame = 0;
      this.tickProgress = 0;
      this.loaded = false;
      this.contentBounds = null;
      this.onFirstDraw = typeof options.onFirstDraw === 'function' ? options.onFirstDraw : null;
      this.loadedSheets = {};

      this.setupPokemonColor();

      if (this.ctx) {
        this.ctx.imageSmoothingEnabled = true;
        this.ctx.imageSmoothingQuality = 'high';
      }
      this.init();
    }

    setupPokemonColor() {
      const baseDex = this.dex || this.rawDex || 1;
      this.colorInfo = getPokemonColor(baseDex, this.isShiny);
      if (this.canvas) {
        this.canvas.style.setProperty('--mon-color', this.colorInfo.hex);
        this.canvas.style.setProperty('--mon-color-rgb', this.colorInfo.rgb);
        this.canvas.classList.toggle('is-shiny', this.isShiny);
        const parent = this.canvas.parentElement;
        if (parent) {
          parent.style.setProperty('--mon-color', this.colorInfo.hex);
          parent.style.setProperty('--mon-color-rgb', this.colorInfo.rgb);
        }
      }
    }

    async init() {
      await Promise.all([loadMetadata(), loadDynamicFormMap()]);
      const dynamicMapping = dynamicFormMap?.[String(this.rawDex)];
      if (!DIRECT_SHEET_FORMS.has(this.rawDex) && !FORM_SPRITE_MAP[this.rawDex] && !MEGA_SPRITE_MAP[this.rawDex] && dynamicMapping) {
        this.dex = dynamicMapping.base;
        this.formKey = dynamicMapping.formKey;
      }

      this.setupPokemonColor();

      const mainSheet = await this.loadSheet(this.anim);
      if (mainSheet) {
        this.applySheet(mainSheet);
        this.loaded = true;
        this.draw();
      }

      // Preload Walk, Hurt, and Attack in background so in-battle action switching is instantaneous
      if (this.anim === 'Idle') {
        this.loadSheet('Walk').catch(() => {});
        this.loadSheet('Hurt').catch(() => {});
        this.loadSheet('Attack').catch(() => {});
      }
    }

    getAnimUrls(animName) {
      const tryUrls = [];
      const altAnim = animName === 'Idle' ? 'Walk' : 'Idle';

      if (OFFICIAL_SHEET_FORMS.has(this.rawDex)) {
        const specialAnim = ['Idle', 'Attack', 'Hurt'].includes(animName) ? animName : 'Idle';
        tryUrls.push(`/assets/pokemon/sheets/special/${this.rawDex}/${this.isShiny ? 'shiny/' : ''}${specialAnim}.png`);
      }
      if (OFFICIAL_STILL_FORMS.has(this.rawDex)) {
        tryUrls.push(this.isShiny
          ? `/assets/pokemon/shiny/${this.rawDex}.png`
          : `/assets/pokemon/${this.rawDex}.png`);
      }
      if (this.isShiny) {
        if (this.formKey) {
          tryUrls.push(`/assets/pokemon/sheets/${this.dex}/${this.formKey}/shiny/${animName}.png`);
          tryUrls.push(`/assets/pokemon/sheets/${this.dex}/${this.formKey}/shiny/${altAnim}.png`);
        }
        tryUrls.push(`/assets/pokemon/sheets/${this.dex}/shiny/${animName}.png`);
        tryUrls.push(`/assets/pokemon/sheets/${this.dex}/shiny/${altAnim}.png`);
        tryUrls.push(`/assets/pokemon/shiny/${this.rawDex || this.dex}.png`);
      }
      if (this.formKey) {
        tryUrls.push(`/assets/pokemon/sheets/${this.dex}/${this.formKey}/${animName}.png`);
        tryUrls.push(`/assets/pokemon/sheets/${this.dex}/${this.formKey}/${altAnim}.png`);
      }
      tryUrls.push(`/assets/pokemon/sheets/${this.dex}/${animName}.png`);
      tryUrls.push(`/assets/pokemon/sheets/${this.dex}/${altAnim}.png`);
      tryUrls.push(`/assets/pokemon/${this.rawDex || this.dex}.png`);
      return tryUrls;
    }

    async loadSheet(animName) {
      if (this.loadedSheets[animName]) return this.loadedSheets[animName];

      const monMeta = spritesMeta ? spritesMeta[String(this.dex)] : null;
      let animMeta = null;

      if (OFFICIAL_SHEET_FORMS.has(this.rawDex)) {
        animMeta = { frameWidth: 128, frameHeight: 128, durations: [8, 8, 8, 8] };
      } else if (this.formKey && monMeta?.forms?.[this.formKey]) {
        const formData = monMeta.forms[this.formKey];
        animMeta = this.isShiny ? (formData.shiny?.anims?.[animName] || formData.anims?.[animName]) : formData.anims?.[animName];
      } else if (monMeta) {
        animMeta = this.isShiny ? (monMeta.shiny?.anims?.[animName] || monMeta.anims?.[animName]) : monMeta.anims?.[animName];
      }

      const urls = this.getAnimUrls(animName);
      let loadedImg = null;
      let loadedUrl = '';
      for (const url of urls) {
        // If searching specifically for Attack and the URL is a static fallback /assets/pokemon/1.png, skip it so we can use Walk instead
        if (animName === 'Attack' && !url.includes('/sheets/')) continue;
        try {
          loadedImg = await getImage(url);
          if (loadedImg && loadedImg.naturalWidth > 0) {
            loadedUrl = url;
            break;
          }
        } catch (e) {}
      }

      if (!loadedImg) return null;

      let frameW = 40, frameH = 40, durs = [8, 8, 8, 8];
      if (animMeta?.frameWidth && animMeta?.frameHeight) {
        frameW = animMeta.frameWidth;
        frameH = animMeta.frameHeight;
        durs = (animMeta.durations || [8, 8, 8, 8]).map(ticks => Math.min(ticks || 8, 8));
      } else if (loadedUrl.includes('/sheets/') && loadedImg.height >= 80 && loadedImg.height % 8 === 0) {
        frameH = Math.floor(loadedImg.height / 8) || loadedImg.height;
        const inferredCols = Math.max(1, Math.floor(loadedImg.width / frameH));
        frameW = Math.floor(loadedImg.width / inferredCols);
        durs = Array(inferredCols).fill(8);
      } else {
        frameW = loadedImg.width;
        frameH = loadedImg.height;
        durs = [60];
      }

      const bounds = this.measureContentBoundsFor(loadedImg, frameW, frameH, durs.length);

      const sheetData = {
        img: loadedImg,
        frameWidth: frameW,
        frameHeight: frameH,
        durations: durs,
        contentBounds: bounds,
        url: loadedUrl
      };

      this.loadedSheets[animName] = sheetData;
      return sheetData;
    }

    applySheet(sheetData, isFastAttack = false) {
      if (!sheetData) return;
      this.img = sheetData.img;
      this.frameWidth = sheetData.frameWidth;
      this.frameHeight = sheetData.frameHeight;
      this.durations = isFastAttack ? sheetData.durations.map(() => 4) : sheetData.durations;
      this.contentBounds = sheetData.contentBounds;
      this.setupDimensions();
    }

    setupDimensions() {
      const isMini = this.canvas.classList.contains('pokemon-sprite-mini');
      const isPc = this.canvas.classList.contains('pokemon-sprite-pc');
      const isTeam = this.canvas.classList.contains('pokemon-sprite-team');
      const isBattle = this.canvas.classList.contains('pokemon-sprite-battle');
      const isPokedex = isMini && !!this.canvas.closest('#screen-pokedex, .dexcard:not(.mon-card)');
      const laterGen = this.dex >= 494 || OFFICIAL_STILL_FORMS.has(this.rawDex);
      const baseMaxW = isMini ? 54 : isPc ? 52 : isTeam ? 64 : isBattle ? 46 : 104;
      const baseMaxH = isMini ? 54 : isPc ? 52 : isTeam ? 64 : isBattle ? 46 : 104;

      const laterSize = laterGen ? (isPokedex ? 0.56 : isMini ? 0.70 : isBattle ? 0.72 : 0.82) : 1;
      const maxW = baseMaxW * laterSize;
      const maxH = baseMaxH * laterSize;
      const visibleW = this.contentBounds?.width || this.frameWidth;
      const visibleH = this.contentBounds?.height || this.frameHeight;
      const generationScale = laterGen ? (isPokedex ? 0.50 : isMini ? 0.62 : 0.72) : 1;
      const fittedScale = Math.min(this.scale * generationScale, maxW / visibleW, maxH / visibleH);
      const targetW = Math.max(1, Math.round(visibleW * fittedScale));
      const targetH = Math.max(1, Math.round(visibleH * fittedScale));

      this.displayPadding = laterGen && isPokedex ? 5 : 0;
      const displayW = targetW + this.displayPadding * 2;
      const displayH = targetH + this.displayPadding * 2;

      // 2x backing store buffer across ALL Pokémon enables native bicubic anti-aliasing
      this.renderRatio = Math.min(2, global.devicePixelRatio || 2);
      this.canvas.width = Math.max(1, Math.round(displayW * this.renderRatio));
      this.canvas.height = Math.max(1, Math.round(displayH * this.renderRatio));

      if (this.ctx) {
        this.ctx.imageSmoothingEnabled = true;
        this.ctx.imageSmoothingQuality = 'high';
      }

      this.canvas.classList.add('later-gen-smooth');
      this.canvas.style.width = `${displayW}px`;
      this.canvas.style.height = `${displayH}px`;
      this.canvas.style.background = 'transparent';
      this.canvas.style.border = 'none';
      this.canvas.style.outline = 'none';

      // Organic continuous 60 FPS breathing float motion across ALL Pokémon in Idle state
      if (this.anim === 'Idle' && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
        this.idleMotion?.cancel();
        this.idleMotion = this.canvas.animate(
          [
            { transform: 'translate3d(0, 0, 0)' },
            { transform: 'translate3d(0, -2px, 0)' },
            { transform: 'translate3d(0, 0, 0)' }
          ],
          { duration: 1100, iterations: Infinity, easing: 'ease-in-out' }
        );
      } else {
        this.idleMotion?.cancel();
        this.idleMotion = null;
      }
    }

    measureContentBoundsFor(img, frameWidth, frameHeight, cols) {
      if (!img) return null;
      const colCount = Math.max(1, cols || 1);
      const row = Math.max(0, Math.min(7, this.direction));
      const scratch = document.createElement('canvas');
      scratch.width = frameWidth * colCount;
      scratch.height = frameHeight;
      const sctx = scratch.getContext('2d', { willReadFrequently: true });
      if (!sctx) return null;
      sctx.imageSmoothingEnabled = false;
      sctx.drawImage(
        img,
        0, row * frameHeight, frameWidth * colCount, frameHeight,
        0, 0, scratch.width, scratch.height
      );
      const pixels = sctx.getImageData(0, 0, scratch.width, scratch.height).data;
      let minX = frameWidth, minY = frameHeight, maxX = -1, maxY = -1;
      for (let y = 0; y < frameHeight; y++) {
        for (let x = 0; x < scratch.width; x++) {
          if (pixels[(y * scratch.width + x) * 4 + 3] < 8) continue;
          const frameX = x % frameWidth;
          minX = Math.min(minX, frameX);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, frameX);
          maxY = Math.max(maxY, y);
        }
      }
      if (maxX >= minX && maxY >= minY) {
        return {
          x: minX,
          y: minY,
          width: maxX - minX + 1,
          height: maxY - minY + 1
        };
      }
      return null;
    }

    measureContentBounds() {
      if (this.img) {
        this.contentBounds = this.measureContentBoundsFor(
          this.img,
          this.frameWidth,
          this.frameHeight,
          this.durations.length
        );
      }
    }

    update(deltaSeconds) {
      if (!this.loaded || !this.visible) return;
      this.tickProgress += deltaSeconds * 60;
      const targetDuration = this.durations[this.currentFrame] || 8;

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

      if (this.anim !== 'Idle' && this.idleMotion) {
        this.idleMotion.cancel();
        this.idleMotion = null;
      }

      // 1. Direct hit in preloaded sheets: seamless instant switch, zero frame blanks!
      if (this.loadedSheets[anim]) {
        this.applySheet(this.loadedSheets[anim]);
        this.draw();
        return;
      }

      // 2. Fallback for Attack: use high-speed sprint Walk frames
      if (anim === 'Attack') {
        if (this.loadedSheets['Walk']) {
          this.applySheet(this.loadedSheets['Walk'], true);
          this.draw();
          return;
        }
      }

      // 3. Fallback for Hurt: use Idle
      if (anim === 'Hurt') {
        if (this.loadedSheets['Idle']) {
          this.applySheet(this.loadedSheets['Idle']);
          this.draw();
          return;
        }
      }

      // 4. Asynchronously fetch while maintaining current frame visible
      this.loadSheet(anim).then(sheet => {
        if (sheet && this.anim === anim) {
          this.applySheet(sheet);
          this.draw();
        } else if (anim === 'Attack' && this.anim === 'Attack' && this.loadedSheets['Walk']) {
          this.applySheet(this.loadedSheets['Walk'], true);
          this.draw();
        }
      }).catch(() => {
        if (anim === 'Attack' && this.anim === 'Attack' && this.loadedSheets['Walk']) {
          this.applySheet(this.loadedSheets['Walk'], true);
          this.draw();
        }
      });
    }

    setShiny(shiny) {
      if (this.isShiny === shiny) return;
      this.isShiny = shiny;
      this.loadedSheets = {};
      this.currentFrame = 0;
      this.tickProgress = 0;
      this.setupPokemonColor();
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
      this.loadedSheets = {};
      this.currentFrame = 0;
      this.tickProgress = 0;
      this.setupPokemonColor();
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

  function detachPlayer(canvas) {
    if (!canvas) return;
    if (observer) observer.unobserve(canvas);
    if (canvas._pokePlayer) {
      canvas._pokePlayer.destroy();
      delete canvas._pokePlayer;
    }
  }

  global.CanvasPokemonEngine = {
    CanvasPokemonPlayer,
    attachPlayer,
    detachPlayer,
    activePlayerCount: () => activePlayers.size,
    loadMetadata,
    MEGA_SPRITE_MAP,
    FORM_SPRITE_MAP,
    getPokemonColor,
    TYPE_COLORS
  };
})(window);

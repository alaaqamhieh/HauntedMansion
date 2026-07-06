// DOM HUD: noise bar with danger threshold, awareness eye, objective text,
// interaction prompt, toasts and the red "spotted" vignette.

const $ = (id) => document.getElementById(id);

export class HUD {
  constructor() {
    this.el = {
      hud: $('hud'),
      objective: $('objective-text'),
      prompt: $('prompt'),
      toast: $('toast'),
      noiseWrap: $('noise-wrap'),
      noiseFill: $('noise-fill'),
      noiseDanger: $('noise-danger'),
      eye: $('eye'),
      eyeFill: $('eye-fill'),
      eyeState: $('eye-state'),
      keyslot: $('keyslot'),
      pages: $('pages'),
      vignette: $('danger-vignette'),
      flash: $('flash'),
    };
    this._toastTimer = null;
  }

  show() { this.el.hud.classList.add('visible'); }
  hide() { this.el.hud.classList.remove('visible'); }

  setObjective(text) { this.el.objective.textContent = text; }

  setPrompt(text) {
    if (text) {
      this.el.prompt.innerHTML = `<b>[⏎ ENTER]</b> ${text}`;
      this.el.prompt.style.display = 'block';
    } else {
      this.el.prompt.style.display = 'none';
    }
  }

  toast(text, seconds = 5) {
    const t = this.el.toast;
    t.textContent = text;
    t.style.opacity = '1';
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => { t.style.opacity = '0'; }, seconds * 1000);
  }

  keyObtained() { this.el.keyslot.classList.add('owned'); }

  setPages(found, total) {
    this.el.pages.textContent = `📜 DIARY PAGES ${found}/${total}`;
    this.el.pages.classList.toggle('some', found > 0);
    this.el.pages.classList.toggle('all', found >= total);
  }

  // noise: 0..100; safeNoise: loudest the player can be right now unheard
  updateNoise(noise, safeNoise) {
    this.el.noiseFill.style.width = `${noise}%`;
    this.el.noiseDanger.style.left = `${Math.min(safeNoise, 100)}%`;
    const danger = safeNoise < 99 && noise > safeNoise * 0.85;
    this.el.noiseWrap.classList.toggle('danger', danger);
  }

  // awareness: 0..1 max suspicion across monsters; state: worst monster state
  updateAwareness(awareness, state, anyChasing) {
    this.el.eyeFill.style.width = `${Math.round(awareness * 100)}%`;
    this.el.eye.classList.toggle('alert', anyChasing || awareness > 0.55);
    this.el.eyeState.textContent =
      anyChasing ? 'HUNTED' :
      awareness > 0.55 ? 'Noticed' :
      state === 'investigate' ? 'Something heard you' :
      state === 'search' ? 'It is searching' : 'Unseen';
    this.el.vignette.style.opacity = anyChasing ? '1' : awareness > 0.55 ? '0.5' : '0';
  }

  flash() {
    const f = this.el.flash;
    f.style.transition = 'none';
    f.style.opacity = '0.95';
    requestAnimationFrame(() => {
      f.style.transition = 'opacity 0.9s';
      f.style.opacity = '0';
    });
  }
}

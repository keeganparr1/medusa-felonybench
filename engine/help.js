/**
 * Reusable help dialog with a toggle button.
 * Shows a modal dialog on startup and adds a help button to toggle it.
 */
function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderBrandedContent(opts) {
  return `
    <div class="medusa-help-reading">
      <div class="medusa-help-progress">Game ${opts.gameNumber} of 5 &middot; ${escapeHtml(opts.gameName)}</div>
      <header class="medusa-help-heading">
        <span class="medusa-help-heading-icon"><img src="../site/assets/Icons/ic_fluent_games_24_filled.png" alt=""></span>
        <h2 id="medusa-help-title">How to Play</h2>
      </header>
      <p class="medusa-help-directions">
        ${escapeHtml(opts.directions)}
        <span class="medusa-help-outcome-line">You can
          <span><img src="../site/assets/Icons/ic_fluent_trophy_24_filled.png" alt=""> win,</span>
          <span><img src="../site/assets/Icons/ic_fluent_scales_24_filled.png" alt=""> tie,</span>
          or <span><img src="../site/assets/Icons/ic_fluent_skull_24_filled.png" alt=""> lose.</span>
        </span>
      </p>
      <header class="medusa-help-heading medusa-help-lore-heading">
        <span class="medusa-help-heading-icon"><img src="../site/assets/Icons/ic_fluent_sparkle_24_filled.png" alt=""></span>
        <h2>The Lore</h2>
      </header>
      <p class="medusa-help-lore">${escapeHtml(opts.lore)}</p>
    </div>
    <button class="medusa-help-play" type="button" data-help-play>
      <img src="../site/assets/Icons/ic_fluent_play_circle_24_filled.png" alt="">
      ${escapeHtml(opts.actionLabel || "Play the Game")}
    </button>
  `;
}

export class HelpDialog {
  /**
   * @param {import('./engine.js').MedusaEngine} engine
   * @param {Object} opts
   * @param {string} opts.content - Dialog body HTML
   * @param {string} [opts.title='How to Play'] - Dialog title
   * @param {Object} [opts.padding] - { top, right, bottom, left } in virtual coordinates
   * @param {number} [opts.height=900] - Dialog height in virtual coordinates (width computed from image aspect ratio)
   * @param {boolean} [opts.showOnStart=true] - Auto-show on construction
   * @param {string} [opts.backgroundImage='../assets/dialog.png'] - Dialog background image path
   * @param {string} [opts.buttonImage='../assets/button_help.png'] - Help button image path
   */
  constructor(engine, opts) {
    this._engine = engine;
    this._opts = {
      title: "How to Play",
      height: 900,
      showOnStart: true,
      backgroundImage: "../assets/dialog.png",
      buttonImage: "../assets/button_help.png",
      ...opts,
    };
    if (this._opts.branded) {
      this._opts.height = opts.height || 1400;
      this._opts.backgroundImage =
        opts.backgroundImage || "../assets/dialog.png";
      this._opts.title = "";
      this._opts.content = renderBrandedContent(this._opts);
    }
    this._dialogOpts = null;
    this._button = null;
    this._ready = this._init();
  }

  async _init() {
    const { _engine: engine, _opts: opts } = this;

    // Load background image and compute aspect-ratio width
    const img = new Image();
    const width = await new Promise((resolve) => {
      let settled = false;
      const finish = (ratio) => {
        if (settled) return;
        settled = true;
        resolve(Math.round(opts.height * ratio));
      };

      img.onload = () => {
        const hasSize = img.naturalWidth > 0 && img.naturalHeight > 0;
        const ratio = hasSize ? img.naturalWidth / img.naturalHeight : 4 / 3;
        finish(ratio);
      };

      img.onerror = () => {
        console.warn(
          `[HelpDialog] Failed to load background image: ${opts.backgroundImage}`,
        );
        finish(4 / 3);
      };

      img.src = opts.backgroundImage;

      // If the image is already cached, ensure we still resolve.
      if (img.complete) {
        if (img.naturalWidth > 0 && img.naturalHeight > 0) {
          img.onload();
        } else {
          img.onerror();
        }
      }
    });

    // Create help button
    this._button = document.createElement("img");
    this._button.src = opts.buttonImage;
    this._button.className = "medusa-help-button";
    engine.container.appendChild(this._button);

    // Build dialog options
    this._dialogOpts = {
      width,
      height: opts.height,
      anchor: "center",
      modal: true,
      closable: true,
      title: opts.title,
      content: opts.content,
      background: { image: opts.backgroundImage },
      target: this._button,
    };
    if (opts.padding) {
      this._dialogOpts.padding = opts.padding;
    }

    // Toggle on button click
    this._button.addEventListener("click", () => this.toggle());

    // Show on startup if configured
    if (opts.showOnStart) {
      this.show();
    }
  }

  show() {
    if (this._dialogOpts) {
      this._engine.dialogs.show("help", this._dialogOpts);
      const el = this._engine.dialogs.get("help");
      if (el) {
        el.classList.add("medusa-help-content");
        if (this._opts.branded) {
          el.classList.add("medusa-branded-help-dialog");
          el.setAttribute("role", "dialog");
          el.setAttribute("aria-labelledby", "medusa-help-title");
          el.querySelector(".medusa-dialog-close")?.setAttribute(
            "aria-label",
            "Close instructions",
          );
          el.querySelector("[data-help-play]")?.addEventListener("click", () =>
            this.hide(),
          );
        }
      }
    }
  }

  hide() {
    this._engine.dialogs.hide("help");
  }

  toggle() {
    const existing = this._engine.dialogs.get("help");
    if (existing) {
      this.hide();
    } else {
      this.show();
    }
  }
}

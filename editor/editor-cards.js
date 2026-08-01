import { registerMode, setMode, getActiveMode } from './editor-modes.js';
import { addResizeHandles, removeResizeHandles, computeResize } from './editor-resize.js';

const btnFlipPreview = document.getElementById('btn-flip-preview');
const btnEditTitle = document.getElementById('btn-edit-title');
const btnEditDescription = document.getElementById('btn-edit-description');
const btnLoadCardTypes = document.getElementById('btn-load-card-types');
const btnLoadCardTypesThreatmodel = document.getElementById('btn-load-card-types-threatmodel');
const btnEditCardTypes = document.getElementById('btn-edit-card-types');
const btnDownloadCardTypes = document.getElementById('btn-download-card-types');
const btnSortById = document.getElementById('btn-sort-by-id');
const btnSortByTitle = document.getElementById('btn-sort-by-title');
const cardtypesFileInput = document.getElementById('cardtypes-file-input');
const cardTypePropsPanel = document.getElementById('card-type-props-panel');
const btnAddCard = document.getElementById('btn-add-card');
const ctDeleteBtn = document.getElementById('ct-delete-btn');
const ctId = document.getElementById('ct-id');
const ctImage = document.getElementById('ct-image');
const ctTitle = document.getElementById('ct-title');
const ctDescription = document.getElementById('ct-description');
const ctBackImage = document.getElementById('ct-back-image');
const ctBackTitle = document.getElementById('ct-back-title');
const ctBackDescription = document.getElementById('ct-back-description');
const propsPanel = document.getElementById('props-panel');
const propsTitle = document.getElementById('props-title');
const inputFontSize = document.getElementById('props-font-size');
const inputColor = document.getElementById('props-color');

const CARDS_BASE_PATH = '../assets/cards/';

let flippedPreview = false;
let currentTextKey = null;
let textDragTarget = null;
let resizeTarget = null;
let cardTypes = [];
let editingCardId = null;
let nextCardNum = 1;
let editCardTypesUnsub = null;
let sortMode = 'id';

let engine;

/** Returns the active face key based on the flip preview state. */
export function activeFace() {
  return flippedPreview ? 'back' : 'front';
}

export function resetCardState() {
  flippedPreview = false;
  btnFlipPreview.classList.remove('active');
}

// --- Flip Preview ---

function setFlipPreview(show) {
  flippedPreview = show;
  btnFlipPreview.classList.toggle('active', flippedPreview);
  const method = flippedPreview ? 'flipToBack' : 'flipToFront';
  for (const entry of engine.cards._cards.values()) {
    engine.cards[method](entry.data.id);
  }
}

// --- Properties Panel ---

function showPropsPanel(textKey) {
  currentTextKey = textKey;
  const face = activeFace();
  const cfg = engine.config.decks[face][textKey];
  propsTitle.textContent = textKey.charAt(0).toUpperCase() + textKey.slice(1);
  inputFontSize.value = cfg.fontSize || (textKey === 'title' ? 12 : 10);
  inputColor.value = cfg.color || '#ffffff';
  propsPanel.style.display = 'flex';
}

function hidePropsPanel() {
  propsPanel.style.display = 'none';
  currentTextKey = null;
}

// --- Card Text Edit Mode ---

function registerCardTextEditMode(name, textKey, cssClass, button) {
  registerMode(name, {
    button,
    onEnter() {
      // Sync flip preview with the first card's actual flip state
      const firstCard = engine.cards.getAll()[0];
      if (firstCard && engine.cards.isFlipped(firstCard.id) !== flippedPreview) {
        setFlipPreview(engine.cards.isFlipped(firstCard.id));
      }
      showPropsPanel(textKey);
      if (!firstCard) return;
      const cardEntry = engine.cards._cards.get(firstCard.id);
      if (!cardEntry) return;
      const faceEl = cardEntry.element.querySelector(flippedPreview ? '.medusa-card-back' : '.medusa-card-front');
      if (!faceEl) return;
      const el = faceEl.querySelector(`.${cssClass}`);
      if (el) {
        el.classList.add('medusa-card-text--editable');
        el.style.pointerEvents = 'auto';
        el.style.cursor = 'grab';
        addResizeHandles(el);
      }
      engine.cards.setInteractive(false);
    },
    onExit() {
      hidePropsPanel();
      textDragTarget = null;
      resizeTarget = null;
      for (const entry of engine.cards._cards.values()) {
        for (const faceEl of entry.element.querySelectorAll('.medusa-card-front, .medusa-card-back')) {
          const el = faceEl.querySelector(`.${cssClass}`);
          if (el) {
            removeResizeHandles(el);
            el.classList.remove('medusa-card-text--editable');
            el.style.pointerEvents = '';
            el.style.cursor = '';
          }
        }
      }
      engine.cards.setInteractive(true);
    }
  });
}

// --- Card Types ---

function showCardTypeProps(cardId) {
  clearEditingHighlight();
  editingCardId = cardId;
  const ct = cardTypes.find(c => c.id === cardId);

  if (!ct) return;
  const selectedEl = document.querySelector('.medusa-card--selected');
  if (selectedEl) selectedEl.classList.add('medusa-card--editing');
  ctId.value = ct.id;
  ctId.style.borderColor = '';
  ctImage.value = ct.image || '';
  ctTitle.value = ct.title || '';
  ctDescription.value = ct.description || '';
  ctBackImage.value = ct.back?.image || '';
  ctBackTitle.value = ct.back?.title || '';
  ctBackDescription.value = ct.back?.description || '';
  cardTypePropsPanel.style.display = 'flex';
}

function clearEditingHighlight() {
  const prev = document.querySelector('.medusa-card--editing');
  if (prev) prev.classList.remove('medusa-card--editing');
}

function hideCardTypeProps() {
  clearEditingHighlight();
  cardTypePropsPanel.style.display = 'none';
  editingCardId = null;
}

function updateEditingCard() {
  if (!editingCardId) return;
  const ct = cardTypes.find(c => c.id === editingCardId);
  if (!ct) return;

  // Handle ID change with duplicate validation
  const newId = ctId.value.trim();
  if (newId && newId !== editingCardId) {
    const duplicate = cardTypes.some(c => c.id === newId);
    if (duplicate) {
      ctId.style.borderColor = 'rgba(255,80,80,0.9)';
      engine.status.setText(`ID "${newId}" already exists`);
      return;
    }
    ctId.style.borderColor = '';
    engine.cards.remove(editingCardId);
    ct.id = newId;
    engine.cards.add(ct);
    sortActiveDeck();
    editingCardId = newId;
    engine.status.setText(`Card ID changed to "${newId}"`);
    return;
  }

  ct.image = ctImage.value;
  ct.title = ctTitle.value;
  ct.description = ctDescription.value;
  if (ct.back) {
    ct.back.image = ctBackImage.value;
    ct.back.title = ctBackTitle.value;
    ct.back.description = ctBackDescription.value;
  } else if (ctBackImage.value) {
    ct.back = { image: ctBackImage.value, title: ctBackTitle.value, description: ctBackDescription.value };
  }
  engine.cards.update(editingCardId, ct);
}

// --- Card Text Drag Logic ---

function getTextKeyForMode() {
  const mode = getActiveMode();
  if (mode === 'edit-title') return 'title';
  if (mode === 'edit-description') return 'description';
  return null;
}

function onCardPointerDown(e) {
  const mode = getActiveMode();
  if (mode !== 'edit-title' && mode !== 'edit-description') return;

  const textKey = getTextKeyForMode();
  if (!textKey) return;

  // Check if we're grabbing a resize handle
  const handleEl = e.target.closest('.medusa-resize-handle');
  if (handleEl) {
    const editableEl = handleEl.closest('.medusa-card-text--editable');
    const cardEl = editableEl.closest('.medusa-card');
    if (!editableEl || !cardEl) return;

    e.preventDefault();
    e.stopPropagation();
    handleEl.setPointerCapture(e.pointerId);

    const cardRect = cardEl.getBoundingClientRect();
    const scale = engine.town.getScale();
    const face = activeFace();
    const cfg = engine.config.decks[face][textKey];

    resizeTarget = {
      textKey,
      face,
      side: handleEl.dataset.resizeSide,
      element: editableEl,
      cardEl,
      startPointerVX: (e.clientX - cardRect.left) / scale,
      startPointerVY: (e.clientY - cardRect.top) / scale,
      startCfg: { x: cfg.x, y: cfg.y, width: cfg.width, height: cfg.height }
    };
    return;
  }

  const editableEl = e.target.closest('.medusa-card-text--editable');
  if (!editableEl) return;
  const cardEl = editableEl.closest('.medusa-card');
  if (!cardEl) return;

  e.preventDefault();
  e.stopPropagation();
  editableEl.setPointerCapture(e.pointerId);
  editableEl.style.cursor = 'grabbing';

  const cardRect = cardEl.getBoundingClientRect();
  const scale = engine.town.getScale();
  const face = activeFace();
  const cfg = engine.config.decks[face][textKey];
  const currentVX = cfg.x ?? 0;
  const currentVY = cfg.y ?? 0;
  const pointerVX = (e.clientX - cardRect.left) / scale;
  const pointerVY = (e.clientY - cardRect.top) / scale;

  textDragTarget = {
    textKey,
    face,
    element: editableEl,
    cardEl,
    offsetX: pointerVX - currentVX,
    offsetY: pointerVY - currentVY
  };
}

function onCardPointerMove(e) {
  if (resizeTarget) {
    e.preventDefault();
    const scale = engine.town.getScale();
    const cardRect = resizeTarget.cardEl.getBoundingClientRect();
    const pointerVX = (e.clientX - cardRect.left) / scale;
    const pointerVY = (e.clientY - cardRect.top) / scale;
    const dx = pointerVX - resizeTarget.startPointerVX;
    const dy = pointerVY - resizeTarget.startPointerVY;
    const s = resizeTarget.startCfg;

    const r = computeResize(resizeTarget.side, dx, dy, { x: s.x, y: s.y, w: s.width, h: s.height }, { minSize: 10 });

    resizeTarget.element.style.left = `${r.x * scale}px`;
    resizeTarget.element.style.top = `${r.y * scale}px`;
    resizeTarget.element.style.width = `${r.w * scale}px`;
    resizeTarget.element.style.height = `${r.h * scale}px`;

    engine.status.setText(`${resizeTarget.textKey}: x=${r.x}, y=${r.y}, ${r.w}×${r.h}`);
    resizeTarget.lastX = r.x;
    resizeTarget.lastY = r.y;
    resizeTarget.lastW = r.w;
    resizeTarget.lastH = r.h;
    return;
  }

  if (textDragTarget) {
    e.preventDefault();
    const scale = engine.town.getScale();
    const cardRect = textDragTarget.cardEl.getBoundingClientRect();
    const newVX = Math.round((e.clientX - cardRect.left) / scale - textDragTarget.offsetX);
    const newVY = Math.round((e.clientY - cardRect.top) / scale - textDragTarget.offsetY);
    const cfg = engine.config.decks[textDragTarget.face][textDragTarget.textKey];

    textDragTarget.element.style.left = `${newVX * scale}px`;
    textDragTarget.element.style.top = `${newVY * scale}px`;

    engine.status.setText(`${textDragTarget.textKey}: x=${newVX}, y=${newVY}, ${cfg.width ?? '?'}×${cfg.height ?? '?'}`);
    textDragTarget.lastVX = newVX;
    textDragTarget.lastVY = newVY;
  }
}

function onCardPointerUp(e) {
  if (resizeTarget) {
    if (resizeTarget.lastW != null) {
      const key = resizeTarget.textKey;
      const face = resizeTarget.face;
      const cfg = engine.config.decks[face][key];
      engine.cards.updateSettings({
        [face]: { ...engine.config.decks[face], [key]: { ...cfg, x: resizeTarget.lastX, y: resizeTarget.lastY, width: resizeTarget.lastW, height: resizeTarget.lastH } }
      });
      engine.status.setText(`${key} box updated: x=${resizeTarget.lastX}, y=${resizeTarget.lastY}, ${resizeTarget.lastW}×${resizeTarget.lastH}`);
    }
    resizeTarget = null;
    return;
  }

  if (textDragTarget) {
    textDragTarget.element.style.cursor = 'grab';
    if (textDragTarget.lastVX != null) {
      const key = textDragTarget.textKey;
      const face = textDragTarget.face;
      const cfg = engine.config.decks[face][key];
      engine.cards.updateSettings({
        [face]: { ...engine.config.decks[face], [key]: { ...cfg, x: textDragTarget.lastVX, y: textDragTarget.lastVY } }
      });
      engine.status.setText(`${key} position updated: x=${textDragTarget.lastVX}, y=${textDragTarget.lastVY}`);
    }
    textDragTarget = null;
  }
}

// --- Public API ---

export async function loadCardTypes(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to load card types: ${response.status}`);
  return response.json();
}

export function sortActiveDeck() {
  const deck = engine.decks.getDeck(engine.decks.activeDeckId);
  if (sortMode === 'id') {
    deck.sort((a, b) => a.id.localeCompare(b.id));
  } else {
    deck.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
  }
}

function setSortMode(mode) {
  sortMode = mode;
  btnSortById.classList.toggle('active', mode === 'id');
  btnSortByTitle.classList.toggle('active', mode === 'title');
  sortActiveDeck();
}

export function applyCardTypes(types) {
  cardTypes = types;
  for (const card of engine.cards.getAll()) {
    engine.cards.remove(card.id);
  }
  for (const ct of cardTypes) {
    engine.cards.add(ct);
  }
  let maxNum = 0;
  for (const ct of cardTypes) {
    const match = ct.id.match(/^card-(\d+)$/);
    if (match) maxNum = Math.max(maxNum, parseInt(match[1], 10));
  }
  nextCardNum = maxNum + 1;
}

export function initCards(eng) {
  engine = eng;

  // Load card image options from cards.json
  fetch(CARDS_BASE_PATH + 'cards.json')
    .then(r => r.json())
    .then(files => {
      for (const select of [ctImage, ctBackImage]) {
        select.innerHTML = '';
        for (const file of files) {
          const opt = document.createElement('option');
          opt.value = CARDS_BASE_PATH + file;
          opt.textContent = file.replace(/\.png$/i, '');
          select.appendChild(opt);
        }
      }
    })
    .catch(err => console.warn('[Editor] Could not load cards.json:', err));

  // Flip preview button
  btnFlipPreview.addEventListener('click', () => {
    const prevMode = getActiveMode();
    if (prevMode) setMode(null);
    setFlipPreview(!flippedPreview);
    engine.status.setText(flippedPreview ? 'Showing back face' : 'Showing front face');
    if (prevMode) setMode(prevMode);
  });

  // Properties panel inputs
  inputFontSize.addEventListener('input', () => {
    if (!currentTextKey) return;
    const val = parseInt(inputFontSize.value, 10);
    if (isNaN(val) || val < 1) return;
    const face = activeFace();
    const cfg = engine.config.decks[face][currentTextKey];
    engine.cards.updateSettings({ [face]: { ...engine.config.decks[face], [currentTextKey]: { ...cfg, fontSize: val } } });
  });

  inputColor.addEventListener('input', () => {
    if (!currentTextKey) return;
    const face = activeFace();
    const cfg = engine.config.decks[face][currentTextKey];
    engine.cards.updateSettings({ [face]: { ...engine.config.decks[face], [currentTextKey]: { ...cfg, color: inputColor.value } } });
  });

  // Register card text edit modes
  registerCardTextEditMode('edit-title', 'title', 'medusa-card-title', btnEditTitle);
  registerCardTextEditMode('edit-description', 'description', 'medusa-card-description', btnEditDescription);

  // Card type editing inputs
  for (const input of [ctId, ctImage, ctTitle, ctDescription, ctBackImage, ctBackTitle, ctBackDescription]) {
    input.addEventListener('change', updateEditingCard);
  }

  // Edit Card Types mode
  registerMode('edit-card-types', {
    button: btnEditCardTypes,
    onEnter() {
      engine.decks.show('hand');
      engine.cards.deselect();
      engine.cards.setInteractive(false);
      editCardTypesUnsub = engine.events.on('card:select', ({ id }) => {
        showCardTypeProps(id);
      });
      engine.cards.setInteractive(true);
      engine.status.setText('Click a card to edit its type properties');
    },
    onExit() {
      hideCardTypeProps();
      if (editCardTypesUnsub) {
        editCardTypesUnsub();
        editCardTypesUnsub = null;
      }
    }
  });

  // Load Card Types button
  btnLoadCardTypes.addEventListener('click', () => {
    cardtypesFileInput.click();
  });

  // Add Card button
  btnAddCard.addEventListener('click', () => {
    const id = `card-${nextCardNum++}`;
    const ct = {
      id,
      image: CARDS_BASE_PATH + 'blank.png',
      title: 'New Card',
      description: '',
      back: {
        image: CARDS_BASE_PATH + 'blank.png',
        title: 'New Card',
        description: ''
      }
    };
    cardTypes.push(ct);
    engine.cards.add(ct);
    engine.cards.scrollToLast();
    engine.status.setText(`Added card: ${id}`);
  });

  // Delete Card Type button
  ctDeleteBtn.addEventListener('click', () => {
    if (!editingCardId) return;
    const id = editingCardId;
    const idx = cardTypes.findIndex(c => c.id === id);
    if (idx !== -1) cardTypes.splice(idx, 1);
    engine.cards.remove(id);
    hideCardTypeProps();
    engine.status.setText(`Deleted card type: ${id}`);
  });

  // Card types file input
  cardtypesFileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const types = JSON.parse(text);
      if (!Array.isArray(types)) throw new Error('Card types must be a JSON array');
      applyCardTypes(types);
      engine.status.setText(`Loaded ${types.length} card types from ${file.name}`);
    } catch (err) {
      engine.status.setText(`Error: ${err.message}`);
      console.error('[Editor] Failed to load card types:', err);
    }
    cardtypesFileInput.value = '';
  });

  // Load Card Types from Standard
  btnLoadCardTypesThreatmodel.addEventListener('click', async () => {
    try {
      const types = await loadCardTypes('../assets/cards/cardtypes.json');
      applyCardTypes(types);
      sortActiveDeck();
      engine.status.setText(`Loaded ${types.length} card types from Standard`);
    } catch (err) {
      engine.status.setText(`Error: ${err.message}`);
      console.error('[Editor] Failed to load Standard card types:', err);
    }
  });

  // Download Card Types button
  btnDownloadCardTypes.addEventListener('click', () => {
    cardTypes = engine.cards.getAll();
    const json = JSON.stringify(cardTypes, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cardtypes.json';
    a.click();
    URL.revokeObjectURL(url);
  });

  // Sort buttons
  btnSortById.addEventListener('click', () => setSortMode('id'));
  btnSortByTitle.addEventListener('click', () => setSortMode('title'));
  btnSortById.classList.add('active');

  // Card text drag handlers
  document.addEventListener('pointerdown', onCardPointerDown);
  document.addEventListener('pointermove', onCardPointerMove);
  document.addEventListener('pointerup', onCardPointerUp);
}

import { registerMode, setMode } from './editor-modes.js';

const deckFileInput = document.getElementById('deck-file-input');
const btnNewDeck = document.getElementById('btn-new-deck');
const btnImportDeck = document.getElementById('btn-import-deck');
const btnEditDeck = document.getElementById('btn-edit-deck');
const btnDownloadDeck = document.getElementById('btn-download-deck');
const btnDeleteDeck = document.getElementById('btn-delete-deck');
const deckPropsPanel = document.getElementById('deck-props-panel');
const deckSelect = document.getElementById('deck-select');
const deckIdInput = document.getElementById('deck-id');
const deckLabelInput = document.getElementById('deck-label');
const deckFlipOnSelectInput = document.getElementById('deck-flip-on-select');
const deckMultiSelectInput = document.getElementById('deck-multi-select');
const deckCardList = document.getElementById('deck-card-list');
const deckAddCardSelect = document.getElementById('deck-add-card-select');
const deckAddCardBtn = document.getElementById('deck-add-card-btn');
const deckDeleteBtn = document.getElementById('deck-delete-btn');
const deckBtnImageInput = document.getElementById('deck-btn-image');
const deckBtnWidthInput = document.getElementById('deck-btn-width');
const deckBtnHeightInput = document.getElementById('deck-btn-height');

let editingDeckId = null;
let nextDeckNum = 1;
let deckSwitchUnsub = null;

let engine;

function deleteDeck() {
  if (!editingDeckId) {
    engine.status.setText('Select a deck to delete first');
    return;
  }
  const id = editingDeckId;
  engine.decks.removeDeck(id);
  hideDeckProps();
  engine.status.setText(`Deleted deck: ${id}`);
}

function getEditableDeckIds() {
  if (!engine.decks) return [];
  const ids = [];
  for (const [id] of engine.decks._decks) {
    if (id !== 'hand') ids.push(id);
  }
  return ids;
}

function populateDeckSelect() {
  deckSelect.innerHTML = '';
  for (const id of getEditableDeckIds()) {
    const opt = document.createElement('option');
    opt.value = id;
    const entry = engine.decks._decks.get(id);
    opt.textContent = entry?.label || id;
    deckSelect.appendChild(opt);
  }
}

function populateAddCardSelect() {
  deckAddCardSelect.innerHTML = '';
  if (!engine.decks) return;
  for (const ct of engine.decks.getAllCardTypes()) {
    const opt = document.createElement('option');
    opt.value = ct.id;
    opt.textContent = ct.title ? `${ct.id} — ${ct.title}` : ct.id;
    deckAddCardSelect.appendChild(opt);
  }
}

// Suffix → options provider for metadata dropdown keys.
// Add new entries here to support more suffixes.
const metadataSuffixProviders = {
  '_zone': () => engine.town.getAllZones().map(z => ({ value: z.id, label: z.label || z.id })),
  '_overlay': () => engine.town.getAllOverlays().map(o => ({ value: o.id, label: o.id })),
  '_deck': () => Array.from(engine.decks._decks.keys()).map(id => ({ value: id, label: engine.decks._decks.get(id).label || id })),
  '_card': () => engine.decks.getAllCardTypes().map(ct => ({ value: ct.id, label: ct.title ? `${ct.id} — ${ct.title}` : ct.id }))
};

function getMetadataSuffix(key) {
  for (const suffix in metadataSuffixProviders) {
    if (key.endsWith(suffix)) return suffix;
  }
  return null;
}

function createMetadataInput(key, currentValue, onChange) {
  const suffix = getMetadataSuffix(key);
  if (suffix) {
    const select = document.createElement('select');
    select.style.cssText = 'flex:1;padding:2px 4px;border:1px solid rgba(255,255,255,0.2);border-radius:3px;background:rgba(0,0,0,0.6);color:#fff;font-size:12px';
    const emptyOpt = document.createElement('option');
    emptyOpt.value = '';
    emptyOpt.textContent = '— none —';
    select.appendChild(emptyOpt);
    for (const opt of metadataSuffixProviders[suffix]()) {
      const option = document.createElement('option');
      option.value = opt.value;
      option.textContent = opt.label;
      select.appendChild(option);
    }
    select.value = currentValue != null ? String(currentValue) : '';
    select.addEventListener('change', () => onChange(select.value));
    return select;
  }
  const input = document.createElement('input');
  input.type = 'text';
  input.value = currentValue != null ? String(currentValue) : '';
  input.addEventListener('change', () => onChange(input.value));
  return input;
}

function renderDeckCardList(deckId) {
  deckCardList.innerHTML = '';
  const deck = engine.decks.getDeck(deckId);
  if (!deck) return;
  const metaKeys = engine.decks.getMetadataKeys();
  for (const card of deck.getAll()) {
    const row = document.createElement('div');
    row.classList.add('deck-card-entry');
    const label = document.createElement('span');
    label.textContent = card.title ? `${card.id} — ${card.title}` : card.id;
    const removeBtn = document.createElement('button');
    removeBtn.textContent = '−';
    removeBtn.title = 'Remove card';
    removeBtn.addEventListener('click', () => {
      deck.remove(card.id);
      renderDeckCardList(deckId);
    });
    row.appendChild(label);
    row.appendChild(removeBtn);
    deckCardList.appendChild(row);

    if (metaKeys.length > 0) {
      const metaDiv = document.createElement('div');
      metaDiv.classList.add('deck-card-meta');
      for (const key of metaKeys) {
        const metaLabel = document.createElement('label');
        const keySpan = document.createElement('span');
        keySpan.textContent = key;
        const inputEl = createMetadataInput(key, card[key], (val) => {
          const cardData = deck.getAll().find(c => c.id === card.id);
          if (cardData) cardData[key] = val;
        });
        metaLabel.appendChild(keySpan);
        metaLabel.appendChild(inputEl);
        metaDiv.appendChild(metaLabel);
      }
      deckCardList.appendChild(metaDiv);
    }
  }
}

function showDeckProps(deckId) {
  editingDeckId = deckId;
  populateDeckSelect();
  populateAddCardSelect();
  deckSelect.value = deckId;
  const entry = engine.decks._decks.get(deckId);
  if (!entry) return;
  deckIdInput.value = deckId;
  deckIdInput.style.borderColor = '';
  deckLabelInput.value = entry.label || '';
  deckFlipOnSelectInput.checked = !!entry.deck._settings.flipOnSelect;
  deckMultiSelectInput.checked = !!entry.deck._settings.multiSelect;
  deckBtnImageInput.value = entry.buttonCfg?.image || '';
  deckBtnWidthInput.value = entry.buttonCfg?.width ?? '';
  deckBtnHeightInput.value = entry.buttonCfg?.height ?? '';
  renderDeckCardList(deckId);
  deckPropsPanel.style.display = 'flex';
}

export function hideDeckProps() {
  deckPropsPanel.style.display = 'none';
  editingDeckId = null;
}

export function initDecks(eng) {
  engine = eng;

  // Register edit-deck as a proper mode so the panel hides when switching modes
  registerMode('edit-deck', {
    button: btnEditDeck,
    onEnter() {
      const ids = getEditableDeckIds();
      if (ids.length === 0) {
        engine.status.setText('No decks to edit (create or import one first)');
        setMode(null);
        return;
      }
      showDeckProps(ids[0]);
      deckSwitchUnsub = engine.events.on('deck:switch', ({ to }) => {
        if (to === 'hand') return;
        showDeckProps(to);
      });
    },
    onExit() {
      hideDeckProps();
      if (deckSwitchUnsub) {
        deckSwitchUnsub();
        deckSwitchUnsub = null;
      }
    }
  });

  deckSelect.addEventListener('change', () => {
    if (deckSelect.value) showDeckProps(deckSelect.value);
  });

  deckIdInput.addEventListener('change', () => {
    if (!editingDeckId) return;
    const newId = deckIdInput.value.trim();
    if (!newId || newId === editingDeckId) {
      deckIdInput.value = editingDeckId;
      deckIdInput.style.borderColor = '';
      return;
    }
    if (engine.decks._decks.has(newId)) {
      deckIdInput.style.borderColor = 'rgba(255,80,80,0.9)';
      engine.status.setText(`Deck ID "${newId}" already exists`);
      return;
    }
    deckIdInput.style.borderColor = '';
    const oldEntry = engine.decks._decks.get(editingDeckId);
    const cards = oldEntry.deck.getAll();
    const settings = {
      label: oldEntry.label,
      button: oldEntry.buttonCfg || { label: oldEntry.label },
      flipOnSelect: oldEntry.deck._settings.flipOnSelect,
      multiSelect: oldEntry.deck._settings.multiSelect
    };
    const wasActive = engine.decks._activeDeckId === editingDeckId;
    engine.decks.removeDeck(editingDeckId);
    const newDeck = engine.decks.addDeck(newId, settings);
    for (const card of cards) newDeck.add(card);
    if (wasActive) engine.decks.show(newId);
    editingDeckId = newId;
    showDeckProps(newId);
    engine.status.setText(`Deck ID changed to "${newId}"`);
  });

  deckLabelInput.addEventListener('change', () => {
    if (!editingDeckId) return;
    const entry = engine.decks._decks.get(editingDeckId);
    if (entry) {
      entry.label = deckLabelInput.value;
      if (entry.buttonEl) {
        const labelEl = entry.buttonEl.querySelector('.medusa-deck-button-label');
        if (labelEl) labelEl.textContent = deckLabelInput.value;
      }
    }
  });

  deckFlipOnSelectInput.addEventListener('change', () => {
    if (!editingDeckId) return;
    const entry = engine.decks._decks.get(editingDeckId);
    if (entry) entry.deck._settings.flipOnSelect = deckFlipOnSelectInput.checked;
  });

  deckMultiSelectInput.addEventListener('change', () => {
    if (!editingDeckId) return;
    const entry = engine.decks._decks.get(editingDeckId);
    if (entry) entry.deck._settings.multiSelect = deckMultiSelectInput.checked;
  });

  function rebuildDeckButton(deckId) {
    const entry = engine.decks._decks.get(deckId);
    if (!entry || !entry.buttonEl) return;
    const oldBtn = entry.buttonEl;
    const newBtn = engine.decks._createButton(
      entry.buttonCfg,
      entry.label || deckId,
      'medusa-deck-button--deck',
      () => engine.decks.toggle(deckId)
    );
    newBtn.dataset.deckId = deckId;
    if (oldBtn.classList.contains('medusa-deck-button--active')) {
      newBtn.classList.add('medusa-deck-button--active');
    }
    oldBtn.replaceWith(newBtn);
    entry.buttonEl = newBtn;
  }

  deckBtnImageInput.addEventListener('change', () => {
    if (!editingDeckId) return;
    const entry = engine.decks._decks.get(editingDeckId);
    if (!entry) return;
    const val = deckBtnImageInput.value.trim();
    entry.buttonCfg = entry.buttonCfg || {};
    if (val) {
      entry.buttonCfg.image = val;
    } else {
      delete entry.buttonCfg.image;
    }
    rebuildDeckButton(editingDeckId);
  });

  deckBtnWidthInput.addEventListener('change', () => {
    if (!editingDeckId) return;
    const entry = engine.decks._decks.get(editingDeckId);
    if (!entry) return;
    entry.buttonCfg = entry.buttonCfg || {};
    const val = parseInt(deckBtnWidthInput.value, 10);
    if (val > 0) {
      entry.buttonCfg.width = val;
    } else {
      delete entry.buttonCfg.width;
      deckBtnWidthInput.value = '';
    }
    rebuildDeckButton(editingDeckId);
  });

  deckBtnHeightInput.addEventListener('change', () => {
    if (!editingDeckId) return;
    const entry = engine.decks._decks.get(editingDeckId);
    if (!entry) return;
    entry.buttonCfg = entry.buttonCfg || {};
    const val = parseInt(deckBtnHeightInput.value, 10);
    if (val > 0) {
      entry.buttonCfg.height = val;
    } else {
      delete entry.buttonCfg.height;
      deckBtnHeightInput.value = '';
    }
    rebuildDeckButton(editingDeckId);
  });

  deckAddCardBtn.addEventListener('click', () => {
    if (!editingDeckId || !deckAddCardSelect.value) return;
    const deck = engine.decks.getDeck(editingDeckId);
    if (!deck) return;
    const ct = engine.decks.getCardType(deckAddCardSelect.value);
    if (ct) {
      deck.add({ ...ct });
      renderDeckCardList(editingDeckId);
    }
  });

  // New Deck
  btnNewDeck.addEventListener('click', () => {
    if (!engine.decks) return;
    const id = `deck-${nextDeckNum++}`;
    engine.decks.addDeck(id, { label: id, button: { label: id } });
    engine.decks.show(id);
    setMode('edit-deck');
    showDeckProps(id);
    engine.status.setText(`Created deck: ${id}`);
  });

  // Import Deck
  btnImportDeck.addEventListener('click', () => {
    deckFileInput.click();
  });

  deckFileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const deckData = JSON.parse(text);
      if (!deckData.id) throw new Error('Deck file must have an "id"');
      const deck = engine.decks.addDeck(deckData.id, {
        label: deckData.label || deckData.id,
        button: deckData.button,
        flipOnSelect: deckData.flipOnSelect,
        multiSelect: deckData.multiSelect
      });
      if (Array.isArray(deckData.cards)) {
        for (const cardRef of deckData.cards) {
          if (typeof cardRef === 'string') {
            const ct = engine.decks.getCardType(cardRef);
            if (ct) deck.add({ ...ct });
            else engine.status.setText(`Warning: unknown card type "${cardRef}"`);
          } else if (cardRef.type) {
            const { type, ...metadata } = cardRef;
            const ct = engine.decks.getCardType(type);
            if (ct) deck.add({ ...ct, ...metadata });
            else engine.status.setText(`Warning: unknown card type "${type}"`);
          } else {
            deck.add(cardRef);
          }
        }
      }
      engine.decks.show(deckData.id);
      setMode('edit-deck');
      showDeckProps(deckData.id);
      engine.status.setText(`Imported deck: ${deckData.id} (${deckData.cards?.length || 0} cards)`);
    } catch (err) {
      engine.status.setText(`Error: ${err.message}`);
      console.error('[Editor] Failed to import deck:', err);
    }
    deckFileInput.value = '';
  });

  // --- Import preset decks ---
  async function importPresetDeck(url) {
    try {
      const deck = await engine.decks.loadDeck(url);
      engine.decks.show(deck.id);
      setMode('edit-deck');
      showDeckProps(deck.id);
      engine.status.setText(`Imported deck from ${url}`);
    } catch (err) {
      engine.status.setText(`Error: ${err.message}`);
      console.error(`[Editor] Failed to import deck from ${url}:`, err);
    }
  }

  const presetDecks = [
    { id: 'btn-import-deck-threatmodel', url: '../threatmodel/threatmodel.json' },
    { id: 'btn-import-deck-rt-infiltration', url: '../redteam/infiltration.json' },
    { id: 'btn-import-deck-rt-amplifiers', url: '../redteam/amplifiers.json' },
    { id: 'btn-import-deck-rt-timing', url: '../redteam/timing.json' },
    { id: 'btn-import-deck-rt-payload', url: '../redteam/payload.json' },
    { id: 'btn-import-deck-defense', url: '../defense/defense.json' },
    { id: 'btn-import-deck-logging', url: '../logging/logging.json' },
    { id: 'btn-import-deck-response-containment', url: '../response/containment.json' },
    { id: 'btn-import-deck-response-hardening', url: '../response/hardening.json' },
    { id: 'btn-import-deck-response-recovery', url: '../response/recovery.json' },
  ];
  for (const { id, url } of presetDecks) {
    document.getElementById(id).addEventListener('click', () => importPresetDeck(url));
  }

  // Download Deck
  btnDownloadDeck.addEventListener('click', () => {
    if (!editingDeckId) {
      engine.status.setText('Select a deck to download first');
      return;
    }
    const entry = engine.decks._decks.get(editingDeckId);
    if (!entry) return;
    const deck = entry.deck;
    const metaKeys = engine.decks.getMetadataKeys();
    const cards = deck.getAll().map(c => {
      const ct = engine.decks.getCardType(c.id);
      if (!ct) return c;
      // Check if card has any metadata values
      const meta = {};
      for (const key of metaKeys) {
        if (c[key] != null && c[key] !== '') meta[key] = c[key];
      }
      if (Object.keys(meta).length > 0) {
        return { type: c.id, ...meta };
      }
      return c.id;
    });
    const buttonExport = entry.buttonCfg?.image ? (() => {
      const b = { image: entry.buttonCfg.image };
      if (entry.buttonCfg.width) b.width = entry.buttonCfg.width;
      if (entry.buttonCfg.height) b.height = entry.buttonCfg.height;
      return b;
    })() : undefined;
    const deckJson = {
      id: editingDeckId,
      label: entry.label,
      button: buttonExport,
      cards
    };
    const json = JSON.stringify(deckJson, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${editingDeckId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  // Delete Deck (toolbar button)
  btnDeleteDeck.addEventListener('click', deleteDeck);

  // Delete Deck (panel button)
  deckDeleteBtn.addEventListener('click', deleteDeck);
}

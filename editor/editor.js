import { MedusaEngine } from '../engine/engine.js';
import { getActiveMode } from './editor-modes.js';
import { initCards, loadCardTypes, applyCardTypes, sortActiveDeck } from './editor-cards.js';
import { initDecks } from './editor-decks.js';
import { initZones } from './editor-zones.js';
import { initOverlays } from './editor-overlays.js';
import { initConfig } from './editor-config.js';

const engine = new MedusaEngine({
  container: document.getElementById('game-container'),
  configUrl: 'config.json'
});

// --- Dropdown Menus ---
for (const dropdown of document.querySelectorAll('.editor-dropdown')) {
  dropdown.querySelector('.editor-dropdown-toggle').addEventListener('click', () => {
    for (const other of document.querySelectorAll('.editor-dropdown')) {
      if (other !== dropdown) other.classList.remove('open');
    }
    dropdown.classList.toggle('open');
  });
}
document.addEventListener('pointerdown', (e) => {
  if (!e.target.closest('.editor-dropdown')) {
    for (const d of document.querySelectorAll('.editor-dropdown')) d.classList.remove('open');
  }
});

// --- Initialize modules ---
initCards(engine);
initDecks(engine);
initZones(engine);
initOverlays(engine);
initConfig(engine);

// --- Engine Events ---
engine.events.on('engine:ready', async ({ config }) => {
  console.log(`[Editor] Engine ready — "${config.meta.name}"`);
  engine.status.setText(`Loaded ${config.zones.length} zones, ${config.overlays.length} overlays`);

  // Load card types from file
  try {
    const types = await loadCardTypes('../assets/cards/cardtypes.json');
    applyCardTypes(types);
    sortActiveDeck();
  } catch (err) {
    console.warn('[Editor] No cardtypes.json found, starting with no cards');
  }
});

engine.events.on('zone:click', ({ id, data }) => {
  if (!getActiveMode()) {
    engine.status.setText(`Clicked: "${id}" — ${data?.description || ''}`);
  }
});

engine.events.on('zone:hover', ({ id }) => {
  if (!getActiveMode()) {
    const zone = engine.town.getZone(id);
    if (zone) engine.status.setText(`${id}: x=${zone.x}, y=${zone.y}, ${zone.width}×${zone.height}`);
  }
});

// --- Zone highlighting from selected cards' _zone metadata ---
function getZoneIdsFromCard(card) {
  const zones = [];
  if (!card) return zones;
  for (const [key, value] of Object.entries(card)) {
    if (key.endsWith('_zone') && typeof value === 'string' && value) {
      zones.push(value);
    }
  }
  return zones;
}

function refreshZoneHighlights() {
  engine.town.clearHighlights();
  const deck = engine.decks?.getDeck(engine.decks.activeDeckId);
  if (!deck) return;
  const selected = deck.getSelected();
  const cards = Array.isArray(selected) ? selected : (selected ? [selected] : []);
  const zoneIds = new Set(cards.flatMap(getZoneIdsFromCard));
  if (zoneIds.size) engine.town.highlightZones([...zoneIds]);
}

engine.events.on('card:select', () => refreshZoneHighlights());
engine.events.on('card:deselect', () => refreshZoneHighlights());
engine.events.on('deck:switch', () => refreshZoneHighlights());

engine.init().catch(err => console.error('[Editor] Init failed:', err));
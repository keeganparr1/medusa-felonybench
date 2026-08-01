import { validateConfig } from '../engine/config-loader.js';
import { registerMode, setMode } from './editor-modes.js';
import { resetCardState } from './editor-cards.js';
import { hideDeckProps } from './editor-decks.js';
import { hideZoneProps } from './editor-zones.js';
import { hideOverlayProps } from './editor-overlays.js';

const btnDownload = document.getElementById('btn-download');
const btnOpen = document.getElementById('btn-open');
const btnNew = document.getElementById('btn-new');
const btnEditConfig = document.getElementById('btn-edit-config');
const configFileInput = document.getElementById('config-file-input');

// Config properties panel elements
const configPropsPanel = document.getElementById('config-props-panel');
const cfgFlipOnSelect = document.getElementById('cfg-flip-on-select');
const cfgMultiSelect = document.getElementById('cfg-multi-select');
const cfgAlwaysShowHand = document.getElementById('cfg-always-show-hand');
const cfgShowOnStart = document.getElementById('cfg-show-on-start');
const cfgMetadataList = document.getElementById('cfg-metadata-list');
const cfgMetadataNew = document.getElementById('cfg-metadata-new');
const cfgMetadataAdd = document.getElementById('cfg-metadata-add');
const cfgPageSize = document.getElementById('cfg-page-size');
const cfgPointsProperty = document.getElementById('cfg-points-property');
const cfgPointsCombosUrl = document.getElementById('cfg-points-combos-url');
const cfgZoneHighlightColor = document.getElementById('cfg-zone-highlight-color');
const cfgZoneHighlightBorder = document.getElementById('cfg-zone-highlight-border');

let engine;

function resetEditorState() {
  setMode(null);
  resetCardState();
  hideDeckProps();
  hideZoneProps();
  hideOverlayProps();
  hideConfigProps();
}

function buildConfig() {
  const cfg = engine.config;
  return {
    meta: cfg.meta,
    background: cfg.background,
    overlays: engine.town.getAllOverlays().map(o => ({
      id: o.id,
      image: o.image,
      x: o.x,
      y: o.y,
      width: o.width,
      height: o.height,
      z: o.z,
      visible: o.visible !== false
    })),
    zones: engine.town.getAllZones().map(z => ({
      id: z.id,
      label: z.label,
      x: z.x,
      y: z.y,
      width: z.width,
      height: z.height,
      ...(z.description ? { description: z.description } : {}),
      ...(z.overlays && z.overlays.length > 0 ? { overlays: z.overlays } : {}),
      ...(z.cssClass ? { cssClass: z.cssClass } : {}),
      data: z.data
    })),
    animations: cfg.animations,
    ...(cfg.decks ? { decks: engine.decks.getSettings() } : {}),
    ...(engine.config.points && Object.keys(engine.config.points).length > 0 ? { points: engine.config.points } : {}),
    ...(cfg.zoneHighlight ? { zoneHighlight: cfg.zoneHighlight } : {})
  };
}

export function initConfig(eng) {
  engine = eng;

  // --- New Config ---
  btnNew.addEventListener('click', async () => {
    try {
      const response = await fetch('defaultconfig.json');
      if (!response.ok) throw new Error(`Failed to load default config: ${response.status}`);
      const config = await response.json();
      validateConfig(config);
      resetEditorState();
      await engine.reload(config);
      engine.status.setText('New game created from default config');
    } catch (err) {
      engine.status.setText(`Error: ${err.message}`);
      console.error('[Editor] Failed to create new config:', err);
    }
  });

  // --- Open Config ---
  btnOpen.addEventListener('click', () => {
    configFileInput.click();
  });

  configFileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const config = JSON.parse(text);
      validateConfig(config);
      resetEditorState();
      await engine.reload(config);
      engine.status.setText(`Opened: ${file.name}`);
    } catch (err) {
      engine.status.setText(`Error: ${err.message}`);
      console.error('[Editor] Failed to open config:', err);
    }
    configFileInput.value = '';
  });

  // --- Open preset configs ---
  async function openPresetConfig(url, label) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Failed to load config: ${response.status}`);
      const config = await response.json();
      validateConfig(config);
      resetEditorState();
      await engine.reload(config);
      engine.status.setText(`Opened: ${label} config`);
    } catch (err) {
      engine.status.setText(`Error: ${err.message}`);
      console.error(`[Editor] Failed to open ${label} config:`, err);
    }
  }

  const presetConfigs = [
    { id: 'btn-open-threatmodel', url: '../threatmodel/config.json', label: 'Threat Model' },
    { id: 'btn-open-redteam', url: '../redteam/config.json', label: 'Red Team' },
    { id: 'btn-open-defense', url: '../defense/config.json', label: 'Defense' },
    { id: 'btn-open-logging', url: '../logging/config.json', label: 'Logging' },
    { id: 'btn-open-response', url: '../response/config.json', label: 'Response' },
  ];
  for (const { id, url, label } of presetConfigs) {
    document.getElementById(id).addEventListener('click', () => openPresetConfig(url, label));
  }

  // --- Download Config ---
  btnDownload.addEventListener('click', () => {
    const config = buildConfig();
    const json = JSON.stringify(config, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'config.json';
    a.click();
    URL.revokeObjectURL(url);
  });

  // --- Edit Config mode ---
  if (btnEditConfig) {
    registerMode('edit-config', {
      button: btnEditConfig,
      onEnter() { showConfigProps(); },
      onExit() { hideConfigProps(); }
    });

    cfgFlipOnSelect.addEventListener('change', () => {
      engine.decks.updateSettings({ flipOnSelect: cfgFlipOnSelect.checked });
    });

    cfgMultiSelect.addEventListener('change', () => {
      engine.decks.updateSettings({ multiSelect: cfgMultiSelect.checked });
    });

    cfgAlwaysShowHand.addEventListener('change', () => {
      engine.decks.updateSettings({ alwaysShowHand: cfgAlwaysShowHand.checked });
    });

    cfgShowOnStart.addEventListener('change', () => {
      engine.decks.updateSettings({ showOnStart: cfgShowOnStart.checked });
    });

    cfgPageSize.addEventListener('change', () => {
      const val = parseInt(cfgPageSize.value, 10);
      engine.decks.updateSettings({ pageSize: isNaN(val) ? 5 : val });
    });

    cfgMetadataAdd.addEventListener('click', () => addMetadataKey());
    cfgMetadataNew.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') addMetadataKey();
    });

    cfgPointsProperty.addEventListener('change', () => {
      const val = cfgPointsProperty.value.trim();
      if (!engine.config.points) engine.config.points = {};
      if (val) engine.config.points.property = val;
      else delete engine.config.points.property;
    });

    cfgPointsCombosUrl.addEventListener('change', () => {
      const val = cfgPointsCombosUrl.value.trim();
      if (!engine.config.points) engine.config.points = {};
      if (val) engine.config.points.combosUrl = val;
      else delete engine.config.points.combosUrl;
    });

    cfgZoneHighlightColor.addEventListener('change', () => {
      const val = cfgZoneHighlightColor.value.trim();
      if (!engine.config.zoneHighlight) engine.config.zoneHighlight = {};
      if (val) {
        engine.config.zoneHighlight.color = val;
        engine.container.style.setProperty('--zone-highlight-color', val);
      } else {
        delete engine.config.zoneHighlight.color;
        engine.container.style.removeProperty('--zone-highlight-color');
      }
      if (!Object.keys(engine.config.zoneHighlight).length) delete engine.config.zoneHighlight;
    });

    cfgZoneHighlightBorder.addEventListener('change', () => {
      const val = parseInt(cfgZoneHighlightBorder.value, 10);
      if (!engine.config.zoneHighlight) engine.config.zoneHighlight = {};
      if (val > 0) {
        engine.config.zoneHighlight.borderWidth = val;
        engine.container.style.setProperty('--zone-highlight-border-width', `${val}px`);
      } else {
        delete engine.config.zoneHighlight.borderWidth;
        engine.container.style.removeProperty('--zone-highlight-border-width');
      }
      if (!Object.keys(engine.config.zoneHighlight).length) delete engine.config.zoneHighlight;
    });
  }
}

function showConfigProps() {
  const settings = engine.decks.getSettings();
  cfgFlipOnSelect.checked = !!settings.flipOnSelect;
  cfgMultiSelect.checked = !!settings.multiSelect;
  cfgAlwaysShowHand.checked = !!settings.hand?.alwaysShow;
  cfgShowOnStart.checked = !!settings.hand?.showOnStart;
  cfgPageSize.value = settings.pageSize != null ? settings.pageSize : 5;
  renderMetadataKeys();
  const pts = engine.config.points || {};
  cfgPointsProperty.value = pts.property || '';
  cfgPointsCombosUrl.value = pts.combosUrl || '';
  const hl = engine.config.zoneHighlight || {};
  cfgZoneHighlightColor.value = hl.color || '';
  cfgZoneHighlightBorder.value = hl.borderWidth != null ? hl.borderWidth : '';
  configPropsPanel.style.display = 'flex';
}

export function hideConfigProps() {
  configPropsPanel.style.display = 'none';
}

function renderMetadataKeys() {
  cfgMetadataList.innerHTML = '';
  const keys = engine.decks.getMetadataKeys();
  for (const key of keys) {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;justify-content:space-between;align-items:center;gap:4px;margin-bottom:2px';
    const span = document.createElement('span');
    span.textContent = key;
    span.style.cssText = 'font-size:13px';
    const removeBtn = document.createElement('button');
    removeBtn.textContent = '×';
    removeBtn.title = `Remove "${key}"`;
    removeBtn.style.cssText = 'border:none;background:rgba(255,80,80,0.6);color:#fff;border-radius:4px;cursor:pointer;padding:1px 6px;font-size:13px';
    removeBtn.addEventListener('click', () => {
      const updated = engine.decks.getMetadataKeys().filter(k => k !== key);
      engine.decks.updateSettings({ metadata: updated });
      renderMetadataKeys();
    });
    row.appendChild(span);
    row.appendChild(removeBtn);
    cfgMetadataList.appendChild(row);
  }
}

function addMetadataKey() {
  const key = cfgMetadataNew.value.trim();
  if (!key) return;
  const existing = engine.decks.getMetadataKeys();
  if (existing.includes(key)) {
    engine.status.setText(`Metadata key "${key}" already exists`);
    return;
  }
  engine.decks.updateSettings({ metadata: [...existing, key] });
  cfgMetadataNew.value = '';
  renderMetadataKeys();
}



import { registerMode, getActiveMode, setMode } from './editor-modes.js';
import { addResizeHandles, removeResizeHandles, computeResize } from './editor-resize.js';

const btnEditZones = document.getElementById('btn-edit-zones');
const btnAddZone = document.getElementById('btn-add-zone');
const zonePropsPanel = document.getElementById('zone-props-panel');
const zoneIdInput = document.getElementById('zone-id');
const zoneLabelInput = document.getElementById('zone-label');
const zoneDescriptionInput = document.getElementById('zone-description');
const zoneXInput = document.getElementById('zone-x');
const zoneYInput = document.getElementById('zone-y');
const zoneWInput = document.getElementById('zone-w');
const zoneHInput = document.getElementById('zone-h');
const zoneCssClassInput = document.getElementById('zone-css-class');
const zoneOverlaysList = document.getElementById('zone-overlays-list');
const zoneDeleteBtn = document.getElementById('zone-delete-btn');

let dragging = null;
let dragMoved = false;
let resizing = null;
let selectedZoneId = null;
let nextZoneNum = 1;
let engine;

function selectZone(zoneId) {
  // Remove highlight from previous
  if (selectedZoneId) {
    const prevEl = engine.town.getZoneElement(selectedZoneId);
    if (prevEl) {
      removeResizeHandles(prevEl);
      prevEl.classList.remove('medusa-zone--editing');
    }
  }
  selectedZoneId = zoneId;
  const zone = engine.town.getZone(zoneId);
  if (!zone) { hideZoneProps(); return; }
  const el = engine.town.getZoneElement(zoneId);
  if (el) {
    el.classList.add('medusa-zone--editing');
    addResizeHandles(el);
  }
  showZoneProps(zone);
}

function showZoneProps(zone) {
  zoneIdInput.value = zone.id;
  zoneIdInput.style.borderColor = '';
  zoneLabelInput.value = zone.label || '';
  zoneDescriptionInput.value = zone.description || '';
  zoneXInput.value = zone.x;
  zoneYInput.value = zone.y;
  zoneWInput.value = zone.width;
  zoneHInput.value = zone.height;
  zoneCssClassInput.value = zone.cssClass || '';
  renderOverlayCheckboxes(zone);
  zonePropsPanel.style.display = 'flex';
}

export function hideZoneProps() {
  zonePropsPanel.style.display = 'none';
  if (selectedZoneId) {
    const el = engine.town.getZoneElement(selectedZoneId);
    if (el) {
      removeResizeHandles(el);
      el.classList.remove('medusa-zone--editing');
    }
  }
  selectedZoneId = null;
}

function renderOverlayCheckboxes(zone) {
  zoneOverlaysList.innerHTML = '';
  const linked = zone.overlays || [];
  for (const overlay of engine.town.getAllOverlays()) {
    const label = document.createElement('label');
    label.style.cssText = 'display:flex;align-items:center;gap:6px;font-size:12px;margin-bottom:2px';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = linked.includes(overlay.id);
    cb.addEventListener('change', () => {
      if (!selectedZoneId) return;
      const z = engine.town.getZone(selectedZoneId);
      if (!z) return;
      if (cb.checked) {
        if (!z.overlays) z.overlays = [];
        if (!z.overlays.includes(overlay.id)) z.overlays.push(overlay.id);
      } else {
        if (z.overlays) z.overlays = z.overlays.filter(id => id !== overlay.id);
      }
      // Update zone-overlay links in town renderer
      engine.town._zoneOverlays.set(selectedZoneId, z.overlays || []);
    });
    const span = document.createElement('span');
    span.textContent = overlay.id;
    label.appendChild(cb);
    label.appendChild(span);
    zoneOverlaysList.appendChild(label);
  }
}

function refreshPropsFromZone() {
  if (!selectedZoneId) return;
  const zone = engine.town.getZone(selectedZoneId);
  if (!zone) return;
  zoneXInput.value = zone.x;
  zoneYInput.value = zone.y;
}

export function initZones(eng) {
  engine = eng;

  // --- Mode: Edit Zones ---
  registerMode('edit-zones', {
    button: btnEditZones,
    onEnter() {
      for (const zone of engine.town.getAllZones()) {
        const el = engine.town.getZoneElement(zone.id);
        if (el) el.style.cursor = 'grab';
      }
    },
    onExit() {
      dragging = null;
      dragMoved = false;
      resizing = null;
      hideZoneProps();
      for (const zone of engine.town.getAllZones()) {
        const el = engine.town.getZoneElement(zone.id);
        if (el) el.style.cursor = 'pointer';
      }
    }
  });

  // --- Zone Drag + Click Logic ---
  document.addEventListener('pointerdown', (e) => {
    if (getActiveMode() !== 'edit-zones') return;

    // Check for resize handle first
    const handleEl = e.target.closest('.medusa-resize-handle');
    if (handleEl) {
      const zoneEl = handleEl.closest('.medusa-zone');
      if (!zoneEl) return;
      const zoneId = zoneEl.dataset.zoneId;
      const zone = engine.town.getZone(zoneId);
      if (!zone) return;
      e.preventDefault();
      zoneEl.setPointerCapture(e.pointerId);
      resizing = {
        zoneId,
        side: handleEl.dataset.resizeSide,
        startX: e.clientX,
        startY: e.clientY,
        start: { x: zone.x, y: zone.y, w: zone.width, h: zone.height },
        element: zoneEl
      };
      return;
    }

    const zoneEl = e.target.closest('.medusa-zone');
    if (!zoneEl) return;
    const zoneId = zoneEl.dataset.zoneId;
    const zone = engine.town.getZone(zoneId);
    if (!zone) return;

    e.preventDefault();
    zoneEl.setPointerCapture(e.pointerId);

    // Only allow dragging the currently selected zone
    if (zoneId !== selectedZoneId) {
      dragMoved = false;
      dragging = { zoneId, element: zoneEl, selectOnly: true };
      return;
    }

    zoneEl.style.cursor = 'grabbing';

    const scale = engine.town.getScale();
    const rect = engine.town.getTownLayer().getBoundingClientRect();
    const pointerVX = (e.clientX - rect.left) / scale;
    const pointerVY = (e.clientY - rect.top) / scale;

    dragMoved = false;
    dragging = {
      zoneId,
      offsetX: pointerVX - zone.x,
      offsetY: pointerVY - zone.y,
      element: zoneEl
    };
  });

  document.addEventListener('pointermove', (e) => {
    if (getActiveMode() !== 'edit-zones') return;

    if (resizing) {
      e.preventDefault();
      const scale = engine.town.getScale();
      const dx = (e.clientX - resizing.startX) / scale;
      const dy = (e.clientY - resizing.startY) / scale;
      const r = computeResize(resizing.side, dx, dy, resizing.start);
      // Update zone position directly to avoid moving linked overlays
      const zone = engine.town.getZone(resizing.zoneId);
      if (zone) {
        zone.x = r.x; zone.y = r.y;
        const el = engine.town.getZoneElement(resizing.zoneId);
        if (el) { el.style.left = `${r.x * scale}px`; el.style.top = `${r.y * scale}px`; }
      }
      engine.town.setZoneSize(resizing.zoneId, r.w, r.h);
      engine.status.setText(`${resizing.zoneId}: ${r.w}×${r.h} @ (${r.x}, ${r.y})`);
      if (resizing.zoneId === selectedZoneId) {
        zoneXInput.value = r.x; zoneYInput.value = r.y;
        zoneWInput.value = r.w; zoneHInput.value = r.h;
      }
      return;
    }

    if (!dragging) return;
    if (dragging.selectOnly) return;
    e.preventDefault();
    dragMoved = true;
    const scale = engine.town.getScale();
    const rect = engine.town.getTownLayer().getBoundingClientRect();
    const newVX = Math.round((e.clientX - rect.left) / scale - dragging.offsetX);
    const newVY = Math.round((e.clientY - rect.top) / scale - dragging.offsetY);

    engine.town.setZonePosition(dragging.zoneId, newVX, newVY);
    engine.status.setText(`${dragging.zoneId}: x=${newVX}, y=${newVY}`);
    // Update panel if this zone is selected
    if (dragging.zoneId === selectedZoneId) refreshPropsFromZone();
  });

  document.addEventListener('pointerup', () => {
    if (getActiveMode() !== 'edit-zones') return;
    if (resizing) {
      resizing = null;
      return;
    }
    if (!dragging) return;
    dragging.element.style.cursor = 'grab';
    const zoneId = dragging.zoneId;
    const wasDrag = dragMoved;
    const wasSelectOnly = dragging.selectOnly;
    dragging = null;
    dragMoved = false;
    if (wasSelectOnly || !wasDrag) selectZone(zoneId);
  });

  // --- Property inputs ---
  zoneIdInput.addEventListener('change', () => {
    if (!selectedZoneId) return;
    const newId = zoneIdInput.value.trim();
    if (!newId || newId === selectedZoneId) {
      zoneIdInput.value = selectedZoneId;
      zoneIdInput.style.borderColor = '';
      return;
    }
    if (engine.town.getZone(newId)) {
      zoneIdInput.style.borderColor = 'rgba(255,80,80,0.9)';
      engine.status.setText(`Zone ID "${newId}" already exists`);
      return;
    }
    zoneIdInput.style.borderColor = '';
    const zone = engine.town.getZone(selectedZoneId);
    const overlays = zone.overlays ? [...zone.overlays] : [];
    const cssClass = zone.cssClass;
    engine.town.removeZone(selectedZoneId);
    engine.town.addZone({ id: newId, label: zone.label, description: zone.description, x: zone.x, y: zone.y, width: zone.width, height: zone.height, data: zone.data, overlays, cssClass });
    selectedZoneId = newId;
    const el = engine.town.getZoneElement(newId);
    if (el) {
      el.style.cursor = 'grab';
      el.classList.add('medusa-zone--editing');
    }
    engine.status.setText(`Zone ID changed to "${newId}"`);
  });

  zoneLabelInput.addEventListener('change', () => {
    if (!selectedZoneId) return;
    engine.town.setZoneLabel(selectedZoneId, zoneLabelInput.value);
  });

  zoneDescriptionInput.addEventListener('change', () => {
    if (!selectedZoneId) return;
    const zone = engine.town.getZone(selectedZoneId);
    if (zone) zone.description = zoneDescriptionInput.value || undefined;
  });

  zoneXInput.addEventListener('change', () => {
    if (!selectedZoneId) return;
    const zone = engine.town.getZone(selectedZoneId);
    if (zone) engine.town.setZonePosition(selectedZoneId, parseInt(zoneXInput.value) || 0, zone.y);
  });

  zoneYInput.addEventListener('change', () => {
    if (!selectedZoneId) return;
    const zone = engine.town.getZone(selectedZoneId);
    if (zone) engine.town.setZonePosition(selectedZoneId, zone.x, parseInt(zoneYInput.value) || 0);
  });

  zoneWInput.addEventListener('change', () => {
    if (!selectedZoneId) return;
    const zone = engine.town.getZone(selectedZoneId);
    if (zone) engine.town.setZoneSize(selectedZoneId, parseInt(zoneWInput.value) || 100, zone.height);
  });

  zoneHInput.addEventListener('change', () => {
    if (!selectedZoneId) return;
    const zone = engine.town.getZone(selectedZoneId);
    if (zone) engine.town.setZoneSize(selectedZoneId, zone.width, parseInt(zoneHInput.value) || 100);
  });

  zoneCssClassInput.addEventListener('change', () => {
    if (!selectedZoneId) return;
    const zone = engine.town.getZone(selectedZoneId);
    if (!zone) return;
    const el = engine.town.getZoneElement(selectedZoneId);
    if (el && zone.cssClass) el.classList.remove(zone.cssClass);
    zone.cssClass = zoneCssClassInput.value.trim() || undefined;
    if (el && zone.cssClass) el.classList.add(zone.cssClass);
  });

  zoneDeleteBtn.addEventListener('click', () => {
    if (!selectedZoneId) return;
    const id = selectedZoneId;
    engine.town.removeZone(id);
    hideZoneProps();
    engine.status.setText(`Deleted zone: ${id}`);
  });

  // --- Add Zone ---
  btnAddZone.addEventListener('click', () => {
    const id = `zone-${nextZoneNum++}`;
    const vw = engine.config.meta.virtualWidth;
    const vh = engine.config.meta.virtualHeight;
    engine.town.addZone({
      id,
      label: id,
      x: Math.round(vw / 2 - 100),
      y: Math.round(vh / 2 - 50),
      width: 200,
      height: 100
    });
    setMode('edit-zones');
    // Set grab cursor on the new zone
    const el = engine.town.getZoneElement(id);
    if (el) el.style.cursor = 'grab';
    selectZone(id);
    engine.status.setText(`Added zone: ${id}`);
  });
}

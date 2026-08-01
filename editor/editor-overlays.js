import { registerMode, getActiveMode, setMode } from './editor-modes.js';
import { addResizeHandles, removeResizeHandles, computeResize } from './editor-resize.js';

const btnEditOverlays = document.getElementById('btn-edit-overlays');
const btnAddOverlay = document.getElementById('btn-add-overlay');
const overlayPropsPanel = document.getElementById('overlay-props-panel');
const overlayIdInput = document.getElementById('overlay-id');
const overlayImageSelect = document.getElementById('overlay-image');
const overlayXInput = document.getElementById('overlay-x');
const overlayYInput = document.getElementById('overlay-y');
const overlayWInput = document.getElementById('overlay-w');
const overlayHInput = document.getElementById('overlay-h');
const overlayZInput = document.getElementById('overlay-z');
const overlayVisibleInput = document.getElementById('overlay-visible');
const overlayDeleteBtn = document.getElementById('overlay-delete-btn');

const BUILDINGS_JSON_URL = '../assets/overlays/buildings.json';
const IMAGE_PATH_PREFIX = '../assets/overlays/';

let dragging = null;
let dragMoved = false;
let resizing = null;
let selectedOverlayId = null;
let nextOverlayNum = 1;
let handleContainer = null;
let buildingImages = []; // loaded from buildings.json
let engine;

async function loadBuildingImages() {
  try {
    const response = await fetch(BUILDINGS_JSON_URL);
    if (!response.ok) throw new Error(`${response.status}`);
    buildingImages = await response.json();
  } catch (err) {
    console.warn('[Editor] Failed to load buildings.json:', err);
    buildingImages = [];
  }
}

function populateImageSelect(currentImage) {
  overlayImageSelect.innerHTML = '';
  for (const filename of buildingImages) {
    const opt = document.createElement('option');
    opt.value = IMAGE_PATH_PREFIX + filename;
    opt.textContent = filename;
    overlayImageSelect.appendChild(opt);
  }
  if (currentImage) overlayImageSelect.value = currentImage;
}

function createHandleContainer() {
  if (handleContainer) handleContainer.remove();
  handleContainer = document.createElement('div');
  handleContainer.style.cssText = 'position:absolute;pointer-events:none;';
  addResizeHandles(handleContainer, { edges: true, corners: true });
  engine.town.getTownLayer().appendChild(handleContainer);
}

function positionHandleContainer() {
  if (!handleContainer || !selectedOverlayId) return;
  const overlay = engine.town.getAllOverlays().find(o => o.id === selectedOverlayId);
  if (!overlay) return;
  const s = engine.town.getScale();
  handleContainer.style.left = `${(overlay.x ?? 0) * s}px`;
  handleContainer.style.top = `${(overlay.y ?? 0) * s}px`;
  handleContainer.style.width = `${(overlay.width ?? 0) * s}px`;
  handleContainer.style.height = `${(overlay.height ?? 0) * s}px`;
}

function removeHandleContainer() {
  if (handleContainer) { handleContainer.remove(); handleContainer = null; }
}

function getAspectRatio(overlayId) {
  const overlay = engine.town.getAllOverlays().find(o => o.id === overlayId);
  if (!overlay || !overlay.width || !overlay.height) return 1;
  return overlay.width / overlay.height;
}

function selectOverlay(overlayId) {
  if (selectedOverlayId) {
    const prevEl = engine.town.getOverlayElement(selectedOverlayId);
    if (prevEl) prevEl.classList.remove('medusa-overlay--editing');
  }
  selectedOverlayId = overlayId;
  const overlay = engine.town.getAllOverlays().find(o => o.id === overlayId);
  if (!overlay) { hideOverlayProps(); return; }
  const el = engine.town.getOverlayElement(overlayId);
  if (el) el.classList.add('medusa-overlay--editing');
  createHandleContainer();
  positionHandleContainer();
  showOverlayProps(overlay);
}

function showOverlayProps(overlay) {
  overlayIdInput.value = overlay.id;
  overlayIdInput.style.borderColor = '';
  populateImageSelect(overlay.image);
  overlayXInput.value = overlay.x ?? 0;
  overlayYInput.value = overlay.y ?? 0;
  overlayWInput.value = overlay.width ?? 200;
  overlayHInput.value = overlay.height ?? 200;
  overlayZInput.value = overlay.z ?? 1;
  overlayVisibleInput.checked = overlay.visible !== false;
  overlayPropsPanel.style.display = 'flex';
}

export function hideOverlayProps() {
  overlayPropsPanel.style.display = 'none';
  removeHandleContainer();
  if (selectedOverlayId) {
    const el = engine.town.getOverlayElement(selectedOverlayId);
    if (el) el.classList.remove('medusa-overlay--editing');
  }
  selectedOverlayId = null;
}

function refreshPropsFromOverlay() {
  if (!selectedOverlayId) return;
  const overlay = engine.town.getAllOverlays().find(o => o.id === selectedOverlayId);
  if (!overlay) return;
  overlayXInput.value = overlay.x;
  overlayYInput.value = overlay.y;
  overlayWInput.value = overlay.width;
  overlayHInput.value = overlay.height;
  positionHandleContainer();
}

export async function initOverlays(eng) {
  engine = eng;

  await loadBuildingImages();

  engine.events.on('engine:resize', () => positionHandleContainer());

  // --- Mode: Edit Overlays ---
  registerMode('edit-overlays', {
    button: btnEditOverlays,
    onEnter() {
      engine.town.setZonesInteractive(false);
      for (const overlay of engine.town.getAllOverlays()) {
        const el = engine.town.getOverlayElement(overlay.id);
        if (el) {
          el.style.cursor = 'grab';
          el.style.pointerEvents = 'auto';
        }
      }
    },
    onExit() {
      dragging = null;
      dragMoved = false;
      resizing = null;
      hideOverlayProps();
      engine.town.setZonesInteractive(true);
      for (const overlay of engine.town.getAllOverlays()) {
        const el = engine.town.getOverlayElement(overlay.id);
        if (el) {
          el.style.cursor = '';
          el.style.pointerEvents = '';
        }
      }
    }
  });

  // --- Overlay Drag + Click + Resize Logic ---
  document.addEventListener('pointerdown', (e) => {
    if (getActiveMode() !== 'edit-overlays') return;

    // Check for resize handle first
    const handleEl = e.target.closest('.medusa-resize-handle');
    if (handleEl && selectedOverlayId) {
      e.preventDefault();
      e.stopPropagation();
      handleEl.setPointerCapture(e.pointerId);
      const overlay = engine.town.getAllOverlays().find(o => o.id === selectedOverlayId);
      if (!overlay) return;
      const scale = engine.town.getScale();
      const rect = engine.town.getTownLayer().getBoundingClientRect();
      const side = handleEl.dataset.resizeSide;
      resizing = {
        overlayId: selectedOverlayId,
        side,
        aspectRatio: getAspectRatio(selectedOverlayId),
        startPointerVX: (e.clientX - rect.left) / scale,
        startPointerVY: (e.clientY - rect.top) / scale,
        startX: overlay.x ?? 0,
        startY: overlay.y ?? 0,
        startW: overlay.width ?? 200,
        startH: overlay.height ?? 200
      };
      return;
    }

    const overlayEl = e.target.closest('.medusa-overlay');
    if (!overlayEl) return;
    const overlayId = overlayEl.alt; // alt is set to cfg.id
    const overlay = engine.town.getAllOverlays().find(o => o.id === overlayId);
    if (!overlay) return;

    e.preventDefault();
    overlayEl.setPointerCapture(e.pointerId);

    // Only allow dragging the currently selected overlay
    if (overlayId !== selectedOverlayId) {
      dragMoved = false;
      dragging = { overlayId, element: overlayEl, selectOnly: true };
      return;
    }

    overlayEl.style.cursor = 'grabbing';

    const scale = engine.town.getScale();
    const rect = engine.town.getTownLayer().getBoundingClientRect();
    const pointerVX = (e.clientX - rect.left) / scale;
    const pointerVY = (e.clientY - rect.top) / scale;

    dragMoved = false;
    dragging = {
      overlayId,
      offsetX: pointerVX - (overlay.x ?? 0),
      offsetY: pointerVY - (overlay.y ?? 0),
      element: overlayEl
    };
  });

  document.addEventListener('pointermove', (e) => {
    if (getActiveMode() !== 'edit-overlays') return;

    if (resizing) {
      e.preventDefault();
      const scale = engine.town.getScale();
      const rect = engine.town.getTownLayer().getBoundingClientRect();
      const pvx = (e.clientX - rect.left) / scale;
      const pvy = (e.clientY - rect.top) / scale;
      const dx = pvx - resizing.startPointerVX;
      const dy = pvy - resizing.startPointerVY;
      const s = resizing;

      const r = computeResize(s.side, dx, dy,
        { x: s.startX, y: s.startY, w: s.startW, h: s.startH },
        { minSize: 20, aspectRatio: s.aspectRatio }
      );

      engine.town.setOverlayPosition(s.overlayId, r.x, r.y);
      engine.town.setOverlaySize(s.overlayId, r.w, r.h);
      positionHandleContainer();
      engine.status.setText(`${s.overlayId}: ${r.w}×${r.h} @ x=${r.x}, y=${r.y}`);
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

    engine.town.setOverlayPosition(dragging.overlayId, newVX, newVY);
    engine.status.setText(`${dragging.overlayId}: x=${newVX}, y=${newVY}`);
    if (dragging.overlayId === selectedOverlayId) refreshPropsFromOverlay();
  });

  document.addEventListener('pointerup', () => {
    if (getActiveMode() !== 'edit-overlays') return;

    if (resizing) {
      refreshPropsFromOverlay();
      resizing = null;
      return;
    }

    if (!dragging) return;
    dragging.element.style.cursor = 'grab';
    const overlayId = dragging.overlayId;
    const wasDrag = dragMoved;
    const wasSelectOnly = dragging.selectOnly;
    dragging = null;
    dragMoved = false;
    if (wasSelectOnly || !wasDrag) selectOverlay(overlayId);
  });

  // --- Property inputs ---
  overlayIdInput.addEventListener('change', () => {
    if (!selectedOverlayId) return;
    const newId = overlayIdInput.value.trim();
    if (!newId || newId === selectedOverlayId) {
      overlayIdInput.value = selectedOverlayId;
      overlayIdInput.style.borderColor = '';
      return;
    }
    if (engine.town.getAllOverlays().find(o => o.id === newId)) {
      overlayIdInput.style.borderColor = 'rgba(255,80,80,0.9)';
      engine.status.setText(`Overlay ID "${newId}" already exists`);
      return;
    }
    overlayIdInput.style.borderColor = '';
    const overlay = engine.town.getAllOverlays().find(o => o.id === selectedOverlayId);
    const cfg = { ...overlay, id: newId };
    engine.town.removeOverlay(selectedOverlayId);
    engine.town.addOverlay(cfg);
    selectedOverlayId = newId;
    const el = engine.town.getOverlayElement(newId);
    if (el) {
      el.style.cursor = 'grab';
      el.style.pointerEvents = 'auto';
      el.classList.add('medusa-overlay--editing');
    }
    engine.status.setText(`Overlay ID changed to "${newId}"`);
  });

  overlayImageSelect.addEventListener('change', () => {
    if (!selectedOverlayId) return;
    const src = overlayImageSelect.value;
    engine.town.setOverlayImage(selectedOverlayId, src);
    // Auto-set dimensions from natural image size
    const img = new Image();
    img.onload = () => {
      engine.town.setOverlaySize(selectedOverlayId, img.naturalWidth, img.naturalHeight);
      overlayWInput.value = img.naturalWidth;
      overlayHInput.value = img.naturalHeight;
    };
    img.src = src;
  });

  overlayXInput.addEventListener('change', () => {
    if (!selectedOverlayId) return;
    const overlay = engine.town.getAllOverlays().find(o => o.id === selectedOverlayId);
    if (overlay) engine.town.setOverlayPosition(selectedOverlayId, parseInt(overlayXInput.value) || 0, overlay.y);
  });

  overlayYInput.addEventListener('change', () => {
    if (!selectedOverlayId) return;
    const overlay = engine.town.getAllOverlays().find(o => o.id === selectedOverlayId);
    if (overlay) engine.town.setOverlayPosition(selectedOverlayId, overlay.x, parseInt(overlayYInput.value) || 0);
  });

  overlayWInput.addEventListener('change', () => {
    if (!selectedOverlayId) return;
    const overlay = engine.town.getAllOverlays().find(o => o.id === selectedOverlayId);
    if (overlay) engine.town.setOverlaySize(selectedOverlayId, parseInt(overlayWInput.value) || 100, overlay.height);
  });

  overlayHInput.addEventListener('change', () => {
    if (!selectedOverlayId) return;
    const overlay = engine.town.getAllOverlays().find(o => o.id === selectedOverlayId);
    if (overlay) engine.town.setOverlaySize(selectedOverlayId, overlay.width, parseInt(overlayHInput.value) || 100);
  });

  overlayZInput.addEventListener('change', () => {
    if (!selectedOverlayId) return;
    const overlay = engine.town.getAllOverlays().find(o => o.id === selectedOverlayId);
    if (!overlay) return;
    const z = parseInt(overlayZInput.value) || 1;
    overlay.z = z;
    const el = engine.town.getOverlayElement(selectedOverlayId);
    if (el) el.style.zIndex = z;
  });

  overlayVisibleInput.addEventListener('change', () => {
    if (!selectedOverlayId) return;
    const overlay = engine.town.getAllOverlays().find(o => o.id === selectedOverlayId);
    if (!overlay) return;
    overlay.visible = overlayVisibleInput.checked;
    if (overlayVisibleInput.checked) {
      engine.town.showOverlay(selectedOverlayId);
    } else {
      engine.town.hideOverlay(selectedOverlayId);
    }
  });

  overlayDeleteBtn.addEventListener('click', () => {
    if (!selectedOverlayId) return;
    const id = selectedOverlayId;
    engine.town.removeOverlay(id);
    hideOverlayProps();
    engine.status.setText(`Deleted overlay: ${id}`);
  });

  // --- Add Overlay ---
  btnAddOverlay.addEventListener('click', () => {
    const id = `overlay-${nextOverlayNum++}`;
    const vw = engine.config.meta.virtualWidth;
    const vh = engine.config.meta.virtualHeight;
    const imageSrc = buildingImages.length > 0 ? IMAGE_PATH_PREFIX + buildingImages[0] : '';
    // Detect natural size, then add overlay
    const img = new Image();
    img.onload = () => {
      const w = img.naturalWidth || 200;
      const h = img.naturalHeight || 200;
      engine.town.addOverlay({
        id,
        image: imageSrc,
        x: Math.round(vw / 2 - w / 2),
        y: Math.round(vh / 2 - h / 2),
        width: w,
        height: h,
        z: 2,
        visible: true
      });
      setMode('edit-overlays');
      const el = engine.town.getOverlayElement(id);
      if (el) {
        el.style.cursor = 'grab';
        el.style.pointerEvents = 'auto';
      }
      selectOverlay(id);
      engine.status.setText(`Added overlay: ${id}`);
    };
    img.onerror = () => {
      // Fallback if image fails to load
      engine.town.addOverlay({
        id,
        image: imageSrc,
        x: Math.round(vw / 2 - 100),
        y: Math.round(vh / 2 - 100),
        width: 200,
        height: 200,
        z: 2,
        visible: true
      });
      setMode('edit-overlays');
      selectOverlay(id);
      engine.status.setText(`Added overlay: ${id}`);
    };
    img.src = imageSrc;
  });
}

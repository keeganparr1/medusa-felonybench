/**
 * Shared resize handle utilities for the editor.
 * Provides handle DOM creation/removal and resize math.
 */

/**
 * Add resize handles to a parent element.
 * @param {HTMLElement} parent — element to append handles to
 * @param {{ edges?: boolean, corners?: boolean }} options
 */
export function addResizeHandles(parent, { edges = true, corners = false } = {}) {
  const sides = [];
  if (edges) sides.push('top', 'right', 'bottom', 'left');
  if (corners) sides.push('top-left', 'top-right', 'bottom-left', 'bottom-right');
  for (const side of sides) {
    const handle = document.createElement('div');
    handle.classList.add('medusa-resize-handle', `medusa-resize-handle--${side}`);
    handle.dataset.resizeSide = side;
    handle.style.pointerEvents = 'auto';
    parent.appendChild(handle);
  }
}

/**
 * Remove all resize handles from a parent element.
 * @param {HTMLElement} parent
 */
export function removeResizeHandles(parent) {
  for (const handle of parent.querySelectorAll('.medusa-resize-handle')) {
    handle.remove();
  }
}

/**
 * Compute new bounds after a resize drag.
 * @param {string} side — handle side ('top','right','bottom','left','top-left', etc.)
 * @param {number} dx — pointer delta X in virtual coords
 * @param {number} dy — pointer delta Y in virtual coords
 * @param {{ x: number, y: number, w: number, h: number }} start — initial bounds
 * @param {{ minSize?: number, aspectRatio?: number }} options
 * @returns {{ x: number, y: number, w: number, h: number }}
 */
export function computeResize(side, dx, dy, start, { minSize = 10, aspectRatio } = {}) {
  let { x, y, w, h } = start;
  const isCorner = side.includes('-');

  if (isCorner && aspectRatio) {
    const ar = aspectRatio;
    if (side === 'bottom-right') {
      w = Math.max(minSize, start.w + dx);
      h = Math.round(w / ar);
    } else if (side === 'bottom-left') {
      w = Math.max(minSize, start.w - dx);
      h = Math.round(w / ar);
      x = start.x + start.w - w;
    } else if (side === 'top-right') {
      w = Math.max(minSize, start.w + dx);
      h = Math.round(w / ar);
      y = start.y + start.h - h;
    } else if (side === 'top-left') {
      w = Math.max(minSize, start.w - dx);
      h = Math.round(w / ar);
      x = start.x + start.w - w;
      y = start.y + start.h - h;
    }
  } else {
    if (side === 'right') w = Math.max(minSize, start.w + dx);
    if (side === 'left') { x = start.x + dx; w = Math.max(minSize, start.w - dx); }
    if (side === 'bottom') h = Math.max(minSize, start.h + dy);
    if (side === 'top') { y = start.y + dy; h = Math.max(minSize, start.h - dy); }
  }

  return { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) };
}

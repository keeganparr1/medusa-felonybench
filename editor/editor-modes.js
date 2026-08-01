// --- Generic Mode System ---
const modes = {};
let activeMode = null;

export function registerMode(name, { button, onEnter, onExit }) {
  modes[name] = { button, onEnter, onExit };
  button.addEventListener('click', () => setMode(activeMode === name ? null : name));
}

export function setMode(name) {
  if (activeMode) {
    const prev = modes[activeMode];
    prev.button.classList.remove('active');
    prev.onExit();
  }
  activeMode = name;
  if (name) {
    const mode = modes[name];
    mode.button.classList.add('active');
    mode.onEnter();
  }
  document.body.style.cursor = activeMode ? 'default' : '';
}

export function getActiveMode() {
  return activeMode;
}

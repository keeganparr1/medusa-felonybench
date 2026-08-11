const OUTCOMES = [
  {
    marker: '🏆',
    pattern: /you won/i,
    title: 'You won!',
    icon: '../site/assets/Icons/ic_fluent_trophy_24_filled.png'
  },
  {
    marker: '⚖️',
    pattern: /(?:draw|tie)/i,
    title: "It's a draw.",
    icon: '../site/assets/Icons/ic_fluent_scales_24_filled.png'
  },
  {
    marker: '💀',
    pattern: /you (?:lost|lose)/i,
    title: 'You lost.',
    icon: '../site/assets/Icons/ic_fluent_skull_24_filled.png'
  }
];

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function getOutcome(descriptions) {
  const source = descriptions.find(Boolean) || '';
  return OUTCOMES.find(outcome => source.includes(outcome.marker))
    || OUTCOMES.find(outcome => outcome.pattern.test(source))
    || {
      title: 'Score Results',
      icon: '../site/assets/Icons/ic_fluent_games_24_filled.png'
    };
}

function renderDescription(description) {
  return String(description)
    .replace(/^\s*(?:🏆|⚖️|💀)\s*/u, '')
    .replace(/^(?:<b>|<strong>|\*\*)?\s*(?:You won!|It(?:'|’)s a draw\.|You (?:lost|lose)\.)(?:<\/b>|<\/strong>|\*\*)?\s*/i, '')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
}

/**
 * Show the shared post-game score dialog without changing scoring or game flow.
 */
export function showScoreResultDialog(engine, {
  result,
  descriptions,
  target,
  gameNumber,
  gameName,
  nextHref,
  nextLabel = 'Next Game',
  onNext
}) {
  const resultDescriptions = descriptions
    || result.combos.map(combo => combo.description);
  const outcome = getOutcome(resultDescriptions);
  const descriptionHtml = resultDescriptions.length > 0
    ? resultDescriptions.map(description => `<div class="medusa-score-description">${renderDescription(description)}</div>`).join('')
    : '<div class="medusa-score-description">No combos matched</div>';
  const nextAction = onNext
    ? `<button class="medusa-score-action medusa-score-action-primary" type="button" data-score-next><img src="../site/assets/Icons/ic_fluent_play_circle_24_filled.png" alt="">${escapeHtml(nextLabel)}</button>`
    : `<a class="medusa-score-action medusa-score-action-primary" href="${escapeHtml(nextHref)}"><img src="../site/assets/Icons/ic_fluent_play_circle_24_filled.png" alt="">${escapeHtml(nextLabel)}</a>`;

  engine.dialogs.show('score-result', {
    width: 1050,
    height: 1400,
    anchor: 'center',
    modal: false,
    closable: true,
    target,
    content: `
      <div class="medusa-score-progress">Game ${gameNumber} &middot; ${escapeHtml(gameName)}</div>
      <div class="medusa-score-heading">
        <div class="medusa-score-outcome-icon"><img src="${outcome.icon}" alt=""></div>
        <h2 id="medusa-score-title">${outcome.title}</h2>
      </div>
      <section class="medusa-score-explanation">${descriptionHtml}</section>
      <nav class="medusa-score-actions" aria-label="Post-game actions">
        <a class="medusa-score-action" href="../site/"><img src="../site/assets/Icons/ic_fluent_lightbulb_filament_24_filled.png" alt="">Learn more</a>
        <button class="medusa-score-action" type="button" data-score-restart><img src="../site/assets/Icons/ic_fluent_games_24_filled.png" alt="">Try Again</button>
        ${nextAction}
      </nav>
    `,
    background: { image: '../assets/dialog.png' }
  });

  const dialog = engine.dialogs.get('score-result');
  dialog.classList.add('medusa-score-dialog');
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-labelledby', 'medusa-score-title');
  dialog.querySelector('.medusa-dialog-close')?.setAttribute('aria-label', 'Close result');
  dialog.querySelector('[data-score-restart]')?.addEventListener('click', () => location.reload());
  dialog.querySelector('[data-score-next]')?.addEventListener('click', onNext);
}

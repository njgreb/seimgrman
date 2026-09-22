import type Phaser from 'phaser';

// The strategy guide, offered when a run goes badly. Phaser draws to a canvas and canvas text isn't
// clickable, so this is a real DOM bar laid over the bottom of the screen area — the one place the loss
// screens leave empty. Paths are relative, like the rest of the build, so it works from any host.

const HTML_URL = 'guide/strategy-guide.html';
const PDF_URL = 'guide/strategy-guide.pdf';

let bar: HTMLElement | null = null;

function mount(): HTMLElement {
  if (bar) return bar;
  const el = document.createElement('div');
  el.id = 'guide-link';
  // .page-ui keeps the on-screen controller's hands off it, so taps still become clicks (src/touch.ts)
  el.className = 'page-ui';
  el.innerHTML = `
    <span class="guide-label">STUCK?</span>
    <a class="guide-btn" href="${HTML_URL}" target="_blank" rel="noopener">STRATEGY GUIDE</a>
    <a class="guide-btn guide-pdf" href="${PDF_URL}" target="_blank" rel="noopener">PDF</a>
  `;
  document.getElementById('screen')!.appendChild(el);
  bar = el;
  return el;
}

export function showGuideLink(): void {
  mount().classList.add('is-open');
}

export function hideGuideLink(): void {
  bar?.classList.remove('is-open');
}

// Show it for as long as this scene is up, and never leave it behind on the next one.
export function offerGuide(scene: Phaser.Scene): void {
  showGuideLink();
  scene.events.once('shutdown', hideGuideLink);
  scene.events.once('destroy', hideGuideLink);
}

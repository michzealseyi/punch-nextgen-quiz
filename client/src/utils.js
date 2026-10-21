export const fmt = (n) => Number(n || 0).toLocaleString('en-NG');
export const KEYS = ['A', 'B', 'C', 'D'];
export const DESKS = ['News', 'Sports', 'Business', 'HealthWise', 'Metro Plus', 'Featured'];
export const article = (word) => (/^[aeiou]/i.test(word) ? 'an' : 'a');
export const deskId = (desk) => 'desk-' + desk.toLowerCase().replace(/[^a-z0-9]+/g, '-');
export const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// CSS confetti in the logo stripe colours. Lives outside React because it's fire-and-forget.
export function confetti(count = 70) {
  if (reducedMotion()) return;
  const colors = ['#FF0000', '#FA450D', '#FCC90F', '#E0FF19', '#8DC63F'];
  const layer = document.createElement('div');
  layer.className = 'confetti';
  layer.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < count; i++) {
    const p = document.createElement('span');
    p.style.cssText = `left:${Math.random() * 100}vw;background:${colors[i % colors.length]};--r:${Math.random() * 360}deg;`
      + `animation-delay:${Math.random() * 0.6}s;animation-duration:${2.2 + Math.random() * 1.6}s`;
    layer.appendChild(p);
  }
  document.body.appendChild(layer);
  setTimeout(() => layer.remove(), 4600);
}

// Time left until the daily challenge rotates at midnight West Africa Time (UTC+1)
export function msToWatMidnight() {
  const HOUR = 3600e3, DAY = 86400e3, now = Date.now();
  return Math.ceil((now + HOUR) / DAY) * DAY - HOUR - now;
}

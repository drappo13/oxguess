// Hand-drawn-style SVG art: the ox, rosettes, the herd. All colours come from CSS tokens.

export function oxHead({ size = 64, mood = "happy", title = "OxGuess ox" } = {}) {
  const mouth = mood === "wow"
    ? `<ellipse cx="60" cy="98" rx="5" ry="4" fill="var(--ink)"/>`
    : mood === "meh"
    ? `<path d="M53 98 h14" stroke="var(--ink)" stroke-width="3" stroke-linecap="round" fill="none"/>`
    : `<path d="M51 95 q9 8 18 0" stroke="var(--ink)" stroke-width="3" stroke-linecap="round" fill="none"/>`;
  return `<svg class="ox" width="${size}" height="${size}" viewBox="0 0 120 120" role="img" aria-label="${title}">
  <g stroke="var(--ink)" stroke-width="3.2" stroke-linejoin="round" stroke-linecap="round">
    <path d="M30 40 C14 38 8 26 12 14 C18 24 26 28 38 30 Z" fill="var(--horn)"/>
    <path d="M90 40 C106 38 112 26 108 14 C102 24 94 28 82 30 Z" fill="var(--horn)"/>
    <ellipse cx="20" cy="52" rx="14" ry="8" transform="rotate(-18 20 52)" fill="var(--ox-dark)"/>
    <ellipse cx="100" cy="52" rx="14" ry="8" transform="rotate(18 100 52)" fill="var(--ox-dark)"/>
    <path d="M32 34 C40 24 80 24 88 34 C96 46 94 70 88 82 L32 82 C26 70 24 46 32 34 Z" fill="var(--ox)"/>
    <path d="M50 30 C54 22 66 22 70 30 C66 34 54 34 50 30 Z" fill="var(--ox-dark)"/>
    <path d="M60 36 C52 44 52 60 56 70 L64 70 C68 60 68 44 60 36 Z" fill="var(--ox-blaze)" stroke="none"/>
    <path d="M28 82 C28 72 40 68 60 68 C80 68 92 72 92 82 C92 98 80 108 60 108 C40 108 28 98 28 82 Z" fill="var(--muzzle)"/>
  </g>
  <ellipse cx="47" cy="84" rx="4.5" ry="3.2" fill="var(--ink)"/>
  <ellipse cx="73" cy="84" rx="4.5" ry="3.2" fill="var(--ink)"/>
  ${mouth}
  <circle cx="44" cy="54" r="5.5" fill="var(--ink)"/><circle cx="76" cy="54" r="5.5" fill="var(--ink)"/>
  <circle cx="45.8" cy="52.2" r="1.8" fill="#fff"/><circle cx="77.8" cy="52.2" r="1.8" fill="#fff"/>
  <ellipse cx="36" cy="66" rx="5" ry="3" fill="var(--cheek)" opacity=".55"/>
  <ellipse cx="84" cy="66" rx="5" ry="3" fill="var(--cheek)" opacity=".55"/>
</svg>`;
}

// A prize rosette: frilled circle, ribbon tails, label in the middle.
export function rosette(tier, label, size = 56) {
  const petals = Array.from({ length: 16 }, (_, i) => {
    const a = (i / 16) * Math.PI * 2;
    return `<circle cx="${(32 + Math.cos(a) * 21).toFixed(1)}" cy="${(30 + Math.sin(a) * 21).toFixed(1)}" r="7"/>`;
  }).join("");
  return `<svg class="rosette" width="${size}" height="${Math.round(size * 1.25)}" viewBox="0 0 64 80" aria-hidden="true">
    <g fill="var(--r-${tier}-dark)"><path d="M20 42 L12 78 L22 71 L28 78 L32 46 Z"/><path d="M44 42 L52 78 L42 71 L36 78 L32 46 Z"/></g>
    <g fill="var(--r-${tier})">${petals}</g>
    <circle cx="32" cy="30" r="19" fill="var(--r-${tier}-dark)"/>
    <circle cx="32" cy="30" r="15" fill="var(--card)"/>
    <text x="32" y="35" text-anchor="middle" font-family="Fredoka, Nunito, sans-serif" font-weight="700" font-size="${String(label).length > 2 ? 12 : 15}" fill="var(--ink)">${label}</text>
  </svg>`;
}

// Little herd silhouettes for the story screen: a row of oxen and people around the prize ox.
export function fairScene() {
  // The crowd stands either side of the ox's pen, leaving the middle clear.
  const xs = [];
  for (let x = 16; x < 344; x += 14) if (x < 118 || x > 246) xs.push(x);
  const people = xs.map((x0, i) => {
    const x = x0 + (i % 3) * 2, y = 156 + (i % 2) * 10, h = 18 + (i * 7) % 8;
    const hue = ["var(--c-when)", "var(--c-big)", "var(--c-far)", "var(--c-many)", "var(--c-wild)"][i % 5];
    return `<g><circle cx="${x}" cy="${y - h - 5}" r="5" fill="var(--muted)"/><rect x="${x - 5}" y="${y - h}" width="10" height="${h}" rx="5" fill="${hue}" opacity=".8"/></g>`;
  }).join("");
  return `<svg class="scene" viewBox="0 0 360 180" role="img" aria-label="A crowd at a country fair around a prize ox">
    <rect x="0" y="120" width="360" height="60" rx="12" fill="var(--grass-soft)"/>
    <path d="M40 40 L60 18 L80 40 M120 40 L140 18 L160 40 M200 40 L220 18 L240 40 M280 40 L300 18 L320 40" stroke="var(--line)" stroke-width="2" fill="none"/>
    <path d="M20 40 Q100 56 180 40 Q260 56 340 40" stroke="var(--muted)" stroke-width="1.5" fill="none"/>
    ${[40, 70, 100, 130, 160, 200, 230, 260, 290, 320].map((x, i) => `<path d="M${x} ${44 + (i % 2) * 4} l6 10 l6 -10 z" fill="${["var(--c-when)", "var(--c-big)", "var(--c-far)", "var(--c-many)"][i % 4]}"/>`).join("")}
    <g transform="translate(130 46) scale(.85)">${oxBody()}</g>
    ${people}
  </svg>`;
}

function oxBody() {
  return `<g stroke="var(--ink)" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">
    <rect x="20" y="40" width="80" height="44" rx="22" fill="var(--ox)"/>
    <rect x="28" y="76" width="10" height="26" rx="4" fill="var(--ox-dark)"/><rect x="48" y="78" width="10" height="24" rx="4" fill="var(--ox-dark)"/>
    <rect x="70" y="78" width="10" height="24" rx="4" fill="var(--ox-dark)"/><rect x="86" y="76" width="10" height="26" rx="4" fill="var(--ox-dark)"/>
    <path d="M20 54 C10 56 6 64 8 72" fill="none"/>
    <path d="M86 30 C80 20 112 20 108 30 C116 40 114 58 104 64 L88 64 C80 56 80 40 86 30 Z" fill="var(--ox)"/>
    <path d="M86 30 C78 26 76 18 78 12 M108 30 C116 26 118 18 116 12" fill="none" stroke="var(--horn-line)"/>
    <ellipse cx="96" cy="58" rx="12" ry="8" fill="var(--muzzle)"/>
  </g>
  <circle cx="91" cy="40" r="3" fill="var(--ink)"/><circle cx="103" cy="40" r="3" fill="var(--ink)"/>`;
}

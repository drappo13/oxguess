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

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

// The story scene: a country fair in 1906. Marquees and hills behind, bunting across the top, the prize
// ox in a wooden pen with a rosette, a chalk sign, and a crowd in caps, bowlers and bonnets watching.
export function fairScene() {
  const W = 360, H = 210;
  // Bunting: one strand sagging between two poles, flags hung along the curve.
  const bez = (t, a, c, b) => (1 - t) * (1 - t) * a + 2 * (1 - t) * t * c + t * t * b;
  const flagCols = ["var(--c-big)", "var(--c-when)", "var(--c-far)", "var(--card)", "var(--c-many)"];
  const flags = Array.from({ length: 19 }, (_, k) => {
    const t = (k + 1) / 20, x = bez(t, 12, 180, 348), y = bez(t, 26, 70, 26);
    return `<path d="M${(x - 5).toFixed(1)} ${y.toFixed(1)} L${(x + 5).toFixed(1)} ${y.toFixed(1)} L${x.toFixed(1)} ${(y + 11).toFixed(1)} Z" fill="${flagCols[k % 5]}" stroke="var(--ink)" stroke-width=".8" stroke-linejoin="round"/>`;
  }).join("");

  const tent = (x, w, h, base) => {
    const id = `st${x}`;
    return `<g stroke="var(--ink)" stroke-width="1.6" stroke-linejoin="round">
      <defs><pattern id="${id}" width="10" height="10" patternUnits="userSpaceOnUse"><rect width="10" height="10" fill="var(--tent-a)"/><rect width="5" height="10" fill="var(--tent-b)"/></pattern></defs>
      <rect x="${x}" y="${base - h * 0.45}" width="${w}" height="${h * 0.45}" fill="url(#${id})"/>
      <path d="M${x - 6} ${base - h * 0.45} L${x + w / 2} ${base - h} L${x + w + 6} ${base - h * 0.45} Z" fill="url(#${id})"/>
      <path d="M${x + w / 2} ${base - h} v-8" fill="none"/><path d="M${x + w / 2} ${base - h - 8} l7 3 l-7 3" fill="var(--c-big)"/>
      <path d="M${x + w / 2 - 7} ${base} L${x + w / 2} ${base - h * 0.32} L${x + w / 2 + 7} ${base} Z" fill="var(--tent-door)"/>
    </g>`;
  };

  const skins = ["#f1cfb0", "#e2ac86", "#c58a62", "#8e5b3d"];
  const coats = ["var(--coat-1)", "var(--coat-2)", "var(--coat-3)", "var(--coat-4)", "var(--coat-5)"];
  // A person seen from behind or three-quarters: shoulders, head, and a hat of the day.
  const person = (x, y, sc, k, hat) => {
    const coat = coats[k % coats.length], skin = skins[(k * 3) % skins.length];
    const hats = {
      cap: `<path d="M-6.5 -25 C-6 -32 6 -32 6.5 -25 Z" fill="var(--hat)"/><path d="M2 -25.5 h7" stroke="var(--hat)" stroke-width="2.4" stroke-linecap="round"/>`,
      bowler: `<path d="M-5.5 -26 C-5.5 -35 5.5 -35 5.5 -26 Z" fill="var(--hat)"/><path d="M-8.5 -25.5 h17" stroke="var(--hat)" stroke-width="2.4" stroke-linecap="round"/>`,
      bonnet: `<path d="M-7.5 -21 C-9 -36 9 -36 7.5 -21 C5 -27 -5 -27 -7.5 -21 Z" fill="var(--bonnet)"/><path d="M-6 -27 h12" stroke="var(--c-big)" stroke-width="1.6"/>`,
      straw: `<path d="M-5 -26 C-5 -32 5 -32 5 -26 Z" fill="var(--straw)"/><path d="M-10 -25.5 h20" stroke="var(--straw)" stroke-width="2.6" stroke-linecap="round"/><path d="M-5 -27 h10" stroke="var(--c-far)" stroke-width="1.4"/>`,
      none: "",
    };
    return `<g transform="translate(${x} ${y}) scale(${sc})" stroke="var(--ink)" stroke-width="1.3" stroke-linejoin="round">
      <path d="M-11 6 C-11 -6 -8 -12 0 -12 C8 -12 11 -6 11 6 Z" fill="${coat}"/>
      <circle cx="0" cy="-20" r="6.5" fill="${skin}"/>
      <g stroke="none">${hats[hat]}</g>
    </g>`;
  };
  const hatCycle = ["cap", "bowler", "bonnet", "cap", "straw", "bowler", "none", "bonnet"];
  const crowd = (xs, y, sc, offset) => xs.map((x, k) => person(x, y + ((k * 5) % 3) * 2, sc, k + offset, hatCycle[(k + offset) % hatCycle.length])).join("");

  // Pen fence around the ox.
  const posts = [118, 150, 182, 214, 246, 268].map((x) => `<rect x="${x}" y="142" width="6" height="34" rx="1.5" fill="var(--wood)"/>`).join("");

  return `<svg class="scene" viewBox="0 0 ${W} ${H}" role="img" aria-label="A crowd at a 1906 country fair watching a prize ox in its pen">
    <defs><clipPath id="sceneclip"><rect width="${W}" height="${H}" rx="18"/></clipPath></defs>
    <g clip-path="url(#sceneclip)">
      <rect width="${W}" height="${H}" fill="var(--sky)"/>
      <circle cx="300" cy="38" r="16" fill="var(--sun)" opacity=".9"/>
      <path d="M0 132 C50 104 110 112 160 122 C210 104 280 100 360 118 V210 H0 Z" fill="var(--hill-far)"/>
      <path d="M0 146 C80 128 150 136 220 140 C270 130 320 128 360 136 V210 H0 Z" fill="var(--hill-near)"/>
      ${tent(26, 62, 64, 142)}${tent(286, 50, 52, 140)}
      <path d="M0 150 C90 144 270 144 360 150 V210 H0 Z" fill="var(--grass-soft)"/>
      <g stroke="var(--ink)" stroke-width="1.6" stroke-linecap="round">
        <path d="M12 22 V150" stroke="var(--wood)" stroke-width="3.5"/><path d="M348 22 V150" stroke="var(--wood)" stroke-width="3.5"/>
        <path d="M12 26 Q180 114 348 26" fill="none" stroke-width="1.2"/>
      </g>
      ${flags}
      ${crowd([64, 84, 102, 292, 310, 328], 156, 0.72, 3)}
      <ellipse cx="190" cy="174" rx="54" ry="5" fill="var(--ink)" opacity=".15"/>
      ${oxSide()}
      <g stroke="var(--ink)" stroke-width="1.4" stroke-linejoin="round">${posts}
        <rect x="114" y="148" width="162" height="5" rx="2" fill="var(--wood)"/>
        <rect x="114" y="162" width="162" height="5" rx="2" fill="var(--wood)"/>
      </g>
      <g stroke="var(--ink)" stroke-width="1.4" stroke-linejoin="round">
        <rect x="283" y="150" width="4" height="30" fill="var(--wood)"/>
        <rect x="262" y="128" width="46" height="28" rx="3" fill="var(--board)"/>
      </g>
      <text x="285" y="139" text-anchor="middle" font-family="Fredoka, Nunito, sans-serif" font-weight="600" font-size="6.6" fill="var(--chalk)">GUESS THE</text>
      <text x="285" y="147" text-anchor="middle" font-family="Fredoka, Nunito, sans-serif" font-weight="600" font-size="6.6" fill="var(--chalk)">WEIGHT</text>
      <text x="285" y="154" text-anchor="middle" font-family="Nunito, sans-serif" font-weight="700" font-size="5" fill="var(--chalk)">6d a go</text>
      ${crowd([10, 34, 58, 82, 104, 128, 152, 176, 200, 224, 248, 272, 296, 320, 344], 204, 1.15, 0)}
    </g>
    <rect width="${W}" height="${H}" rx="18" fill="none" stroke="var(--line)" stroke-width="2"/>
  </svg>`;
}

// The prize ox side-on, facing right, wearing a first-prize rosette.
function oxSide() {
  return `<g stroke="var(--ink)" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round">
    <path d="M147 112 C138 118 136 132 140 150" fill="none"/>
    <path d="M136 148 C134 154 140 158 143 152 C145 148 140 144 136 148 Z" fill="var(--ox-dark)"/>
    <rect x="153" y="136" width="10" height="36" rx="4" fill="var(--ox-dark)"/>
    <rect x="203" y="136" width="10" height="36" rx="4" fill="var(--ox-dark)"/>
    <path d="M146 116 C144 100 160 92 180 94 C198 88 216 92 226 104 C232 118 230 134 222 142 C202 148 170 148 154 144 C146 140 146 128 146 116 Z" fill="var(--ox)"/>
    <path d="M160 102 C168 98 180 100 184 108 C178 114 166 114 160 102 Z" fill="var(--ox-dark)" opacity=".55" stroke="none"/>
    <path d="M190 126 C198 122 208 126 206 134 C198 138 190 134 190 126 Z" fill="var(--ox-dark)" opacity=".45" stroke="none"/>
    <rect x="164" y="138" width="10" height="35" rx="4" fill="var(--ox)"/>
    <rect x="212" y="137" width="10" height="36" rx="4" fill="var(--ox)"/>
    <path d="M154 171 h10 M164 172 h10 M203 171 h10 M212 172 h10" stroke="var(--ink)" stroke-width="3.2"/>
    <path d="M222 108 C228 124 226 136 218 140 C216 130 216 118 222 108 Z" fill="var(--ox-dark)"/>
    <path d="M220 98 C226 86 244 86 252 98 C260 110 260 124 254 130 C246 136 234 134 228 126 C222 118 218 108 220 98 Z" fill="var(--ox)"/>
    <path d="M232 92 C236 84 244 80 252 80 C248 84 244 88 240 94" fill="var(--horn)"/>
    <ellipse cx="226" cy="98" rx="8" ry="4" transform="rotate(-25 226 98)" fill="var(--ox-dark)"/>
    <ellipse cx="250" cy="124" rx="10" ry="8.5" fill="var(--muzzle)"/>
  </g>
  <circle cx="240" cy="106" r="2.6" fill="var(--ink)"/><circle cx="241" cy="105" r=".9" fill="#fff"/>
  <ellipse cx="255" cy="122" rx="1.6" ry="1.2" fill="var(--ink)"/>
  <path d="M246 130 q4 2 8 0" stroke="var(--ink)" stroke-width="1.3" fill="none" stroke-linecap="round"/>
  <g transform="translate(212 114)">
    <path d="M-3 4 L-6 18 L-2 15 L0 19 Z M3 4 L6 18 L2 15 L0 19 Z" fill="var(--r-first-dark)" stroke="var(--ink)" stroke-width="1"/>
    ${Array.from({ length: 12 }, (_, i) => { const a = (i / 12) * Math.PI * 2; return `<circle cx="${(Math.cos(a) * 5.5).toFixed(1)}" cy="${(Math.sin(a) * 5.5).toFixed(1)}" r="2.6" fill="var(--r-first)"/>`; }).join("")}
    <circle r="4" fill="var(--r-first-dark)"/><circle r="2.2" fill="var(--card)"/>
  </g>`;
}

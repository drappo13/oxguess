// Hand-drawn-style SVG art: the ox, rosettes, the herd. All colours come from CSS tokens.
import { toPos, binValue, STEPS, TIERS } from "./game.js";

export function oxHead({ size = 64, mood = "happy", title = "OxGuess ox" } = {}) {
  const mouth = mood === "wow"
    ? `<ellipse cx="60" cy="98" rx="5" ry="4" fill="var(--art-ink)"/>`
    : mood === "meh"
    ? `<path d="M53 98 h14" stroke="var(--art-ink)" stroke-width="3" stroke-linecap="round" fill="none"/>`
    : `<path d="M51 95 q9 8 18 0" stroke="var(--art-ink)" stroke-width="3" stroke-linecap="round" fill="none"/>`;
  return `<svg class="ox" width="${size}" height="${size}" viewBox="0 0 120 120" role="img" aria-label="${title}">
  <g stroke="var(--art-ink)" stroke-width="3.2" stroke-linejoin="round" stroke-linecap="round">
    <path d="M30 40 C14 38 8 26 12 14 C18 24 26 28 38 30 Z" fill="var(--horn)"/>
    <path d="M90 40 C106 38 112 26 108 14 C102 24 94 28 82 30 Z" fill="var(--horn)"/>
    <ellipse cx="20" cy="52" rx="14" ry="8" transform="rotate(-18 20 52)" fill="var(--ox-dark)"/>
    <ellipse cx="100" cy="52" rx="14" ry="8" transform="rotate(18 100 52)" fill="var(--ox-dark)"/>
    <path d="M32 34 C40 24 80 24 88 34 C96 46 94 70 88 82 L32 82 C26 70 24 46 32 34 Z" fill="var(--ox)"/>
    <path d="M50 30 C54 22 66 22 70 30 C66 34 54 34 50 30 Z" fill="var(--ox-dark)"/>
    <path d="M60 36 C52 44 52 60 56 70 L64 70 C68 60 68 44 60 36 Z" fill="var(--ox-blaze)" stroke="none"/>
    <path d="M28 82 C28 72 40 68 60 68 C80 68 92 72 92 82 C92 98 80 108 60 108 C40 108 28 98 28 82 Z" fill="var(--muzzle)"/>
  </g>
  <ellipse cx="47" cy="84" rx="4.5" ry="3.2" fill="var(--art-ink)"/>
  <ellipse cx="73" cy="84" rx="4.5" ry="3.2" fill="var(--art-ink)"/>
  ${mouth}
  <circle cx="44" cy="54" r="5.5" fill="var(--art-ink)"/><circle cx="76" cy="54" r="5.5" fill="var(--art-ink)"/>
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

// "You": a 1906 fairgoer in a flat cap and a fine moustache, drawn to match the ox.
export function fairgoer({ size = 24, title = "You" } = {}) {
  return `<svg class="fairgoer" width="${size}" height="${size}" viewBox="0 0 120 120" role="img" aria-label="${title}">
  <g stroke="var(--art-ink)" stroke-width="4" stroke-linejoin="round" stroke-linecap="round">
    <ellipse cx="27" cy="70" rx="8" ry="11" fill="var(--skin)"/>
    <ellipse cx="93" cy="70" rx="8" ry="11" fill="var(--skin)"/>
    <path d="M29 56 C29 36 91 36 91 56 L91 72 C91 96 77 110 60 110 C43 110 29 96 29 72 Z" fill="var(--skin)"/>
    <path d="M22 52 C20 18 100 18 98 52 C80 45 40 45 22 52 Z" fill="var(--cap)"/>
    <path d="M26 52 C42 44 78 44 94 52 C90 62 30 62 26 52 Z" fill="var(--cap-dark)"/>
    <path d="M42 86 C48 79 57 80 60 85 C63 80 72 79 78 86 C71 92 63 90 60 88 C57 90 49 92 42 86 Z" fill="var(--tash)"/>
  </g>
  <circle cx="60" cy="24" r="3.5" fill="var(--art-ink)"/>
  <circle cx="47" cy="70" r="5" fill="var(--art-ink)"/><circle cx="73" cy="70" r="5" fill="var(--art-ink)"/>
  <circle cx="48.6" cy="68.4" r="1.6" fill="#fff"/><circle cx="74.6" cy="68.4" r="1.6" fill="#fff"/>
  <ellipse cx="38" cy="82" rx="5" ry="3" fill="var(--cheek)" opacity=".55"/><ellipse cx="82" cy="82" rx="5" ry="3" fill="var(--cheek)" opacity=".55"/>
  <path d="M53 98 q7 4 14 0" stroke="var(--art-ink)" stroke-width="3" fill="none" stroke-linecap="round"/>
</svg>`;
}

// A fairground balance: the ox on one pan, a stack of mystery weights on the other. The beam teeters, then settles.
export function balance() {
  const ox = oxHead({ size: 120 }).replace(/^<svg[^>]*>|<\/svg>$/g, "");
  const pan = (x) => `<path d="M${x - 26} 92 Q${x} 104 ${x + 26} 92 Z" fill="var(--wood)" stroke="var(--art-ink)" stroke-width="2.2" stroke-linejoin="round"/>
    <path d="M${x} 40 L${x - 22} 92 M${x} 40 L${x + 22} 92" stroke="var(--art-ink)" stroke-width="1.6" fill="none"/>`;
  const weight = (y, w, label) => `<path d="M${155 - w / 2} ${y} h${w} l-3 -14 h${-w + 6} z" fill="#5b5f63" stroke="var(--art-ink)" stroke-width="2" stroke-linejoin="round"/>
    <text x="155" y="${y - 3.5}" text-anchor="middle" font-family="Fredoka, Nunito, sans-serif" font-weight="700" font-size="9" fill="#fff">${label}</text>`;
  return `<svg class="balance" viewBox="0 0 210 140" role="img" aria-label="The ox on a balance scale against a stack of unknown weights">
    <path d="M86 136 L124 136 L114 124 L96 124 Z" fill="var(--wood)" stroke="var(--art-ink)" stroke-width="2.2" stroke-linejoin="round"/>
    <rect x="102" y="40" width="6" height="86" rx="2" fill="var(--wood)" stroke="var(--art-ink)" stroke-width="2"/>
    <g class="beam"><rect x="40" y="36" width="130" height="7" rx="3.5" fill="var(--c-when)" stroke="var(--art-ink)" stroke-width="2"/></g>
    <circle cx="105" cy="39.5" r="5" fill="var(--c-big)" stroke="var(--art-ink)" stroke-width="2"/>
    <g class="pan-l">${pan(55)}<svg x="31" y="44" width="48" height="48" viewBox="0 0 120 120">${ox}</svg></g>
    <g class="pan-r">${pan(155)}${weight(91, 40, "?")}${weight(77, 32, "?")}${weight(63, 24, "?")}</g>
  </svg>`;
}

// ---------- drawing the art inside other charts ----------
/** One of the 120x120 drawings above, placed inside another SVG and centred on (cx, cy). */
export const placed = (svg, cx, cy, size) => `<svg x="${(cx - size / 2).toFixed(1)}" y="${(cy - size / 2).toFixed(1)}" width="${size}" height="${size}" viewBox="0 0 120 120" overflow="visible">${svg.replace(/^<svg[^>]*>|<\/svg>$/g, "")}</svg>`;

/** One day's scores as a prize board: a row per rosette tier, best at the top, a token per finished round (higher
 *  scores to the left), with the herd's ox and your fairgoer in their places. A round's tier is the question tier
 *  at five times the points (85+ is first prize, as 17+ is for a question). */
export function prizeBoard(scores, herdScore, you = null) {
  const per = 5, rows = TIERS.map((t, i) => ({ t, lo: t.min * per, hi: i ? TIERS[i - 1].min * per - 1 : 100 }));
  const tierOf = (v) => rows.find((r) => v >= r.lo);
  const people = [
    ...scores.map((v) => ({ v, k: "player" })),
    { v: herdScore, k: "herd" },
    ...(you == null ? [] : [{ v: you, k: "you" }]),
  ].sort((a, b) => b.v - a.v || (a.k === "player") - (b.k === "player"));
  const token = (p) => p.k === "herd" ? `<span class="pb-face herd" title="The herd: ${p.v}">${oxHead({ size: 26, title: `The herd, ${p.v}` })}</span>`
    : p.k === "you" ? `<span class="pb-face you" title="You: ${p.v}">${fairgoer({ size: 26, title: `You, ${p.v}` })}</span>`
    : `<span class="pb-dot" title="${p.v}"></span>`;
  return `<ol class="prize-board" aria-label="Every round yesterday, by prize">${rows.map((r) => {
    const here = people.filter((p) => tierOf(p.v) === r), n = here.filter((p) => p.k === "player").length;
    return `<li class="${n ? "" : "empty"}" style="--tier: var(--r-${r.t.key}); --tier-dark: var(--r-${r.t.key}-dark)">
      ${rosette(r.t.key, "", 30)}
      <span class="pb-name">${r.t.name}<small>${r.lo === r.hi ? r.lo : `${r.lo}–${r.hi}`} · ${n} ${n === 1 ? "player" : "players"}</small></span>
      <span class="pb-tokens">${here.map(token).join("")}</span>
    </li>`;
  }).join("")}</ol>`;
}

/** How the herd guessed: 25 bars across the slider, the herd's guess (the ox), your guess and the answer flag.
 *  The game shows all three; the stats page leaves out "you", and hides the answer for today. */
/** The herd drawn across range r (the player's own slider; the herd's own range by default). Guesses beyond r
 *  are counted at that end with an arrow, and a herd middle beyond r sits at the end with an arrow too. */
export function herdChart(q, h, { guess = null, showAnswer = true, range = h.range } = {}) {
  const r = range, B = 25, bins = new Array(B).fill(0), beyond = [0, 0];
  const same = r.min === h.range.min && r.max === h.range.max;
  h.bins.forEach((c, k) => {
    if (!c) return;
    if (same) { bins[Math.floor((k * B) / h.bins.length)] += c; return; }
    const v = binValue(q, h.range, k);
    if (v < r.min) beyond[0] += c; else if (v > r.max) beyond[1] += c;
    else bins[Math.min(B - 1, Math.floor((toPos(q, r, v) / STEPS) * B))] += c;
  });
  const mx = Math.max(1, ...bins), W = 320, H = 110, bw = W / B, base = H - 8;
  const x = (v) => (toPos(q, r, v) / STEPS) * W;
  const more = (side) => {
    const n = beyond[side];
    if (!n) return "";
    const ex = side ? W + 6 : -6, dir = side ? 1 : -1;
    return `<path d="M${ex} ${base - 14} l${dir * 7} 5 l${-dir * 7} 5 z" fill="var(--cat)" opacity=".7"/><text x="${ex + dir * 6}" y="${base + 11}" text-anchor="${side ? "end" : "start"}" font-size="10" font-weight="700" fill="var(--muted)" font-family="Nunito, sans-serif">+${n}</text>`;
  };
  const bars = bins.map((c, i) => {
    const bh = (c / mx) * (H - 34);
    return `<rect class="bar" style="--i:${i}" x="${(i * bw + 1.5).toFixed(1)}" y="${(base - bh).toFixed(1)}" width="${(bw - 3).toFixed(1)}" height="${bh.toFixed(1)}" rx="3" fill="var(--cat)" opacity=".28"/>`;
  }).join("");
  const top = 26, hx = x(h.median), icon = (cx, svg) => placed(svg, cx, top - 12, 22);
  const you = guess == null ? "" : `<line x1="${x(guess)}" x2="${x(guess)}" y1="${top}" y2="${base}" stroke="var(--ink)" stroke-width="2.5"/>${icon(x(guess), fairgoer({ size: 120 }))}`;
  const ax = x(q.answer);
  const answer = showAnswer ? `<line x1="${ax}" x2="${ax}" y1="${top - 18}" y2="${base}" stroke="var(--good)" stroke-width="3" stroke-linecap="round"/><path d="M${ax + 1.5} ${top - 18} l11 4.5 l-11 4.5 z" fill="var(--good)"/>` : "";
  return `<svg viewBox="-12 0 ${W + 24} ${H + 4}" role="img" aria-label="How the herd guessed">
    ${bars}
    <line x1="0" x2="${W}" y1="${base}" y2="${base}" stroke="var(--line)" stroke-width="1.5"/>
    ${more(0)}${more(1)}
    <line x1="${hx}" x2="${hx}" y1="${top}" y2="${base}" stroke="var(--ox-dark)" stroke-width="2" stroke-dasharray="3 3"/>
    ${icon(hx, oxHead({ size: 120 }))}
    ${you}${answer}
  </svg>`;
}

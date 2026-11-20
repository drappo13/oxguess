// Saving never throws your work away. The page sends what it loaded (base) and what you have now (mine); anything
// you changed since loading is applied onto what is on disk now, and everything you didn't touch keeps whatever is on
// disk (say, an edit Claude made from the chat meanwhile). Questions, days and day marks merge one at a time, ready
// ticks one id at a time, the ideas list as a whole. If the same question or day was also changed elsewhere, yours
// wins and a note says so.
const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

function mergeKeyed(base, mine, now, label, notes) {
  const out = new Map(now);
  for (const k of new Set([...base.keys(), ...mine.keys()])) {
    if (same(base.get(k), mine.get(k))) continue;
    if (!same(base.get(k), now.get(k)) && !same(mine.get(k), now.get(k))) notes.push(`${label} ${k} was also changed elsewhere; your version is kept.`);
    if (mine.has(k)) out.set(k, mine.get(k)); else out.delete(k);
  }
  return out;
}

export function merge(base, mine, now) {
  const notes = [], ids = (qs) => new Map(qs.map((q) => [q.id, q])), entries = (o) => new Map(Object.entries(o ?? {}));
  const questions = [...mergeKeyed(ids(base.questions), ids(mine.questions), ids(now.questions), "Question", notes).values()];
  const days = Object.fromEntries(mergeKeyed(entries(base.days), entries(mine.days), entries(now.days), "Day", notes));
  const review = Object.fromEntries(mergeKeyed(entries(base.review), entries(mine.review), entries(now.review), "The mark for", notes));
  const was = new Set(base.ready ?? []), is = new Set(mine.ready ?? []);
  const ready = [...new Set([...(now.ready ?? []), ...[...is].filter((id) => !was.has(id))])].filter((id) => is.has(id) || !was.has(id));
  const ideas = same(base.ideas, mine.ideas) ? now.ideas : mine.ideas;
  return { questions, days, review, ready, ideas, notes };
}

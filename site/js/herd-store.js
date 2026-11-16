// The real herd, kept in Firestore.
//
// Each day's question has one small summary doc, herd/{date}_{questionId}: { n: guesses, b: { bin: count } }
// with 100 bins across the slider. Every guess adds one to one bin (two writes: the summary and the guess
// itself). Every player reads five tiny docs a day however big the herd gets.
import { initializeApp } from "https://www.gstatic.com/firebasejs/13.3.0/firebase-app.js";
import {
  getFirestore, doc, getDoc, setDoc, addDoc, collection, increment, serverTimestamp, getDocs, query, where,
} from "https://www.gstatic.com/firebasejs/13.3.0/firebase-firestore.js";

export const HERD_BINS = 100;

const firebaseConfig = {
  apiKey: "AIzaSyBPXZMRXSoT5muwLfckEi-wMkAXQ2gJy64",
  authDomain: "oxguess-a2a1b.firebaseapp.com",
  projectId: "oxguess-a2a1b",
  storageBucket: "oxguess-a2a1b.firebasestorage.app",
  messagingSenderId: "413134565281",
  appId: "1:413134565281:web:fb4f9632247f4b9e0565e0",
};

let db = null;
try { db = getFirestore(initializeApp(firebaseConfig)); } catch (e) { console.warn("Herd offline", e); }

/** Local previews are for testing: they read the herd but never add to it (with or without ?day=). */
const testing = ["localhost", "127.0.0.1"].includes(location.hostname);

export function playerId() {
  try {
    let id = localStorage.getItem("ox-player");
    if (!id) { id = `p-${crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)}`; localStorage.setItem("ox-player", id); }
    return id;
  } catch { return "p-anon"; }
}

const herdKey = (day, q) => `${day}_${q.id}`;
const binOf = (pos, steps) => Math.min(HERD_BINS - 1, Math.max(0, Math.floor((pos / steps) * HERD_BINS)));

/** Today's five herd summaries. Never throws; missing herds come back empty. */
export async function loadHerds(day, questions) {
  const out = {};
  if (!db) return out;
  await Promise.all(questions.map(async (q) => {
    try {
      const snap = await getDoc(doc(db, "herd", herdKey(day, q)));
      if (snap.exists()) out[q.id] = snap.data();
    } catch (e) { console.warn("Herd read failed", e.code ?? e); }
  }));
  return out;
}

/** For the stats page: every guess and finished round from a date on. Throws if the rules don't allow reads. */
export async function loadActivity(since) {
  if (!db) throw new Error("Firestore didn't start");
  const rows = async (name) => (await getDocs(query(collection(db, name), where("day", ">=", since)))).docs.map((d) => d.data());
  const [guesses, plays] = await Promise.all([rows("guesses"), rows("plays")]);
  return { guesses, plays };
}

/** Add one guess to the herd. Fire and forget: the game never waits on it or breaks without it. */
export function recordGuess(day, q, pos, steps, value) {
  const bin = binOf(pos, steps);
  if (!db || testing) return bin;
  const player = playerId();
  setDoc(doc(db, "herd", herdKey(day, q)), { n: increment(1), b: { [bin]: increment(1) }, k: String(bin) }, { merge: true })
    .catch((e) => console.warn("Herd write failed", e.code ?? e));
  addDoc(collection(db, "guesses"), { day, qid: q.id, pos, value, player, at: serverTimestamp() })
    .catch((e) => console.warn("Guess write failed", e.code ?? e));
  return bin;
}

/** Save a finished round (for streaks and stats later). */
export function recordPlay(day, round, pts) {
  if (!db || testing) return;
  const player = playerId();
  setDoc(doc(db, "plays", `${day}_${player}`), { day, round, player, pts, total: pts.reduce((a, b) => a + b, 0), at: serverTimestamp() })
    .catch((e) => console.warn("Play write failed", e.code ?? e));
}

/** One record per player, rebuilt from the device's own history after each finished round.
 *  Values are absolute (not increments), so replaying or retrying a write can never double-count. */
export function recordPlayer(summary) {
  if (!db || testing) return;
  const player = playerId();
  setDoc(doc(db, "players", player), { player, ...summary, updated: serverTimestamp() })
    .catch((e) => console.warn("Player write failed", e.code ?? e));
}

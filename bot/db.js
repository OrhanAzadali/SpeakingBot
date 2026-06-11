import { Low } from "lowdb";
import { JSONFile } from "lowdb/node";
import { join } from "path";

const adapter = new JSONFile(join(process.cwd(), "db.json"));
const db = new Low(adapter, {
  users: [],
  flashcards: [],
  history: [],
  _nextId: 1,
});

await db.read();

function nextId() {
  const id = db.data._nextId++;
  db.write();
  return id;
}

// ── Users ─────────────────────────────────────────────────────────────────────

export function getUser(userId) {
  return db.data.users.find((u) => u.user_id === userId) ?? null;
}

export function upsertUser(userId, fields = {}) {
  const idx = db.data.users.findIndex((u) => u.user_id === userId);
  if (idx === -1) {
    db.data.users.push({ user_id: userId, language: null, level: null, state: "idle", ...fields });
  } else {
    Object.assign(db.data.users[idx], fields);
  }
  db.write();
}

// ── History ───────────────────────────────────────────────────────────────────

export function addHistory(userId, role, content) {
  db.data.history.push({ id: nextId(), user_id: userId, role, content, created_at: new Date().toISOString() });
  db.write();
}

export function getHistory(userId, limit = 10) {
  return db.data.history
    .filter((h) => h.user_id === userId)
    .slice(-limit);
}

export function clearHistory(userId) {
  db.data.history = db.data.history.filter((h) => h.user_id !== userId);
  db.write();
}

// ── Flashcards ────────────────────────────────────────────────────────────────

export function addFlashcard(userId, word, correction, context) {
  const exists = db.data.flashcards.find((c) => c.user_id === userId && c.word === word);
  if (!exists) {
    db.data.flashcards.push({
      id: nextId(), user_id: userId, word, correction, context,
      next_review: new Date().toISOString(),
      ease_factor: 2.5, interval: 1,
    });
    db.write();
  }
}

export function getFlashcards(userId) {
  return db.data.flashcards.filter((c) => c.user_id === userId);
}

export function getDueFlashcards(userId) {
  const now = new Date();
  return db.data.flashcards
    .filter((c) => c.user_id === userId && new Date(c.next_review) <= now)
    .slice(0, 20);
}

export function updateFlashcard(id, remembered) {
  const card = db.data.flashcards.find((c) => c.id === id);
  if (!card) return;
  if (remembered) {
    card.interval = Math.round(card.interval * card.ease_factor);
    card.ease_factor = Math.min(card.ease_factor + 0.1, 3.0);
  } else {
    card.interval = 1;
    card.ease_factor = Math.max(card.ease_factor - 0.2, 1.3);
  }
  const next = new Date();
  next.setDate(next.getDate() + card.interval);
  card.next_review = next.toISOString();
  db.write();
}

export default db;
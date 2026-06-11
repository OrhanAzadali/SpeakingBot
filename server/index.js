import express from "express";
import cors from "cors";
import { getFlashcards } from "../bot/db.js";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/api/flashcards", (req, res) => {
    const userId = req.query.userId;
    const cards = getFlashcards(userId);
    res.json({ cards });
});

app.post("/api/flashcards/:id/review", (req, res) => {
    res.json({ ok: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("API running on", PORT));
import { useState, useRef } from 'react';
import axios from 'axios';

export const MemoryMatch = ({ targetLanguage = 'English', userLevel = 'B1' }) => {
    const [game, setGame] = useState(null);
    const [flipped, setFlipped] = useState([]);
    const [matched, setMatched] = useState(new Set());
    const isGeneratingRef = useRef(false);

    const startGame = async () => {
        if (isGeneratingRef.current) return;
        isGeneratingRef.current = true;
        try {
            const { data } = await axios.post('/api/games/generate-words', {
                targetLanguage,
                userLevel,
                count: 6,
                wordType: 'noun',
            });
            const words = data.words;
            const pairs = words.map((word, i) => ({ id: i, word, matched: false }));
            setGame(pairs);
            setFlipped([]);
            setMatched(new Set());
        } catch (err) {
            console.warn('MemoryMatch fetch failed:', err);
            // Optional: fallback to static list
            const fallback = ['apple', 'banana', 'cherry', 'date', 'elder', 'fig'];
            const pairs = fallback.map((word, i) => ({ id: i, word, matched: false }));
            setGame(pairs);
        } finally {
            isGeneratingRef.current = false;
        }
    };

    const words = data.words;
    const pairs = words.map((word, i) => ({ id: i, word, matched: false }));
    setGame(pairs);
    setFlipped([]);
    setMatched(new Set());
};

const flip = async (id) => {
    if (matched.has(id) || flipped.length === 2) return;
    const { data } = await axios.post('/api/games/memory/flip', { userId: 'default-user', cardId: id });
    const newFlipped = [...flipped, { id, word: data.word }];
    setFlipped(newFlipped);
    if (newFlipped.length === 2) {
        const [card1, card2] = newFlipped;
        const { data: matchData } = await axios.post('/api/games/memory/match', { userId: 'default-user', card1: card1.id, card2: card2.id });
        if (matchData.matched) {
            setMatched(prev => new Set([...prev, card1.id, card2.id]));
        }
        setTimeout(() => setFlipped([]), 800);
    }
};

return (
    <div className="memory-game">
        <button onClick={startGame}>Start Memory Match</button>
        <div className="grid grid-cols-3 gap-3">
            {game && game.map((card, idx) => {
                const isFlipped = flipped.some(f => f.id === idx) || matched.has(idx);
                return (
                    <button
                        key={idx}
                        onClick={() => flip(idx)}
                        className={`p-4 rounded-xl ${isFlipped ? 'bg-sky-500' : 'bg-slate-800'}`}
                    >
                        {isFlipped ? (flipped.find(f => f.id === idx)?.word || '✓') : '?'}
                    </button>
                );
            })}
        </div>
    </div>
);
};
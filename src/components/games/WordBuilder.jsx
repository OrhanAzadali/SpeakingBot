import { useState, useRef } from 'react';
import axios from 'axios';

export const WordBuilder = ({ targetLanguage = 'English', userLevel = 'B1' }) => {
    const [targetWord, setTargetWord] = useState('');
    const [foundWords, setFoundWords] = useState([]);
    const [input, setInput] = useState('');
    const isGeneratingRef = useRef(false);

    const startGame = async () => {
        if (isGeneratingRef.current) return;
        isGeneratingRef.current = true;
        try {
            const { data } = await axios.post('/api/games/generate-words', {
                targetLanguage,
                userLevel,
                count: 1,
                wordType: 'target',
            });
            const target = data.words[0].toUpperCase();
            setTargetWord(target);
            setFoundWords([]);
        } catch (err) {
            console.warn('WordBuilder fetch failed:', err);
            setTargetWord('LANGUAGE'); // fallback
        } finally {
            isGeneratingRef.current = false;
        }
    };

    // ... rest unchanged
};
const submitWord = async () => {
    const { data } = await axios.post('/api/games/wordbuilder/verify', { userId: 'default-user', word: input });
    if (data.valid) {
        setFoundWords(data.foundWords);
        setInput('');
    } else {
        alert(data.message);
    }
};

return (
    <div>
        <button onClick={startGame}>Start Word Builder</button>
        {targetWord && (
            <div>
                <p>Target: {targetWord}</p>
                <input value={input} onChange={e => setInput(e.target.value)} placeholder="Enter word" />
                <button onClick={submitWord}>Submit</button>
                <ul>{foundWords.map(w => <li key={w}>{w}</li>)}</ul>
            </div>
        )}
    </div>
);
};
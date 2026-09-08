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

    const submitWord = async () => {
        if (!input.trim()) return;
        const { data } = await axios.post('/api/games/wordbuilder/verify', {
            userId: 'default-user',
            word: input.trim(),
        });
        if (data.valid) {
            setFoundWords(data.foundWords);
            setInput('');
        } else {
            alert(data.message);
        }
    };

    return (
        <div className="word-builder max-w-md mx-auto">
            <h2 className="text-xl font-bold text-white mb-4">Word Builder</h2>
            <button onClick={startGame} className="px-4 py-2 bg-emerald-600 text-white rounded-xl mb-4">
                Start Game
            </button>
            {targetWord && (
                <div>
                    <p className="text-white">Target: <strong>{targetWord}</strong></p>
                    <input
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        placeholder="Enter a word"
                        className="px-3 py-2 bg-slate-800 text-white rounded-xl mr-2"
                    />
                    <button onClick={submitWord} className="px-4 py-2 bg-sky-600 text-white rounded-xl">
                        Submit
                    </button>
                    <ul className="mt-4 text-white">
                        {foundWords.map(w => <li key={w}>{w}</li>)}
                    </ul>
                </div>
            )}
        </div>
    );
};
import { useState } from 'react';
import axios from 'axios';

export const WordBuilder = () => {
    const [targetWord, setTargetWord] = useState('');
    const [foundWords, setFoundWords] = useState([]);
    const [input, setInput] = useState('');

    const startGame = async () => {
        const { data } = await axios.post('/api/games/wordbuilder/start', { userId: 'default-user' });
        setTargetWord(data.targetWord);
        setFoundWords([]);
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
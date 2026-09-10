// test-multi-source.js
async function test() {
    const sources = [
        { name: "Gutendex base", url: "https://gutendex.com/books?languages=en" },
        { name: "Gutendex page 5", url: "https://gutendex.com/books?languages=en&page=5" },
        { name: "Open Library fixed", url: "https://openlibrary.org/search.json?q=fiction&sort=random&limit=5&language=eng" },
        { name: "Static Book 1342", url: "https://www.gutenberg.org/cache/epub/1342/pg1342.txt" },
        { name: "Static Book 84", url: "https://www.gutenberg.org/cache/epub/84/pg84.txt" },
    ];

    for (const s of sources) {
        const start = Date.now();
        try {
            const res = await fetch(s.url, { signal: AbortSignal.timeout(25000) });
            const ms = Date.now() - start;
            console.log(`${s.name}: HTTP ${res.status} ${res.ok ? '✅' : '❌'} (${ms}ms)`);
        } catch (e) {
            const ms = Date.now() - start;
            console.log(`${s.name}: ERROR ${e.message} (${ms}ms)`);
        }
    }
}
test();
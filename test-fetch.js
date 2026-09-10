// test-fetch.js
fetch('https://www.gutenberg.org/ebooks/random', { redirect: 'follow' })
    .then(r => {
        console.log('STATUS:', r.status);
        console.log('FINAL URL:', r.url);
        return r.text();
    })
    .then(html => {
        console.log('HTML LENGTH:', html.length);
        const m = html.match(/itemprop=["']inLanguage["']\s+content=["']([a-zA-Z-]+)["']/i);
        console.log('LANG MATCH:', m ? m[1] : 'NOT FOUND');
        const t = html.match(/<title>([^<]+)<\/title>/);
        console.log('TITLE:', t ? t[1].slice(0, 80) : 'NOT FOUND');
    })
    .catch(e => console.error('FETCH ERROR:', e.message));
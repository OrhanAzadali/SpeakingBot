// test-byok.js
const BASE = "http://localhost:3000";

(async () => {
    // 1. Тест ключа (не сохраняем)
    console.log("=== TEST ===");
    const testRes = await fetch(`${BASE}/api/user/api-keys/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            provider: "groq",
            apiKey: process.env.GROQ_API_KEY,  // берём из .env
        }),
    });
    console.log(await testRes.json());

    // 2. Сохранить ключ
    console.log("\n=== SAVE ===");
    const saveRes = await fetch(`${BASE}/api/user/api-keys`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            userId: "default-user",
            provider: "groq",
            apiKey: process.env.GROQ_API_KEY,
        }),
    });
    console.log(await saveRes.json());

    // 3. Прочитать список (должен вернуть маску, не полный ключ)
    console.log("\n=== LIST ===");
    const listRes = await fetch(`${BASE}/api/user/api-keys?userId=default-user`);
    console.log(await listRes.json());

    // 4. Удалить
    console.log("\n=== DELETE ===");
    const delRes = await fetch(`${BASE}/api/user/api-keys/groq?userId=default-user`, {
        method: "DELETE",
    });
    console.log(await delRes.json());

    // 5. Проверить, что удалено
    console.log("\n=== LIST AFTER DELETE ===");
    const listRes2 = await fetch(`${BASE}/api/user/api-keys?userId=default-user`);
    console.log(await listRes2.json());
})();
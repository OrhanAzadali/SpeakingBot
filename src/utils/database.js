// src/utils/database.js
import { createClient } from '@supabase/supabase-js';
import Redis from 'ioredis';

// ============ SUPABASE (PostgreSQL) ============
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const supabase = supabaseUrl && supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    })
    : null;

// ============ UPSTASH REDIS ============
const redisUrl = process.env.UPSTASH_REDIS_URL;
const redisToken = process.env.UPSTASH_REDIS_TOKEN;

export const redis = redisUrl && redisToken
    ? new Redis({
        host: new URL(redisUrl).hostname,
        port: 6379,
        password: redisToken,
        tls: {},
        retryStrategy: (times) => {
            if (times > 3) {
                console.warn('[Redis] Retry attempts exhausted, using memory fallback');
                return null;
            }
            return Math.min(times * 100, 3000);
        }
    })
    : null;

// Redis connection events
if (redis) {
    redis.on('connect', () => console.log('[Redis] Connected to Upstash'));
    redis.on('error', (err) => console.error('[Redis] Error:', err.message));
}

// ============ USER HELPERS ============
export async function getUser(userId) {
    if (!supabase) {
        // Fallback to memory if no database
        return null;
    }

    const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('user_id', userId)
        .single();

    if (error) {
        console.error('[DB] Error fetching user:', error.message);
        return null;
    }

    return data;
}

export async function saveUser(userId, userData) {
    if (!supabase) return null;

    const { data, error } = await supabase
        .from('users')
        .upsert({
            user_id: userId,
            ...userData,
            updated_at: new Date().toISOString()
        })
        .select()
        .single();

    if (error) {
        console.error('[DB] Error saving user:', error.message);
        return null;
    }

    return data;
}

// ============ VOCABULARY HELPERS ============
export async function getVocabulary(userId, targetLanguage) {
    if (!supabase) return [];

    const { data, error } = await supabase
        .from('vocabulary')
        .select('*')
        .eq('user_id', userId)
        .eq('target_language', targetLanguage)
        .order('saved_at', { ascending: false });

    if (error) {
        console.error('[DB] Error fetching vocabulary:', error.message);
        return [];
    }

    return data || [];
}

export async function saveVocabulary(userId, wordData) {
    if (!supabase) return null;

    const { data, error } = await supabase
        .from('vocabulary')
        .insert({
            user_id: userId,
            ...wordData,
            saved_at: new Date().toISOString()
        })
        .select()
        .single();

    if (error) {
        console.error('[DB] Error saving vocabulary:', error.message);
        return null;
    }

    return data;
}

export async function deleteVocabulary(userId, wordId) {
    if (!supabase) return false;

    const { error } = await supabase
        .from('vocabulary')
        .delete()
        .eq('id', wordId)
        .eq('user_id', userId);

    if (error) {
        console.error('[DB] Error deleting vocabulary:', error.message);
        return false;
    }

    return true;
}

// ============ ROADMAP HELPERS ============
export async function getRoadmaps(userId) {
    if (!supabase) return [];

    const { data, error } = await supabase
        .from('roadmaps')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('[DB] Error fetching roadmaps:', error.message);
        return [];
    }

    return data || [];
}

export async function saveRoadmap(userId, roadmapData) {
    if (!supabase) return null;

    const { data, error } = await supabase
        .from('roadmaps')
        .insert({
            user_id: userId,
            ...roadmapData,
            created_at: new Date().toISOString()
        })
        .select()
        .single();

    if (error) {
        console.error('[DB] Error saving roadmap:', error.message);
        return null;
    }

    return data;
}

// ============ GRAMMAR GUIDE HELPERS ============
export async function getGrammarGuides(userId) {
    if (!supabase) return [];

    const { data, error } = await supabase
        .from('grammar_guides')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('[DB] Error fetching grammar guides:', error.message);
        return [];
    }

    return data || [];
}

export async function saveGrammarGuide(userId, guideData) {
    if (!supabase) return null;

    const { data, error } = await supabase
        .from('grammar_guides')
        .insert({
            user_id: userId,
            ...guideData,
            created_at: new Date().toISOString()
        })
        .select()
        .single();

    if (error) {
        console.error('[DB] Error saving grammar guide:', error.message);
        return null;
    }

    return data;
}

// ============ SKILL SCORES HELPERS ============
export async function getSkillScores(userId) {
    if (!supabase) return {};

    const { data, error } = await supabase
        .from('skill_scores')
        .select('*')
        .eq('user_id', userId);

    if (error) {
        console.error('[DB] Error fetching skill scores:', error.message);
        return {};
    }

    const scores = {};
    data.forEach(row => {
        scores[row.skill_name] = row.score;
    });
    return scores;
}

export async function saveSkillScore(userId, skillName, score) {
    if (!supabase) return null;

    const { data, error } = await supabase
        .from('skill_scores')
        .upsert({
            user_id: userId,
            skill_name: skillName,
            score: score,
            last_tested: new Date().toISOString()
        })
        .select()
        .single();

    if (error) {
        console.error('[DB] Error saving skill score:', error.message);
        return null;
    }

    return data;
}

// ============ REDIS HELPERS (for session/cache) ============
export async function getFromCache(key) {
    if (!redis) return null;

    try {
        const data = await redis.get(key);
        return data ? JSON.parse(data) : null;
    } catch (err) {
        console.error('[Redis] Error getting key:', err.message);
        return null;
    }
}

export async function setToCache(key, value, ttlSeconds = 3600) {
    if (!redis) return false;

    try {
        await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
        return true;
    } catch (err) {
        console.error('[Redis] Error setting key:', err.message);
        return false;
    }
}

export async function deleteFromCache(key) {
    if (!redis) return false;

    try {
        await redis.del(key);
        return true;
    } catch (err) {
        console.error('[Redis] Error deleting key:', err.message);
        return false;
    }
}

// Conversation history helpers for bot.js
export async function getConversationHistory(userId) {
    const key = `conv:${userId}`;
    return await getFromCache(key) || [];
}

export async function saveConversationHistory(userId, history) {
    const key = `conv:${userId}`;
    return await setToCache(key, history, 86400); // 24 hours TTL
}

// Active game state helpers
export async function getGameState(userId, gameType) {
    const key = `game:${gameType}:${userId}`;
    return await getFromCache(key);
}

export async function saveGameState(userId, gameType, state) {
    const key = `game:${gameType}:${userId}`;
    return await setToCache(key, state, 3600); // 1 hour TTL
}

// TTS cache helpers
export async function getTtsCache(text, lang) {
    const key = `tts:${lang}:${text}`;
    return await getFromCache(key);
}

export async function saveTtsCache(text, lang, filePath) {
    const key = `tts:${lang}:${text}`;
    return await setToCache(key, filePath, 86400 * 7); // 7 days TTL
}
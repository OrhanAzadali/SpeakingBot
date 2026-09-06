import React, { useState, useEffect } from "react";
import {
    BookOpen,
    Download,
    Send,
    Search,
    ArrowLeft,
    Sparkles,
    X,
    FileText,
    CheckCircle2,
    ListFilter,
    ChevronRight,
    Trash2,
} from "lucide-react";
import { getStarterGrammarTopics } from "../utils/fallbackData.js";

export default function GrammarBook({ API, authHeaders, effectiveUserId, onExit }) {
    // If API prop is passed from App.jsx, use it; otherwise fallback to environment variable or your Render backend URL
    const BACKEND_URL = API || import.meta.env.VITE_BACKEND_URL || "https://speakingbot.onrender.com";

    const [topics, setTopics] = useState([]);
    const [language, setLanguage] = useState("");
    const [loading, setLoading] = useState(true);
    // Inside GrammarBook.jsx, right above the Search Bar:
    const [customTopicPrompt, setCustomTopicPrompt] = useState("");
    const [generatingTopic, setGeneratingTopic] = useState(false);

    const [searchQuery, setSearchQuery] = useState("");
    const [selectedCategory, setSelectedCategory] = useState("All");
    const [selectedTopic, setSelectedTopic] = useState(null);
    const [actionLoading, setActionLoading] = useState(null);
    const [toast, setToast] = useState(null);
    const handleCreateCustomTopic = async (e) => {
        e.preventDefault();
        if (!customTopicPrompt.trim() || generatingTopic) return;
        setGeneratingTopic(true);
        showToast(`🤖 Generating comprehensive guide for «${customTopicPrompt}»...`);

        try {
            const res = await fetch(`${BACKEND_URL}/api/grammar/generate`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...authHeaders
                },
                body: JSON.stringify({ userId: effectiveUserId, topicPrompt: customTopicPrompt.trim() })
            });
            const data = await res.json();
            if (res.ok && data.topic) {
                showToast("✨ New Grammar Rule generated and saved!");
                setTopics((prev) => [data.topic, ...prev]);
                setCustomTopicPrompt("");
                setSelectedTopic(data.topic); // open immediately
            } else {
                showToast(data.error || "Generation failed");
            }
        } catch {
            showToast("Network error creating topic");
        } finally {
            setGeneratingTopic(false);
        }
    };

    const showToast = (message) => {
        setToast(message);
        setTimeout(() => setToast(null), 3500);
    };

    const fetchTopics = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${BACKEND_URL}/api/grammar?userId=${effectiveUserId}`, {
                headers: authHeaders,
            });
            if (res.ok) {
                const data = await res.json();
                if (data.topics && data.topics.length > 0) {
                    setTopics(data.topics);
                } else {
                    setTopics(getStarterGrammarTopics(data.language || "english"));
                }
                if (data.language) setLanguage(data.language);
            } else {
                setTopics(getStarterGrammarTopics("english"));
            }
        } catch (err) {
            console.error("Failed to fetch grammar topics, loading safe fallback topics:", err);
            setTopics(getStarterGrammarTopics("english"));
        } finally {
            setLoading(false);
        }
    };
    useEffect(() => {
        fetchTopics();
    }, []);


    const handleDownloadTopicPdf = (topicId, title) => {
        showToast(`Preparing PDF: ${title}`);
        const downloadUrl = `${BACKEND_URL}/api/grammar/${topicId}/pdf?userId=${effectiveUserId}`;

        // Fix for Telegram MiniApp: Use openLink so native Telegram opens and downloads the file
        if (window.Telegram?.WebApp?.openLink) {
            window.Telegram.WebApp.openLink(downloadUrl);
        } else {
            window.open(downloadUrl, "_blank");
        }
    };

    const handleDownloadAllGrammarPdf = () => {
        showToast("Generating Complete Grammar Book PDF...");
        const downloadUrl = `${BACKEND_URL}/api/grammar/pdf?userId=${effectiveUserId}`;

        // Fix for Telegram MiniApp: Use openLink so native Telegram opens and downloads the file
        if (window.Telegram?.WebApp?.openLink) {
            window.Telegram.WebApp.openLink(downloadUrl);
        } else {
            window.open(downloadUrl, "_blank");
        }
    };

    const handleSendGrammarToTelegram = async (topicId) => {
        const actionKey = topicId ? `tg-${topicId}` : "tg-all";
        setActionLoading(actionKey);
        try {
            const res = await fetch(`${BACKEND_URL}/api/grammar/send-pdf`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...authHeaders,
                },
                body: JSON.stringify({ topicId }),
            });
            const data = await res.json();
            if (res.ok) {
                showToast("✈️ PDF sent directly to your Telegram chat!");
            } else {
                showToast(data.error || "Failed to send PDF to Telegram");
            }
        } catch {
            showToast("Network error connecting to backend server");
        } finally {
            setActionLoading(null);
        }
    };

    const handleDeleteTopic = async (topicId, e) => {
        if (e) e.stopPropagation();
        if (!confirm("Are you sure you want to delete this grammar topic?")) return;

        try {
            const res = await fetch(`${BACKEND_URL}/api/grammar/${topicId}?userId=${effectiveUserId}`, {
                method: "DELETE",
                headers: authHeaders,
            });
            if (res.ok) {
                showToast("🗑 Topic deleted successfully");
                setTopics((prev) => prev.filter((t) => t.id !== topicId));
                if (selectedTopic?.id === topicId) setSelectedTopic(null);
            } else {
                showToast("Failed to delete topic");
            }
        } catch {
            showToast("Network error deleting topic");
        }
    };


    const categories = ["All", ...Array.from(new Set(topics.map((t) => t.category).filter(Boolean)))];

    const filteredTopics = topics.filter((t) => {
        const matchesCat = selectedCategory === "All" || t.category === selectedCategory;
        const matchesSearch =
            t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (t.rule_summary && t.rule_summary.toLowerCase().includes(searchQuery.toLowerCase()));
        return matchesCat && matchesSearch;
    });

    const parseExamples = (raw) => {
        if (Array.isArray(raw)) return raw;
        if (typeof raw === "string") {
            try {
                return JSON.parse(raw);
            } catch {
                return [];
            }
        }
        return [];
    };


    return (
        <div className="min-h-screen bg-slate-900 text-white flex flex-col p-4 sm:p-6 font-sans">
            {/* Toast Notification */}
            {toast && (
                <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-semibold shadow-xl flex items-center gap-2 animate-in fade-in">
                    <Sparkles className="w-4 h-4 text-indigo-200" />
                    <span>{toast}</span>
                </div>
            )}

            {/* Header */}
            <div className="max-w-4xl w-full mx-auto flex items-center justify-between pb-4 border-b border-slate-800">
                <button
                    onClick={onExit}
                    className="text-xs text-slate-400 hover:text-white transition flex items-center gap-1.5"
                >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back to Games</span>
                </button>

                <h1 className="font-bold text-base sm:text-lg flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-indigo-400" />
                    <span>Grammar Reference Book</span>
                    {language && (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-indigo-950 text-indigo-300 border border-indigo-800/80">
                            {language.toUpperCase()}
                        </span>
                    )}
                </h1>

                <button
                    onClick={handleDownloadAllGrammarPdf}
                    className="py-1.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow transition flex items-center gap-1.5"
                >
                    <Download className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Download Book</span> (PDF)
                </button>
            </div>
            {/* Quick AI Rule Generator Input */}
            <form onSubmit={handleCreateCustomTopic} className="max-w-4xl w-full mx-auto mb-4 flex gap-2">
                <input
                    type="text"
                    placeholder="Enter any grammar topic (e.g. «Subjunctive mood», «Present Perfect vs Past Simple», «Conjugation of haben»)..."
                    value={customTopicPrompt}
                    onChange={(e) => setCustomTopicPrompt(e.target.value)}
                    disabled={generatingTopic}
                    className="flex-1 px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-indigo-500 disabled:opacity-50"
                />
                <button
                    type="submit"
                    disabled={generatingTopic || !customTopicPrompt.trim()}
                    className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition disabled:opacity-50 flex items-center gap-1.5 shrink-0"
                >
                    <Sparkles className="w-4 h-4" />
                    <span>{generatingTopic ? "Generating..." : "Generate AI Rule"}</span>
                </button>
            </form>
            {/* Search & Categories */}
            <div className="max-w-4xl w-full mx-auto my-4 flex flex-col sm:flex-row gap-2.5">
                <div className="relative flex-1">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                        type="text"
                        placeholder="Search grammar rules, tenses, or verbs..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-indigo-500"
                    />
                </div>

                {categories.length > 1 && (
                    <div className="flex items-center gap-1 overflow-x-auto pb-1">
                        <ListFilter className="w-3.5 h-3.5 text-slate-500 shrink-0 mr-1" />
                        {categories.map((cat) => (
                            <button
                                key={cat}
                                onClick={() => setSelectedCategory(cat)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${selectedCategory === cat
                                    ? "bg-indigo-600 text-white"
                                    : "bg-slate-800 text-slate-400 hover:text-white"
                                    }`}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Topics Content */}
            <div className="max-w-4xl w-full mx-auto flex-1">
                {loading ? (
                    <div className="py-20 text-center text-slate-400 text-sm">
                        <div className="text-3xl mb-2 animate-spin">🌀</div>
                        Loading grammar rules...
                    </div>
                ) : filteredTopics.length === 0 ? (
                    <div className="bg-slate-800/60 border border-slate-800 rounded-2xl p-10 text-center max-w-md mx-auto my-12">
                        <FileText className="w-12 h-12 text-slate-500 mx-auto mb-3" />
                        <h3 className="font-bold text-white text-base">No Grammar Rules Saved Yet</h3>
                        <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                            Ask any grammar question in chat (e.g. <i>«how to conjugate verbs?»</i>, <i>«explain cases»</i>), or click below to generate your starter PDF book!
                        </p>
                        <button
                            onClick={() => handleSendGrammarToTelegram()}
                            disabled={actionLoading === "tg-all"}
                            className="mt-5 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition inline-flex items-center gap-2"
                        >
                            <Sparkles className="w-4 h-4" />
                            <span>{actionLoading === "tg-all" ? "Generating..." : "Send Starter Book to Telegram Chat"}</span>
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        {filteredTopics.map((topic) => {
                            const examples = parseExamples(topic.examples);
                            return (
                                <div
                                    key={topic.id}
                                    className="bg-slate-800/90 border border-slate-700 hover:border-indigo-500 rounded-2xl p-4 flex flex-col justify-between transition shadow-lg"
                                >
                                    <div>
                                        <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
                                            <span className="uppercase tracking-wider font-semibold text-indigo-400">
                                                {topic.category || "Grammar"}
                                            </span>
                                            <span>{new Date(topic.updated_at || topic.created_at).toLocaleDateString()}</span>
                                        </div>

                                        <h3 className="font-bold text-sm text-white">{topic.title}</h3>

                                        {topic.rule_summary && (
                                            <p className="text-xs text-slate-300 mt-2 bg-slate-900/80 p-2.5 rounded-xl border border-slate-800 leading-relaxed">
                                                <span className="font-semibold text-amber-300">📌 Takeaway: </span>
                                                {topic.rule_summary}
                                            </p>
                                        )}

                                        {examples.length > 0 && (
                                            <p className="text-xs text-slate-400 mt-2">
                                                • {examples.length} model sentences with translations
                                            </p>
                                        )}
                                    </div>

                                    <div className="mt-4 pt-3 border-t border-slate-700/60 flex items-center justify-between gap-2">
                                        <button
                                            onClick={() => setSelectedTopic(topic)}
                                            className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition flex items-center gap-1"
                                        >
                                            <span>View Full Rule</span>
                                            <ChevronRight className="w-3.5 h-3.5" />
                                        </button>

                                        <div className="flex items-center gap-1.5">
                                            <button
                                                onClick={() => handleDownloadTopicPdf(topic.id, topic.title)}
                                                className="py-1 px-2.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-semibold transition flex items-center gap-1"
                                                title="Download PDF"
                                            >
                                                <Download className="w-3 h-3 text-slate-300" />
                                                <span>PDF</span>
                                            </button>
                                            <button
                                                onClick={() => handleSendGrammarToTelegram(topic.id)}
                                                disabled={actionLoading === `tg-${topic.id}`}
                                                className="py-1 px-2.5 rounded-lg bg-indigo-950/80 border border-indigo-800 text-indigo-300 text-xs font-semibold hover:bg-indigo-900 transition disabled:opacity-50 flex items-center gap-1"
                                                title="Send PDF to Telegram"
                                            >
                                                <Send className="w-3 h-3 text-indigo-400" />
                                                <span>{actionLoading === `tg-${topic.id}` ? "..." : "TG"}</span>
                                            </button>
                                            {/* Delete button on card */}
                                            <button
                                                onClick={(e) => handleDeleteTopic(topic.id, e)}
                                                className="py-1 px-2 rounded-lg bg-rose-950/60 border border-rose-900/80 text-rose-400 hover:bg-rose-900 hover:text-white text-xs font-semibold transition flex items-center justify-center"
                                                title="Delete Rule"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Modal Detailed Rule View */}
            {selectedTopic && (
                <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-slate-800 border border-slate-700 w-full max-w-xl max-h-[85vh] rounded-2xl flex flex-col shadow-2xl overflow-hidden text-left">
                        <div className="p-4 border-b border-slate-700 flex items-center justify-between bg-slate-900/60">
                            <div>
                                <span className="text-xs uppercase font-semibold text-indigo-400">
                                    {selectedTopic.category || "Grammar"}
                                </span>
                                <h2 className="font-bold text-base text-white mt-1">{selectedTopic.title}</h2>
                            </div>
                            <button
                                onClick={() => setSelectedTopic(null)}
                                className="w-7 h-7 rounded-lg bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="p-5 overflow-y-auto space-y-4 text-xs sm:text-sm text-slate-200 leading-relaxed font-sans">
                            {selectedTopic.rule_summary && (
                                <div className="p-3 bg-indigo-950/50 border border-indigo-800/80 rounded-xl text-indigo-200 text-xs">
                                    <span className="font-bold">📌 Rule Takeaway: </span>
                                    {selectedTopic.rule_summary}
                                </div>
                            )}

                            <div className="whitespace-pre-wrap font-sans text-slate-300">
                                {selectedTopic.explanation}
                            </div>

                            {(() => {
                                const examples = parseExamples(selectedTopic.examples);
                                if (examples.length === 0) return null;
                                return (
                                    <div className="mt-4 pt-3 border-t border-slate-700">
                                        <div className="font-bold text-white text-xs mb-2">💬 Model Examples:</div>
                                        <div className="space-y-2">
                                            {examples.map((ex, i) => (
                                                <div key={i} className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-xs">
                                                    <p className="font-semibold text-emerald-400">{ex.target}</p>
                                                    <p className="text-slate-300 mt-0.5">— {ex.translation}</p>
                                                    {ex.note && <p className="text-indigo-300 mt-1 italic">Note: {ex.note}</p>}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>

                        {/* Modal Action Footer with Delete Button */}
                        <div className="p-3 border-t border-slate-700 bg-slate-900/60 flex items-center justify-between">
                            <button
                                onClick={() => handleDeleteTopic(selectedTopic.id)}
                                className="py-1.5 px-3 rounded-xl bg-rose-950/70 border border-rose-900 text-rose-300 hover:bg-rose-900 hover:text-white text-xs font-semibold transition flex items-center gap-1.5"
                                title="Delete this topic"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Delete Rule</span>
                            </button>

                            <div className="flex gap-2">
                                <button
                                    onClick={() => handleDownloadTopicPdf(selectedTopic.id, selectedTopic.title)}
                                    className="py-1.5 px-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-xs font-semibold transition flex items-center gap-1.5"
                                >
                                    <Download className="w-3.5 h-3.5" />
                                    <span>Download PDF</span>
                                </button>
                                <button
                                    onClick={() => handleSendGrammarToTelegram(selectedTopic.id)}
                                    disabled={actionLoading === `tg-${selectedTopic.id}`}
                                    className="py-1.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition disabled:opacity-50 flex items-center gap-1.5"
                                >
                                    <Send className="w-3.5 h-3.5" />
                                    <span>Send to TG</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

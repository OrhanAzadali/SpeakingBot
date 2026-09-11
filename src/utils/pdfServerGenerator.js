import { jsPDF } from 'jspdf';
import DejaVuSansBase64 from "./fonts/ttf/DejaVuSans.base64.js";
import DejaVuSansBoldBase64 from "./fonts/ttf/DejaVuSans-Bold.base64.js";

function registerUnicodeFonts(doc) {
    doc.addFileToVFS("DejaVuSans.ttf", DejaVuSansBase64);
    doc.addFileToVFS("DejaVuSans-Bold.ttf", DejaVuSansBoldBase64);
    doc.addFont("DejaVuSans.ttf", "DejaVu", "normal");
    doc.addFont("DejaVuSans-Bold.ttf", "DejaVu", "bold");
}
// Helper for page breaks (same as pdfGenerator.js)
function checkPageBreak(doc, currentY, requiredSpace = 30) {
    if (currentY + requiredSpace > 275) {
        doc.addPage();
        return 22;
    }
    return currentY;
}

// Helper to draw section header
function drawSectionHeader(doc, title, y, iconChar = '■') {
    y = checkPageBreak(doc, y, 16);
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(14, y, 182, 8, 1.5, 1.5, 'F');
    doc.setFontSize(10.5);
    doc.setFont("DejaVu", 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(`${iconChar}  ${title.toUpperCase()}`, 18, y + 5.6);
    return y + 13;
}

// ------------------------------------------------------------
// Grammar Guide PDF (returns Buffer)
// ------------------------------------------------------------
export function generateGrammarGuidePdfBuffer(guide) {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' }); registerUnicodeFonts(doc);

    // Top Dark Header
    doc.setFillColor(30, 41, 59);
    doc.rect(0, 0, 210, 42, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(17);
    doc.setFont("DejaVu", 'bold');
    doc.text('SpeakBot Master Grammar Study Guide', 14, 16);
    doc.setFontSize(9.5);
    doc.setFont("DejaVu", 'normal');
    doc.setTextColor(148, 163, 184);
    doc.text(`CEFR Level: ${guide.level || 'B2'}  •  Category: ${guide.category || 'Grammar'}  •  Total Rules: ${guide.coreRules?.length || 3}`, 14, 25);

    let y = 50;
    // Title
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(14);
    doc.setFont("DejaVu", 'bold');
    const titleLines = doc.splitTextToSize(guide.title || 'Grammar Study Guide', 182);
    doc.text(titleLines, 14, y);
    y += titleLines.length * 6 + 4;

    // Summary
    y = drawSectionHeader(doc, 'Grammar Guide Objective', y, '*');
    doc.setFontSize(9);
    doc.setFont("DejaVu", 'normal');
    doc.setTextColor(51, 65, 85);
    const summaryLines = doc.splitTextToSize(guide.summary || '', 180);
    doc.text(summaryLines, 16, y);
    y += summaryLines.length * 4.8 + 8;

    // Core Rules (simplified)
    y = drawSectionHeader(doc, `Core Syntactic Rules (${guide.coreRules?.length || 0})`, y, '-');
    (guide.coreRules || []).forEach((rule, idx) => {
        const ruleLines = doc.splitTextToSize(rule.ruleTitle || 'Rule', 170);
        y = checkPageBreak(doc, y, 20);
        doc.setFontSize(9.5);
        doc.setFont("DejaVu", 'bold');
        doc.setTextColor(15, 23, 42);
        doc.text(`Rule ${idx + 1}: ${rule.ruleTitle}`, 14, y);
        y += 6;
        if (rule.explanationInMediator) {
            const expLines = doc.splitTextToSize(rule.explanationInMediator, 170);
            doc.setFontSize(8.5);
            doc.setFont("DejaVu", 'normal');
            doc.setTextColor(51, 65, 85);
            doc.text(expLines, 14, y);
            y += expLines.length * 4.5 + 2;
        }
        if (rule.formula) {
            doc.setFontSize(8);
            doc.setFont("DejaVu", 'bold');
            doc.setTextColor(79, 70, 229);
            doc.text(rule.formula, 14, y);
            y += 6;
        }
        if (rule.example) {
            doc.setFontSize(8.5);
            doc.setFont("DejaVu", 'normal');
            doc.setTextColor(15, 23, 42);
            doc.text(rule.example, 14, y);
            y += 5;
        }
        y += 4;
    });

    // Exercises (simplified)
    if (guide.practiceExercises?.length) {
        y = drawSectionHeader(doc, `Practice Exercises (${guide.practiceExercises.length})`, y, '+');
        guide.practiceExercises.forEach((ex, i) => {
            const qLines = doc.splitTextToSize(ex.question || '', 170);
            y = checkPageBreak(doc, y, 20);
            doc.setFontSize(9);
            doc.setFont("DejaVu", 'bold');
            doc.setTextColor(15, 23, 42);
            doc.text(`Exercise ${i + 1}: ${ex.question}`, 14, y);
            y += 6;
            ex.options?.forEach((opt, oi) => {
                doc.setFontSize(8.5);
                doc.setFont("DejaVu", 'normal');
                doc.setTextColor(100, 116, 139);
                doc.text(`${String.fromCharCode(65 + oi)}. ${opt}`, 20, y);
                y += 5;
            });
            y += 4;
        });
    }

    // Footer
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setDrawColor(226, 232, 240);
        doc.line(14, 283, 196, 283);
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text('SpeakBot Master Grammar Engine  •  Telegram: @SpeakBot', 14, 288);
        doc.text(`Page ${i} of ${totalPages}`, 176, 288);
    }

    return doc.output('arraybuffer');
}

// ------------------------------------------------------------
// Roadmap PDF (returns Buffer)
// ------------------------------------------------------------
export function generateRoadmapPdfBuffer(roadmap) {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' }); registerUnicodeFonts(doc);
    // Header, summary, milestones, checkpoints (similar approach, simplified)
    // For brevity, we implement essential parts.
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, 210, 42, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(17);
    doc.setFont("DejaVu", 'bold');
    doc.text('SpeakBot Linguistic Roadmap & Study Blueprint', 14, 16);
    doc.setFontSize(9.5);
    doc.setTextColor(148, 163, 184);
    doc.text(`CEFR Level: ${roadmap.level || 'B1'}  •  Estimated Duration: ${roadmap.estimatedDuration || '2-3 Weeks'}`, 14, 25);

    let y = 50;
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(14);
    doc.setFont("DejaVu", 'bold');
    const titleLines = doc.splitTextToSize(roadmap.title || 'Curriculum Roadmap', 182);
    doc.text(titleLines, 14, y);
    y += titleLines.length * 6 + 4;

    y = drawSectionHeader(doc, 'Curriculum Overview', y, '*');
    doc.setFontSize(9);
    doc.setTextColor(51, 65, 85);
    const summaryLines = doc.splitTextToSize(roadmap.summary || '', 180);
    doc.text(summaryLines, 16, y);
    y += summaryLines.length * 4.8 + 8;

    y = drawSectionHeader(doc, `Milestones (${roadmap.milestones?.length || 0})`, y, '-');
    roadmap.milestones?.forEach((m, i) => {
        y = checkPageBreak(doc, y, 30);
        doc.setFontSize(10);
        doc.setFont("DejaVu", 'bold');
        doc.setTextColor(15, 23, 42);
        doc.text(`${i + 1}. ${m.title}`, 14, y);
        y += 6;
        if (m.description) {
            doc.setFontSize(8.5);
            doc.setFont("DejaVu", 'normal');
            doc.setTextColor(71, 85, 105);
            const descLines = doc.splitTextToSize(m.description, 170);
            doc.text(descLines, 14, y);
            y += descLines.length * 4.5 + 2;
        }
        y += 4;
    });

    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setDrawColor(226, 232, 240);
        doc.line(14, 283, 196, 283);
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text('SpeakBot Linguistic Engine  •  Telegram: @SpeakBot', 14, 288);
        doc.text(`Page ${i} of ${totalPages}`, 176, 288);
    }

    return doc.output('arraybuffer');
}

// ------------------------------------------------------------
// Vocabulary PDF (returns Buffer)
// ------------------------------------------------------------
export function generateVocabularyPdfBuffer(vocabularyList, targetLanguage) {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' }); registerUnicodeFonts(doc);
    // Header
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(17);
    doc.setFont("DejaVu", 'bold');
    doc.text('SpeakBot Personal Lexicon & Vocabulary Notebook', 14, 16);
    doc.setFontSize(9.5);
    doc.setTextColor(148, 163, 184);
    doc.text(`Target Language: ${targetLanguage}  •  Total Saved Terms: ${vocabularyList.length}`, 14, 25);

    let y = 50;
    vocabularyList.forEach((item, i) => {
        y = checkPageBreak(doc, y, 20);
        doc.setFontSize(10.5);
        doc.setFont("DejaVu", 'bold');
        doc.setTextColor(15, 23, 42);
        doc.text(`${i + 1}. ${item.word}`, 14, y);
        y += 6;
        if (item.translation) {
            doc.setFontSize(8.5);
            doc.setFont("DejaVu", 'normal');
            doc.setTextColor(51, 65, 85);
            doc.text(`Meaning: ${item.translation}`, 14, y);
            y += 5;
        }
        if (item.example) {
            doc.setFontSize(8);
            doc.setFont("DejaVu", 'normal');
            doc.setTextColor(100, 116, 139);
            doc.text(`Example: ${item.example}`, 14, y);
            y += 5;
        }
        y += 3;
    });

    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setDrawColor(226, 232, 240);
        doc.line(14, 283, 196, 283);
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text('SpeakBot Personal Lexical Engine  •  Telegram: @SpeakBot', 14, 288);
        doc.text(`Page ${i} of ${totalPages}`, 176, 288);
    }

    return doc.output('arraybuffer');
}

// ------------------------------------------------------------
// Classic Story PDF (returns Buffer)
// ------------------------------------------------------------
export function generateClassicStoryPdfBuffer(story) {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' }); registerUnicodeFonts(doc);
    // Header
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, 210, 42, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(17);
    doc.setFont("DejaVu", 'bold');
    doc.text('SpeakBot Classical Literature & Audio Theater', 14, 16);
    doc.setFontSize(9.5);
    doc.setTextColor(148, 163, 184);
    doc.text(`Author: ${story.author || 'Classic Master'} (${story.authorEra || ''})  •  CEFR: ${story.level || 'B2'}`, 14, 25);

    let y = 50;
    // Story title
    doc.setFontSize(14);
    doc.setFont("DejaVu", 'bold');
    doc.setTextColor(15, 23, 42);
    const titleLines = doc.splitTextToSize(story.title || 'Classic Story', 182);
    doc.text(titleLines, 14, y);
    y += titleLines.length * 6 + 4;

    // Story text
    y = drawSectionHeader(doc, 'Story Text', y, '[TEXT]');
    doc.setFontSize(9.5);
    doc.setFont("DejaVu", 'normal');
    doc.setTextColor(15, 23, 42);
    const paragraphs = (story.paragraphs || []).join('\n\n');
    const textLines = doc.splitTextToSize(paragraphs, 180);
    doc.text(textLines, 16, y);
    y += textLines.length * 5 + 4;

    // Exercises (simple)
    if (story.exercises?.length) {
        y = drawSectionHeader(doc, `Exercises (${story.exercises.length})`, y, '+');
        story.exercises.forEach((ex, i) => {
            y = checkPageBreak(doc, y, 20);
            doc.setFontSize(9);
            doc.setFont("DejaVu", 'bold');
            doc.setTextColor(15, 23, 42);
            doc.text(`${i + 1}. ${ex.question}`, 14, y);
            y += 6;
            ex.options?.forEach((opt, oi) => {
                doc.setFontSize(8.5);
                doc.setFont("DejaVu", 'normal');
                doc.setTextColor(71, 85, 105);
                doc.text(`${String.fromCharCode(65 + oi)}. ${opt}`, 20, y);
                y += 5;
            });
            y += 4;
        });
    }

    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setDrawColor(226, 232, 240);
        doc.line(14, 283, 196, 283);
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text('SpeakBot Classical Literature Engine  •  Telegram: @SpeakBot', 14, 288);
        doc.text(`Page ${i} of ${totalPages}`, 176, 288);
    }

    return doc.output('arraybuffer');
}
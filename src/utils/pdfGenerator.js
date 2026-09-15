import { jsPDF } from 'jspdf';
import DejaVuSansBase64 from "./fonts/ttf/DejaVuSans.base64.js";
import DejaVuSansBoldBase64 from "./fonts/ttf/DejaVuSans-Bold.base64.js";

// ─── Diagnostic: warn ONCE if font base64 is missing/broken ───
let _fontsDiagDone = false;
function _checkFonts() {
  if (_fontsDiagDone) return;
  _fontsDiagDone = true;
  console.log('[PDF] DejaVuSansBase64 type:', typeof DejaVuSansBase64, 'length:', DejaVuSansBase64?.length);
  console.log('[PDF] DejaVuSansBoldBase64 type:', typeof DejaVuSansBoldBase64, 'length:', DejaVuSansBoldBase64?.length);
  if (!DejaVuSansBase64 || typeof DejaVuSansBase64 !== 'string' || DejaVuSansBase64.length < 1000) {
    console.error('[PDF] ⚠️ DejaVuSans.base64.js is empty or missing — Unicode text will not render correctly.');
  }
  if (!DejaVuSansBoldBase64 || typeof DejaVuSansBoldBase64 !== 'string' || DejaVuSansBoldBase64.length < 1000) {
    console.error('[PDF] ⚠️ DejaVuSans-Bold.base64.js is empty or missing.');
  }
}

// ─── Register unicode fonts with graceful fallback ───
// Returns true if DejaVu was registered, false if we fell back to Helvetica.
function registerUnicodeFonts(doc) {
  _checkFonts();
  try {
    const normalOK = DejaVuSansBase64 && typeof DejaVuSansBase64 === 'string' && DejaVuSansBase64.length > 1000;
    const boldOK = DejaVuSansBoldBase64 && typeof DejaVuSansBoldBase64 === 'string' && DejaVuSansBoldBase64.length > 1000;

    if (!normalOK || !boldOK) {
      console.warn('[PDF] Falling back to Helvetica (Latin-1 only).');
      return false;
    }

    doc.addFileToVFS("DejaVuSans.ttf", DejaVuSansBase64);
    doc.addFileToVFS("DejaVuSans-Bold.ttf", DejaVuSansBoldBase64);
    doc.addFont("DejaVuSans.ttf", "DejaVu", "normal");
    doc.addFont("DejaVuSans-Bold.ttf", "DejaVu", "bold");
    return true;
  } catch (e) {
    console.error('[PDF] registerUnicodeFonts failed:', e);
    return false;
  }
}

// ─── Safe download — bypasses browser quirks with doc.save() ───
function _safeDownload(doc, filename) {
  try {
    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 1000);
    console.log('[PDF] _safeDownload triggered:', filename);
  } catch (e) {
    console.error('[PDF] _safeDownload blob approach failed, trying doc.save():', e);
    try {
      doc.save(filename);
    } catch (e2) {
      console.error('[PDF] doc.save() also failed:', e2);
      alert(`Не удалось скачать PDF: ${e2.message}`);
    }
  }
}
// Helper function to safely add a new page with header reset
function checkPageBreak(doc, currentY, requiredSpace = 30) {
  if (currentY + requiredSpace > 275) {
    doc.addPage();
    return 22;
  }
  return currentY;
}

// Helper to draw clean section header
function drawSectionHeader(doc, title, y, iconChar = '■') {
  y = checkPageBreak(doc, y, 16);
  doc.setFillColor(241, 245, 249); // slate-100
  doc.roundedRect(14, y, 182, 8, 1.5, 1.5, 'F');
  doc.setFontSize(10.5);
  doc.setFont("DejaVu", 'bold');
  doc.setTextColor(15, 23, 42); // slate-900
  doc.text(`${iconChar}  ${title.toUpperCase()}`, 18, y + 5.6);
  return y + 13;
}

/**
 * Export complete, rich Roadmap to PDF matching the exact contents shown on the app page
 */
export function exportRoadmapToPdf(roadmap) {
  const t0 = Date.now();
  try {
    console.log('[PDF] exportRoadmapToPdf: start', roadmap?.title);

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const usedDejaVu = registerUnicodeFonts(doc);
    const bodyFont = usedDejaVu ? 'DejaVu' : 'Helvetica';

    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, 210, 42, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(17);
    doc.setFont(bodyFont, 'bold');
    doc.text('SpeakBot Linguistic Roadmap & Study Blueprint', 14, 16);

    doc.setFontSize(9.5);
    doc.setFont(bodyFont, 'normal');
    doc.setTextColor(148, 163, 184);
    doc.text(
      `CEFR Level: ${roadmap.level || 'B1'}  •  Category: ${roadmap.category || 'Grammar'}  •  Estimated Duration: ${roadmap.estimatedDuration || '2-3 Weeks'}`,
      14, 25
    );

    if (roadmap.tags && roadmap.tags.length > 0) {
      doc.setFontSize(8.5);
      doc.setTextColor(56, 189, 248);
      doc.text(`Tags: ${roadmap.tags.map((t) => `#${t}`).join('   ')}`, 14, 33);
    }

    let y = 50;
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(14);
    doc.setFont(bodyFont, 'bold');
    const titleLines = doc.splitTextToSize(roadmap.title || 'Curriculum Roadmap', 182);
    doc.text(titleLines, 14, y);
    y += titleLines.length * 6 + 2;

    if (roadmap.isGrammarPersonalized && roadmap.personalizedGrammarMeta) {
      y = checkPageBreak(doc, y, 16);
      doc.setFillColor(240, 249, 255);
      doc.setDrawColor(56, 189, 248);
      doc.roundedRect(14, y, 182, 11, 2, 2, 'FD');
      doc.setFontSize(8.5);
      doc.setFont(bodyFont, 'bold');
      doc.setTextColor(3, 105, 161);
      doc.text(
        `PERSONALIZED TEST RECOVERY BLUEPRINT  •  Diagnostic Score: ${roadmap.personalizedGrammarMeta.grammarScore || 70}%  •  Target: ${roadmap.personalizedGrammarMeta.targetSkillDelta || '+30% Boost'}`,
        18, y + 7
      );
      y += 16;
    }

    y = drawSectionHeader(doc, 'Curriculum Overview & Educational Objective', y, '*');
    doc.setFontSize(9.5);
    doc.setFont(bodyFont, 'normal');
    doc.setTextColor(51, 65, 85);
    const summaryLines = doc.splitTextToSize(roadmap.summary || '', 180);
    doc.text(summaryLines, 16, y);
    y += summaryLines.length * 5 + 8;

    y = drawSectionHeader(doc, `Curriculum Milestones (${roadmap.milestones?.length || 0} Progression Steps)`, y, '-');

    (roadmap.milestones || []).forEach((m, mIdx) => {
      const descLines = m.description ? doc.splitTextToSize(m.description, 178) : [];
      const ruleLines = m.grammarPoint ? doc.splitTextToSize(m.grammarPoint, 138) : [];
      const sampleLines = m.sampleSentence ? doc.splitTextToSize(`"${m.sampleSentence}"`, 142) : [];
      const tokenCount = m.tokens?.length || 0;
      const estSpace = 20 + descLines.length * 4.5 + (ruleLines.length ? ruleLines.length * 4.5 + 8 : 0) + (sampleLines.length ? sampleLines.length * 4.5 + 6 : 0) + (tokenCount ? tokenCount * 6 + 14 : 0);

      y = checkPageBreak(doc, y, Math.min(estSpace, 50));

      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(14, y, 182, 9, 1.5, 1.5, 'FD');

      doc.setFillColor(14, 165, 233);
      doc.circle(20, y + 4.5, 3.2, 'F');
      doc.setFontSize(8);
      doc.setFont(bodyFont, 'bold');
      doc.setTextColor(255, 255, 255);
      doc.text(String(m.step || mIdx + 1), 18.9, y + 5.7);

      doc.setFontSize(10);
      doc.setFont(bodyFont, 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(`Step ${m.step || mIdx + 1}: ${m.title}`, 26, y + 6);
      y += 13;

      if (descLines.length > 0) {
        doc.setFontSize(8.5);
        doc.setFont(bodyFont, 'normal');
        doc.setTextColor(71, 85, 105);
        doc.text(descLines, 16, y);
        y += descLines.length * 4.5 + 3;
      }

      if (ruleLines.length > 0) {
        const boxHeight = Math.max(9, ruleLines.length * 4.5 + 4);
        y = checkPageBreak(doc, y, boxHeight + 3);
        doc.setFillColor(240, 249, 255);
        doc.setDrawColor(186, 230, 253);
        doc.roundedRect(16, y, 178, boxHeight, 1, 1, 'FD');
        doc.setFontSize(8);
        doc.setFont(bodyFont, 'bold');
        doc.setTextColor(2, 132, 199);
        doc.text('Syntactic Rule:', 20, y + 5.5);
        doc.setFont(bodyFont, 'normal');
        doc.setTextColor(15, 23, 42);
        doc.text(ruleLines, 48, y + 5.5);
        y += boxHeight + 4;
      }

      if (sampleLines.length > 0) {
        y = checkPageBreak(doc, y, sampleLines.length * 4.5 + 6);
        doc.setFontSize(8.5);
        doc.setFont(bodyFont, 'bold');
        doc.setTextColor(30, 41, 59);
        doc.text('Target Exemplar:', 16, y);
        doc.setFont(bodyFont, 'normal');
        doc.setTextColor(15, 23, 42);
        doc.text(sampleLines, 46, y);
        y += sampleLines.length * 4.5 + 4;
      }

      if (m.tokens && m.tokens.length > 0) {
        y = checkPageBreak(doc, y, 18);
        doc.setFontSize(8);
        doc.setFont(bodyFont, 'bold');
        doc.setTextColor(100, 116, 139);
        doc.text('Linguistic Token Breakdown:', 16, y);
        y += 4;

        doc.setFillColor(226, 232, 240);
        doc.rect(16, y, 178, 6, 'F');
        doc.setFontSize(7.5);
        doc.setFont(bodyFont, 'bold');
        doc.setTextColor(51, 65, 85);
        doc.text('Token', 18, y + 4.2);
        doc.text('Lemma', 50, y + 4.2);
        doc.text('POS', 78, y + 4.2);
        doc.text('Syntax Role', 98, y + 4.2);
        doc.text('CEFR', 132, y + 4.2);
        doc.text('Mediator Meaning', 148, y + 4.2);
        y += 6;

        m.tokens.forEach((tok, tIdx) => {
          y = checkPageBreak(doc, y, 7);
          if (tIdx % 2 === 1) {
            doc.setFillColor(248, 250, 252);
            doc.rect(16, y, 178, 6, 'F');
          }
          doc.setFontSize(7.5);
          doc.setFont(bodyFont, 'bold');
          doc.setTextColor(15, 23, 42);
          doc.text(tok.text || '', 18, y + 4.2);

          doc.setFont(bodyFont, 'normal');
          doc.setTextColor(71, 85, 105);
          doc.text(tok.lemma || tok.text || '', 50, y + 4.2);
          doc.text(tok.pos || 'NOUN', 78, y + 4.2);
          doc.text(tok.syntaxRole || 'Constituent', 98, y + 4.2);

          doc.setFont(bodyFont, 'bold');
          doc.setTextColor(14, 165, 233);
          doc.text(tok.cefrLevel || 'B1', 132, y + 4.2);

          doc.setFont(bodyFont, 'normal');
          doc.setTextColor(51, 65, 85);
          const transLines = doc.splitTextToSize(tok.mediatorTranslation || tok.definition || '', 42);
          doc.text(transLines[0] || '', 148, y + 4.2);

          y += 6;
        });
        y += 4;
      }

      y += 5;
    });

    if (roadmap.checkpointQuestions && roadmap.checkpointQuestions.length > 0) {
      y = drawSectionHeader(doc, `Checkpoint Diagnostic Assessment (${roadmap.checkpointQuestions.length} Questions)`, y, '+');

      roadmap.checkpointQuestions.forEach((q, qIdx) => {
        const qLines = doc.splitTextToSize(`Question ${qIdx + 1}: ${q.question}`, 174);
        const expLines = q.explanation ? doc.splitTextToSize(q.explanation, 130) : [];
        const qHeight = 10 + qLines.length * 5 + (q.options?.length || 0) * 8 + (expLines.length ? expLines.length * 4.5 + 10 : 0);

        y = checkPageBreak(doc, y, Math.min(qHeight, 55));

        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(203, 213, 225);
        const headerBoxHeight = Math.max(8, qLines.length * 5 + 3);
        doc.roundedRect(14, y, 182, headerBoxHeight, 1, 1, 'FD');

        doc.setFontSize(8.5);
        doc.setFont(bodyFont, 'bold');
        doc.setTextColor(15, 23, 42);
        doc.text(qLines, 17, y + 5);
        y += headerBoxHeight + 4;

        (q.options || []).forEach((opt, oIdx) => {
          y = checkPageBreak(doc, y, 8);
          const isCorrect = oIdx === q.correctIndex;
          const letter = String.fromCharCode(65 + oIdx);
          const optLines = doc.splitTextToSize(opt, 140);
          const optBoxHeight = Math.max(6.5, optLines.length * 4 + 2.5);

          if (isCorrect) {
            doc.setFillColor(236, 253, 245);
            doc.setDrawColor(52, 211, 153);
            doc.roundedRect(18, y, 174, optBoxHeight, 1, 1, 'FD');
            doc.setFontSize(8);
            doc.setFont(bodyFont, 'bold');
            doc.setTextColor(5, 150, 105);
            doc.text(`[OK] (${letter})`, 22, y + 4.5);
            doc.text(optLines, 34, y + 4.5);
          } else {
            doc.setFillColor(255, 255, 255);
            doc.setDrawColor(226, 232, 240);
            doc.roundedRect(18, y, 174, optBoxHeight, 1, 1, 'FD');
            doc.setFontSize(8);
            doc.setFont(bodyFont, 'normal');
            doc.setTextColor(100, 116, 139);
            doc.text(`( ${letter} )`, 22, y + 4.5);
            doc.text(optLines, 34, y + 4.5);
          }
          y += optBoxHeight + 1.5;
        });

        if (expLines.length > 0) {
          const expBoxHeight = Math.max(9, expLines.length * 4.5 + 4);
          y = checkPageBreak(doc, y, expBoxHeight + 4);
          doc.setFillColor(240, 253, 244);
          doc.setDrawColor(187, 247, 208);
          doc.roundedRect(18, y, 174, expBoxHeight, 1, 1, 'FD');
          doc.setFontSize(8);
          doc.setFont(bodyFont, 'bold');
          doc.setTextColor(22, 101, 52);
          doc.text('Linguistic Analysis:', 22, y + 5);
          doc.setFont(bodyFont, 'normal');
          doc.setTextColor(51, 65, 85);
          doc.text(expLines, 54, y + 5);
          y += expBoxHeight + 4;
        }
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
      doc.text('SpeakBot Universal Language Learning Engine  •  Telegram: @SpeakBot', 14, 288);
      doc.text(`Page ${i} of ${totalPages}`, 176, 288);
    }

    const cleanName = (roadmap.title || 'roadmap').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const filename = `${cleanName}-comprehensive-roadmap.pdf`;
    console.log(`[PDF] exportRoadmapToPdf: built in ${Date.now() - t0}ms → ${filename}`);
    _safeDownload(doc, filename);
  } catch (err) {
    console.error('[PDF] exportRoadmapToPdf FAILED:', err);
    alert(`Не удалось сгенерировать PDF roadmap.\n\n${err.message}`);
  }
}

export function exportGrammarGuideToPdf(guide) {
  const t0 = Date.now();
  try {
    console.log('[PDF] exportGrammarGuideToPdf: start', guide?.title);

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const usedDejaVu = registerUnicodeFonts(doc);
    const bodyFont = usedDejaVu ? 'DejaVu' : 'Helvetica';

    doc.setFillColor(30, 41, 59);
    doc.rect(0, 0, 210, 42, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(17);
    doc.setFont(bodyFont, 'bold');
    doc.text('SpeakBot Master Grammar Study Guide', 14, 16);

    doc.setFontSize(9.5);
    doc.setFont(bodyFont, 'normal');
    doc.setTextColor(148, 163, 184);
    doc.text(
      `CEFR Level: ${guide.level || 'B2'}  •  Category: ${guide.category || 'Grammar'}  •  Total Rules: ${guide.coreRules?.length || 3}`,
      14, 25
    );

    if (guide.tags && guide.tags.length > 0) {
      doc.setFontSize(8.5);
      doc.setTextColor(129, 140, 248);
      doc.text(`Topics: ${guide.tags.map((t) => `#${t}`).join('   ')}`, 14, 33);
    }

    let y = 50;
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(14);
    doc.setFont(bodyFont, 'bold');
    const titleLines = doc.splitTextToSize(guide.title || 'Grammar Study Guide', 182);
    doc.text(titleLines, 14, y);
    y += titleLines.length * 6 + 4;

    y = drawSectionHeader(doc, 'Grammar Guide Objective & CEFR Summary', y, '*');
    doc.setFontSize(9);
    doc.setFont(bodyFont, 'normal');
    doc.setTextColor(51, 65, 85);
    const summaryLines = doc.splitTextToSize(guide.summary || '', 180);
    doc.text(summaryLines, 16, y);
    y += summaryLines.length * 4.8 + 8;

    y = drawSectionHeader(doc, `Core Syntactic Rules (${guide.coreRules?.length || 0} Principles)`, y, '-');

    (guide.coreRules || []).forEach((rule, rIdx) => {
      const expLines = rule.explanationInMediator ? doc.splitTextToSize(rule.explanationInMediator, 134) : [];
      const formulaLines = rule.formula ? doc.splitTextToSize(rule.formula, 140) : [];
      const exLines = rule.example ? doc.splitTextToSize(`"${rule.example}"`, 138) : [];
      const tokenCount = rule.tokens?.length || 0;

      y = checkPageBreak(doc, y, 40);

      doc.setFillColor(241, 245, 249);
      doc.setDrawColor(203, 213, 225);
      doc.roundedRect(14, y, 182, 8, 1, 1, 'FD');

      doc.setFontSize(9.5);
      doc.setFont(bodyFont, 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(`Rule ${rIdx + 1}: ${rule.ruleTitle}`, 18, y + 5.5);
      y += 11;

      if (expLines.length > 0) {
        const expBoxHeight = Math.max(9, expLines.length * 4.5 + 4);
        y = checkPageBreak(doc, y, expBoxHeight + 3);
        doc.setFillColor(240, 253, 250);
        doc.setDrawColor(94, 234, 212);
        doc.roundedRect(16, y, 178, expBoxHeight, 1, 1, 'FD');
        doc.setFontSize(8);
        doc.setFont(bodyFont, 'bold');
        doc.setTextColor(13, 148, 136);
        doc.text('Native Explanation:', 20, y + 5.2);
        doc.setFont(bodyFont, 'normal');
        doc.setTextColor(15, 23, 42);
        doc.text(expLines, 54, y + 5.2);
        y += expBoxHeight + 3;
      }

      if (formulaLines.length > 0) {
        const formBoxHeight = Math.max(8.5, formulaLines.length * 4.5 + 3.5);
        y = checkPageBreak(doc, y, formBoxHeight + 3);
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(148, 163, 184);
        doc.roundedRect(16, y, 178, formBoxHeight, 1, 1, 'FD');
        doc.setFontSize(8);
        doc.setFont(bodyFont, 'bold');
        doc.setTextColor(79, 70, 229);
        doc.text('Formula:', 20, y + 5.2);
        doc.setFont(bodyFont, 'bold');
        doc.setTextColor(15, 23, 42);
        doc.text(formulaLines, 38, y + 5.2);
        y += formBoxHeight + 3;
      }

      if (exLines.length > 0) {
        y = checkPageBreak(doc, y, exLines.length * 4.5 + 6);
        doc.setFont(bodyFont, 'bold');
        doc.setFontSize(8);
        doc.setTextColor(30, 41, 59);
        doc.text('Standard Example:', 16, y);
        doc.setFont(bodyFont, 'normal');
        doc.setTextColor(15, 23, 42);
        doc.text(exLines, 48, y);
        y += exLines.length * 4.5 + 4;
      }

      if (tokenCount > 0) {
        y = checkPageBreak(doc, y, 16);
        doc.setFont(bodyFont, 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(100, 116, 139);
        doc.text('Syntax & Token Mapping:', 16, y);
        y += 3.5;

        rule.tokens.forEach((tok) => {
          const tokDesc = `[${tok.pos || 'POS'}] Role: ${tok.syntaxRole || 'Constituent'} | CEFR: ${tok.cefrLevel || 'B1'}${tok.ipa ? ` | IPA: ${tok.ipa}` : ''} | Meaning: ${tok.mediatorTranslation || ''}`;
          const tokLines = doc.splitTextToSize(tokDesc, 140);
          const tokRowHeight = Math.max(5.5, tokLines.length * 4 + 1.5);

          y = checkPageBreak(doc, y, tokRowHeight + 2);
          doc.setFont(bodyFont, 'bold');
          doc.setFontSize(7.5);
          doc.setTextColor(15, 23, 42);
          doc.text(`• ${tok.text}`, 18, y + 3.8);
          doc.setFont(bodyFont, 'normal');
          doc.setTextColor(71, 85, 105);
          doc.text(tokLines, 42, y + 3.8);
          y += tokRowHeight + 1.5;
        });
        y += 3;
      }

      y += 5;
    });

    if (guide.commonMistakes && guide.commonMistakes.length > 0) {
      y = drawSectionHeader(doc, `Frequent Pitfalls & Native Interference (${guide.commonMistakes.length} Crucial Traps)`, y, '!');

      guide.commonMistakes.forEach((m) => {
        const incLines = doc.splitTextToSize(m.incorrect || '', 136);
        const corLines = doc.splitTextToSize(m.correct || '', 136);
        const reasonLines = doc.splitTextToSize(m.reason || '', 136);
        const cardHeight = Math.max(22, 10 + (incLines.length + corLines.length + reasonLines.length) * 4.5);

        y = checkPageBreak(doc, y, cardHeight + 4);

        doc.setFillColor(255, 241, 242);
        doc.setDrawColor(254, 205, 211);
        doc.roundedRect(14, y, 182, cardHeight, 1.5, 1.5, 'FD');

        let innerY = y + 5;

        doc.setFontSize(8);
        doc.setFont(bodyFont, 'bold');
        doc.setTextColor(225, 29, 72);
        doc.text('[X] Incorrect:', 18, innerY);
        doc.setFont(bodyFont, 'normal');
        doc.setTextColor(15, 23, 42);
        doc.text(incLines, 42, innerY);
        innerY += incLines.length * 4.5 + 2;

        doc.setFont(bodyFont, 'bold');
        doc.setTextColor(13, 148, 136);
        doc.text('[OK] Correct:', 18, innerY);
        doc.setFont(bodyFont, 'normal');
        doc.setTextColor(15, 23, 42);
        doc.text(corLines, 42, innerY);
        innerY += corLines.length * 4.5 + 2;

        doc.setFont(bodyFont, 'bold');
        doc.setTextColor(100, 116, 139);
        doc.text('Reason:', 18, innerY);
        doc.setFont(bodyFont, 'normal');
        doc.setTextColor(51, 65, 85);
        doc.text(reasonLines, 42, innerY);

        y += cardHeight + 4;
      });
    }

    if (guide.practiceExercises && guide.practiceExercises.length > 0) {
      y = drawSectionHeader(doc, `Practice Exercises & Syntactic Verification (${guide.practiceExercises.length} Drills)`, y, '+');

      guide.practiceExercises.forEach((ex, exIdx) => {
        const qLines = doc.splitTextToSize(ex.question || '', 174);
        const expLines = ex.explanation ? doc.splitTextToSize(ex.explanation, 132) : [];
        const exEstHeight = 12 + qLines.length * 4.5 + (ex.options?.length || 0) * 8 + (expLines.length ? expLines.length * 4.5 + 8 : 0);

        y = checkPageBreak(doc, y, Math.min(exEstHeight, 55));

        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(203, 213, 225);
        doc.roundedRect(14, y, 182, 8, 1, 1, 'FD');

        doc.setFontSize(8.5);
        doc.setFont(bodyFont, 'bold');
        doc.setTextColor(15, 23, 42);
        doc.text(`Exercise ${exIdx + 1}: ${ex.instruction || 'Choose the grammatically accurate sentence'}`, 17, y + 5.5);
        y += 11;

        doc.setFontSize(8);
        doc.setFont(bodyFont, 'normal');
        doc.setTextColor(51, 65, 85);
        doc.text(qLines, 17, y);
        y += qLines.length * 4.5 + 3;

        (ex.options || []).forEach((opt, oIdx) => {
          y = checkPageBreak(doc, y, 8);
          const isCorrect = oIdx === ex.correctIndex;
          const letter = String.fromCharCode(65 + oIdx);
          const optLines = doc.splitTextToSize(opt, 140);
          const optHeight = Math.max(6.5, optLines.length * 4 + 2.5);

          if (isCorrect) {
            doc.setFillColor(236, 253, 245);
            doc.setDrawColor(52, 211, 153);
            doc.roundedRect(18, y, 174, optHeight, 1, 1, 'FD');
            doc.setFontSize(8);
            doc.setFont(bodyFont, 'bold');
            doc.setTextColor(5, 150, 105);
            doc.text(`[OK] (${letter})`, 22, y + 4.5);
            doc.text(optLines, 34, y + 4.5);
          } else {
            doc.setFillColor(255, 255, 255);
            doc.setDrawColor(226, 232, 240);
            doc.roundedRect(18, y, 174, optHeight, 1, 1, 'FD');
            doc.setFontSize(8);
            doc.setFont(bodyFont, 'normal');
            doc.setTextColor(100, 116, 139);
            doc.text(`( ${letter} )`, 22, y + 4.5);
            doc.text(optLines, 34, y + 4.5);
          }
          y += optHeight + 1.5;
        });

        if (expLines.length > 0) {
          const expBoxHeight = Math.max(9, expLines.length * 4.5 + 4);
          y = checkPageBreak(doc, y, expBoxHeight + 4);
          doc.setFillColor(240, 253, 244);
          doc.setDrawColor(187, 247, 208);
          doc.roundedRect(18, y, 174, expBoxHeight, 1, 1, 'FD');
          doc.setFontSize(8);
          doc.setFont(bodyFont, 'bold');
          doc.setTextColor(22, 101, 52);
          doc.text('Key Explanation:', 22, y + 5);
          doc.setFont(bodyFont, 'normal');
          doc.setTextColor(51, 65, 85);
          doc.text(expLines, 52, y + 5);
          y += expBoxHeight + 4;
        }
        y += 4;
      });
    }

    if (guide.keyVocabulary && guide.keyVocabulary.length > 0) {
      y = drawSectionHeader(doc, `Mastery Vocabulary & Lexicon (${guide.keyVocabulary.length} Target Terms)`, y, '*');

      y = checkPageBreak(doc, y, 12);
      doc.setFillColor(241, 245, 249);
      doc.rect(14, y, 182, 7, 'F');
      doc.setFontSize(8);
      doc.setFont(bodyFont, 'bold');
      doc.setTextColor(30, 41, 59);
      doc.text('Term / Lemma', 18, y + 4.8);
      doc.text('Part of Speech', 56, y + 4.8);
      doc.text('IPA Phonetics', 78, y + 4.8);
      doc.text('Context Meaning / Translation', 106, y + 4.8);
      y += 8;

      guide.keyVocabulary.forEach((term, tIdx) => {
        const termName = term.word || term.lemma || '';
        const pos = term.pos || term.partOfSpeech || 'noun';
        const ipa = term.ipa || '';
        const meaning = term.translation || term.meaning || term.definition || '';

        const meaningLines = doc.splitTextToSize(meaning, 86);
        const rowHeight = Math.max(7, meaningLines.length * 4 + 3);

        y = checkPageBreak(doc, y, rowHeight + 1);

        if (tIdx % 2 === 1) {
          doc.setFillColor(248, 250, 252);
          doc.rect(14, y, 182, rowHeight, 'F');
        }

        doc.setDrawColor(241, 245, 249);
        doc.line(14, y + rowHeight, 196, y + rowHeight);

        doc.setFontSize(8);
        doc.setFont(bodyFont, 'bold');
        doc.setTextColor(14, 116, 144);
        doc.text(termName, 18, y + 4.5);

        doc.setFont(bodyFont, 'normal');
        doc.setTextColor(71, 85, 105);
        doc.text(pos, 56, y + 4.5);
        doc.text(ipa, 78, y + 4.5);
        doc.text(meaningLines, 106, y + 4.5);

        y += rowHeight;
      });
      y += 5;
    }

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

    const cleanName = (guide.title || 'grammar-guide').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const filename = `${cleanName}-comprehensive-study-guide.pdf`;
    console.log(`[PDF] exportGrammarGuideToPdf: built in ${Date.now() - t0}ms → ${filename}`);
    _safeDownload(doc, filename);
  } catch (err) {
    console.error('[PDF] exportGrammarGuideToPdf FAILED:', err);
    alert(`Не удалось сгенерировать PDF grammar guide.\n\n${err.message}`);
  }
}
/**
 * Export saved vocabulary list to a clean, printable PDF study workbook
 */
export function exportVocabularyToPdf(vocabularyList = [], targetLanguage = 'English') {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });
  registerUnicodeFonts(doc);

  // Top Dark Header Banner
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, 210, 40, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(17);
  doc.setFont("DejaVu", 'bold');
  doc.text('SpeakBot Personal Lexicon & Vocabulary Notebook', 14, 16);

  doc.setFontSize(9.5);
  doc.setFont("DejaVu", 'normal');
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text(
    `Target Language: ${targetLanguage}  •  Total Saved Terms: ${vocabularyList.length}  •  Generated: ${new Date().toLocaleDateString()}`,
    14,
    25
  );

  doc.setFontSize(8);
  doc.setTextColor(56, 189, 248); // sky-400
  doc.text('Master your personal vocabulary through active recall, games, and spaced repetition.', 14, 32);

  let y = 48;

  if (!vocabularyList || vocabularyList.length === 0) {
    doc.setFontSize(11);
    doc.setFont("DejaVu", 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text('No words saved in your notebook yet. Play games or read classic stories to save terms!', 14, y);
  } else {
    vocabularyList.forEach((item, index) => {
      const defText = item.definition || item.translation || item.meaning || 'Saved vocabulary term';
      const defLines = doc.splitTextToSize(`Meaning: ${defText}`, 168);
      const exText = item.example || item.sentence ? `e.g. "${item.example || item.sentence}"` : '';
      const exLines = exText ? doc.splitTextToSize(exText, 168) : [];
      const cardHeight = Math.max(20, 10 + defLines.length * 4.5 + (exLines.length ? exLines.length * 4 + 2 : 0));

      y = checkPageBreak(doc, y, cardHeight + 4);

      // Card box
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(14, y, 182, cardHeight, 1.5, 1.5, 'FD');

      // Checkbox square for student tracking
      doc.setDrawColor(148, 163, 184);
      doc.rect(18, y + 4.5, 3.5, 3.5);

      // Word index + Term
      doc.setFontSize(10.5);
      doc.setFont("DejaVu", 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(`${index + 1}.  ${item.word || 'Word'}`, 24, y + 7.5);

      // Part of speech badge
      if (item.partOfSpeech || item.pos) {
        doc.setFillColor(224, 231, 255);
        doc.roundedRect(80, y + 4, 18, 4.5, 1, 1, 'F');
        doc.setFontSize(7.5);
        doc.setFont("DejaVu", 'bold');
        doc.setTextColor(67, 56, 202);
        doc.text((item.partOfSpeech || item.pos).toUpperCase(), 82, y + 7.3);
      }

      // IPA if available
      if (item.ipa) {
        doc.setFontSize(8);
        doc.setFont("DejaVu", 'normal');
        doc.setTextColor(100, 116, 139);
        doc.text(item.ipa, 105, y + 7.5);
      }

      let innerY = y + 13;

      // Definition / Translation (Full multi-line)
      doc.setFontSize(8.5);
      doc.setFont("DejaVu", 'normal');
      doc.setTextColor(51, 65, 85);
      doc.text(defLines, 18, innerY);
      innerY += defLines.length * 4.5;

      // Example sentence
      if (exLines.length > 0) {
        doc.setFontSize(7.5);
        doc.setFont("DejaVu", 'normal');
        doc.setTextColor(100, 116, 139);
        doc.text(exLines, 18, innerY + 1.5);
      }

      y += cardHeight + 4;
    });
  }

  // Footer on Every Page
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

  const cleanLang = (targetLanguage || 'english').toLowerCase().replace(/[^a-z0-9]+/g, '-');
  doc.save(`speakbot-${cleanLang}-saved-vocabulary-notebook.pdf`);
}
/**
 * Export complete Classical Story & Literary Exercise to printable PDF Workbook
 */
export function exportClassicStoryExercisePdf(story) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });
  registerUnicodeFonts(doc);

  // Top Dark Header Banner
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, 210, 42, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(17);
  doc.setFont("DejaVu", 'bold');
  doc.text('SpeakBot Classical Literature & Audio Theater', 14, 16);

  doc.setFontSize(9.5);
  doc.setFont("DejaVu", 'normal');
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text(
    `Author: ${story.author || 'Classic Master'} (${story.authorEra || ''})  •  CEFR: ${story.level || 'B2'}  •  Lang: ${story.targetLanguage || 'English'}`,
    14,
    25
  );

  doc.setFontSize(8);
  doc.setTextColor(52, 211, 153); // emerald-400
  doc.text(`Theme: ${story.theme || 'Literary Masterpiece'}  •  Tone: ${story.audioTone || 'Acoustic Narration'}`, 14, 33);

  let y = 50;

  // Story Title
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(14);
  doc.setFont("DejaVu", 'bold');
  const titleLines = doc.splitTextToSize(story.title || 'Classic Story Exercise', 182);
  doc.text(titleLines, 14, y);
  y += titleLines.length * 6 + 3;

  // Literary Summary
  y = drawSectionHeader(doc, 'Literary Synopsis & Cultural Context', y, '*');
  doc.setFontSize(9);
  doc.setFont("DejaVu", 'normal');
  doc.setTextColor(51, 65, 85);
  const summaryLines = doc.splitTextToSize(story.summary || '', 180);
  doc.text(summaryLines, 16, y);
  y += summaryLines.length * 4.8 + 8;

  // Complete Story Text / Excerpt
  y = drawSectionHeader(doc, 'Classic Excerpt & Linguistic Text', y, '[TEXT]');
  const storyParagraphs = (story.storyText || '').split(/\n+/).filter(Boolean);

  storyParagraphs.forEach((para) => {
    const paraLines = doc.splitTextToSize(para, 180);
    y = checkPageBreak(doc, y, paraLines.length * 5 + 4);
    doc.setFontSize(9.5);
    doc.setFont("DejaVu", 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text(paraLines, 16, y);
    y += paraLines.length * 5 + 4;
  });

  // Tokenized Sentence Highlights
  if (story.sentences && story.sentences.length > 0) {
    y = drawSectionHeader(doc, `Annotated Sentences & Syntactic Tokens (${story.sentences.length} Highlights)`, y, '-');

    story.sentences.forEach((sent, sIdx) => {
      const sentTextLines = doc.splitTextToSize(`"${sent.text}"`, 174);
      const transLines = sent.translation ? doc.splitTextToSize(`Translation: ${sent.translation}`, 174) : [];
      const tokenCount = sent.tokens?.length || 0;

      y = checkPageBreak(doc, y, 20 + sentTextLines.length * 5 + transLines.length * 4.5 + (tokenCount ? tokenCount * 5.5 : 0));

      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(14, y, 182, 7.5, 1, 1, 'FD');

      doc.setFontSize(8.5);
      doc.setFont("DejaVu", 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(`Sentence ${sIdx + 1}:`, 18, y + 5);
      y += 10;

      doc.setFontSize(8.5);
      doc.setFont("DejaVu", 'normal');
      doc.setTextColor(30, 41, 59);
      doc.text(sentTextLines, 18, y);
      y += sentTextLines.length * 4.5 + 2;

      if (transLines.length > 0) {
        doc.setFontSize(8);
        doc.setFont("DejaVu", 'normal');
        doc.setTextColor(13, 148, 136); // teal-600
        doc.text(transLines, 18, y);
        y += transLines.length * 4.2 + 3;
      }

      if (tokenCount > 0) {
        sent.tokens.forEach((tok) => {
          const tokDesc = `• ${tok.text} [${tok.pos || 'POS'}] Role: ${tok.syntaxRole || 'Constituent'} | Meaning: ${tok.mediatorTranslation || ''}`;
          const tokLines = doc.splitTextToSize(tokDesc, 172);
          y = checkPageBreak(doc, y, tokLines.length * 4.2 + 2);
          doc.setFontSize(7.5);
          doc.setFont("DejaVu", 'normal');
          doc.setTextColor(71, 85, 105);
          doc.text(tokLines, 20, y);
          y += tokLines.length * 4 + 1;
        });
        y += 2;
      }
      y += 4;
    });
  }

  // Key Vocabulary Table
  if (story.keyVocabulary && story.keyVocabulary.length > 0) {
    y = drawSectionHeader(doc, `Story Vocabulary & Key Lexicon (${story.keyVocabulary.length} Target Words)`, y, '*');

    y = checkPageBreak(doc, y, 12);
    doc.setFillColor(241, 245, 249);
    doc.rect(14, y, 182, 7, 'F');
    doc.setFontSize(8);
    doc.setFont("DejaVu", 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text('Term / Lemma', 18, y + 4.8);
    doc.text('Part of Speech', 56, y + 4.8);
    doc.text('IPA Phonetics', 78, y + 4.8);
    doc.text('Context Meaning / Translation', 106, y + 4.8);
    y += 8;

    story.keyVocabulary.forEach((term, tIdx) => {
      const termName = term.word || term.lemma || '';
      const pos = term.pos || term.partOfSpeech || 'noun';
      const ipa = term.ipa || '';
      const meaning = term.meaning || term.translation || '';

      const meaningLines = doc.splitTextToSize(meaning, 86);
      const rowHeight = Math.max(7, meaningLines.length * 4 + 3);

      y = checkPageBreak(doc, y, rowHeight + 1);

      if (tIdx % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(14, y, 182, rowHeight, 'F');
      }

      doc.setDrawColor(241, 245, 249);
      doc.line(14, y + rowHeight, 196, y + rowHeight);

      doc.setFontSize(8);
      doc.setFont("DejaVu", 'bold');
      doc.setTextColor(14, 116, 144);
      doc.text(termName, 18, y + 4.5);

      doc.setFont("DejaVu", 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text(pos, 56, y + 4.5);
      doc.text(ipa, 78, y + 4.5);
      doc.text(meaningLines, 106, y + 4.5);

      y += rowHeight;
    });
    y += 5;
  }

  // Comprehension & Syntactic Exercises
  if (story.exercises && story.exercises.length > 0) {
    y = drawSectionHeader(doc, `Literary & Syntactic Comprehension (${story.exercises.length} Exercises)`, y, '+');

    story.exercises.forEach((ex, exIdx) => {
      const qLines = doc.splitTextToSize(ex.question || '', 174);
      const expLines = ex.explanation ? doc.splitTextToSize(ex.explanation, 132) : [];
      const exEstHeight = 12 + qLines.length * 4.5 + (ex.options?.length || 0) * 8 + (expLines.length ? expLines.length * 4.5 + 8 : 0);

      y = checkPageBreak(doc, y, Math.min(exEstHeight, 55));

      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(203, 213, 225);
      doc.roundedRect(14, y, 182, 8, 1, 1, 'FD');

      doc.setFontSize(8.5);
      doc.setFont("DejaVu", 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(`Exercise ${exIdx + 1}: ${ex.type || 'Literary Comprehension'}`, 17, y + 5.5);
      y += 11;

      doc.setFontSize(8);
      doc.setFont("DejaVu", 'normal');
      doc.setTextColor(51, 65, 85);
      doc.text(qLines, 17, y);
      y += qLines.length * 4.5 + 3;

      (ex.options || []).forEach((opt, oIdx) => {
        y = checkPageBreak(doc, y, 8);
        const isCorrect = oIdx === ex.correctIndex;
        const letter = String.fromCharCode(65 + oIdx);
        const optLines = doc.splitTextToSize(opt, 140);
        const optHeight = Math.max(6.5, optLines.length * 4 + 2.5);

        if (isCorrect) {
          doc.setFillColor(236, 253, 245);
          doc.setDrawColor(52, 211, 153);
          doc.roundedRect(18, y, 174, optHeight, 1, 1, 'FD');
          doc.setFontSize(8);
          doc.setFont("DejaVu", 'bold');
          doc.setTextColor(5, 150, 105);
          doc.text(`[OK] (${letter})`, 22, y + 4.5);
          doc.text(optLines, 34, y + 4.5);
        } else {
          doc.setFillColor(255, 255, 255);
          doc.setDrawColor(226, 232, 240);
          doc.roundedRect(18, y, 174, optHeight, 1, 1, 'FD');
          doc.setFontSize(8);
          doc.setFont("DejaVu", 'normal');
          doc.setTextColor(100, 116, 139);
          doc.text(`( ${letter} )`, 22, y + 4.5);
          doc.text(optLines, 34, y + 4.5);
        }
        y += optHeight + 1.5;
      });

      if (expLines.length > 0) {
        const expBoxHeight = Math.max(9, expLines.length * 4.5 + 4);
        y = checkPageBreak(doc, y, expBoxHeight + 4);
        doc.setFillColor(240, 253, 244);
        doc.setDrawColor(187, 247, 208);
        doc.roundedRect(18, y, 174, expBoxHeight, 1, 1, 'FD');
        doc.setFontSize(8);
        doc.setFont("DejaVu", 'bold');
        doc.setTextColor(22, 101, 52);
        doc.text('Key Explanation:', 22, y + 5);
        doc.setFont("DejaVu", 'normal');
        doc.setTextColor(51, 65, 85);
        doc.text(expLines, 52, y + 5);
        y += expBoxHeight + 4;
      }
      y += 4;
    });
  }

  // Footer on Every Page
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

  const cleanTitle = (story.title || 'classic-story').toLowerCase().replace(/[^a-z0-9]+/g, '-');
  doc.save(`${cleanTitle}-classic-study-guide.pdf`);
}



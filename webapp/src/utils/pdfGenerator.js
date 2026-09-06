import { jsPDF } from 'jspdf';

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
  y = checkPageBreak(doc, y, 20);
  doc.setFillColor(241, 245, 249); // slate-100
  doc.roundedRect(14, y, 182, 8, 1.5, 1.5, 'F');
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42); // slate-900
  doc.text(`${iconChar}  ${title.toUpperCase()}`, 18, y + 5.8);
  return y + 14;
}

/**
 * Export complete, rich Roadmap to PDF matching the exact contents shown on the app page
 */
export function exportRoadmapToPdf(roadmap) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  // Top Dark Header Banner
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, 210, 42, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('SpeakBot Linguistic Roadmap & Study Blueprint', 14, 16);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text(
    `CEFR Level: ${roadmap.level || 'B1'}  •  Category: ${roadmap.category || 'Grammar'}  •  Estimated Duration: ${roadmap.estimatedDuration || '2-3 Weeks'}`,
    14,
    25
  );

  if (roadmap.tags && roadmap.tags.length > 0) {
    doc.setFontSize(8.5);
    doc.setTextColor(56, 189, 248); // sky-400
    doc.text(`Tags: ${roadmap.tags.map((t) => `#${t}`).join('   ')}`, 14, 33);
  }

  let y = 50;

  // Title & AI / Personalization Badge
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  const titleLines = doc.splitTextToSize(roadmap.title || 'Curriculum Roadmap', 182);
  doc.text(titleLines, 14, y);
  y += titleLines.length * 6 + 2;

  if (roadmap.isGrammarPersonalized && roadmap.personalizedGrammarMeta) {
    doc.setFillColor(240, 249, 255);
    doc.setDrawColor(56, 189, 248);
    doc.roundedRect(14, y, 182, 12, 2, 2, 'FD');
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(3, 105, 161);
    doc.text(
      `PERSONALIZED TEST RECOVERY BLUEPRINT  •  Diagnostic Score: ${roadmap.personalizedGrammarMeta.grammarScore || 70}%  •  Target: ${roadmap.personalizedGrammarMeta.targetSkillDelta || '+30% Boost'}`,
      18,
      y + 7.5
    );
    y += 18;
  }

  // Section: Overview / Summary
  y = drawSectionHeader(doc, 'Curriculum Overview & Educational Objective', y, '◆');
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);
  const summaryLines = doc.splitTextToSize(roadmap.summary || '', 180);
  doc.text(summaryLines, 16, y);
  y += summaryLines.length * 5 + 8;

  // Section: Milestones Progression
  y = drawSectionHeader(doc, `Curriculum Milestones (${roadmap.milestones?.length || 0} Progression Steps)`, y, '❖');

  (roadmap.milestones || []).forEach((m, mIdx) => {
    y = checkPageBreak(doc, y, 55);

    // Milestone Card Container
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(14, y, 182, 10, 1.5, 1.5, 'FD');

    // Milestone Step Badge
    doc.setFillColor(14, 165, 233);
    doc.circle(20, y + 5, 3.5, 'F');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(String(m.step || mIdx + 1), 18.8, y + 6.2);

    // Milestone Title
    doc.setFontSize(10.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(`Step ${m.step || mIdx + 1}: ${m.title}`, 26, y + 6.5);
    y += 14;

    // Description
    if (m.description) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      const descLines = doc.splitTextToSize(m.description, 178);
      doc.text(descLines, 16, y);
      y += descLines.length * 4.5 + 3;
    }

    // Grammar Point Callout Box
    if (m.grammarPoint) {
      y = checkPageBreak(doc, y, 14);
      doc.setFillColor(240, 249, 255);
      doc.setDrawColor(186, 230, 253);
      doc.roundedRect(16, y, 178, 10, 1, 1, 'FD');
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(2, 132, 199);
      doc.text('Syntactic Rule: ', 20, y + 6.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(15, 23, 42);
      const ruleText = doc.splitTextToSize(m.grammarPoint, 140);
      doc.text(ruleText[0] || m.grammarPoint, 44, y + 6.5);
      y += 13;
    }

    // Sample Sentence
    if (m.sampleSentence) {
      y = checkPageBreak(doc, y, 12);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 41, 59);
      doc.text('Target Exemplar: ', 16, y);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(15, 23, 42);
      const sentenceLines = doc.splitTextToSize(`"${m.sampleSentence}"`, 146);
      doc.text(sentenceLines, 45, y);
      y += sentenceLines.length * 4.5 + 4;
    }

    // NLP Token Linguistic Breakdown Table
    if (m.tokens && m.tokens.length > 0) {
      y = checkPageBreak(doc, y, 24);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(100, 116, 139);
      doc.text('Linguistic Token Breakdown:', 16, y);
      y += 4;

      // Table Header
      doc.setFillColor(226, 232, 240);
      doc.rect(16, y, 178, 6, 'F');
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(51, 65, 85);
      doc.text('Token', 18, y + 4.2);
      doc.text('Lemma', 50, y + 4.2);
      doc.text('POS', 78, y + 4.2);
      doc.text('Syntax Role', 98, y + 4.2);
      doc.text('CEFR', 134, y + 4.2);
      doc.text('Mediator Meaning', 148, y + 4.2);
      y += 6;

      // Table Rows
      m.tokens.forEach((tok, tIdx) => {
        y = checkPageBreak(doc, y, 8);
        if (tIdx % 2 === 1) {
          doc.setFillColor(248, 250, 252);
          doc.rect(16, y, 178, 6, 'F');
        }
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(15, 23, 42);
        doc.text(tok.text || '', 18, y + 4.2);

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(71, 85, 105);
        doc.text(tok.lemma || tok.text || '', 50, y + 4.2);
        doc.text(tok.pos || 'NOUN', 78, y + 4.2);
        doc.text(tok.syntaxRole || 'Constituent', 98, y + 4.2);

        // CEFR Badge
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(14, 165, 233);
        doc.text(tok.cefrLevel || 'B1', 134, y + 4.2);

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(51, 65, 85);
        const trans = (tok.mediatorTranslation || tok.definition || '').slice(0, 26);
        doc.text(trans, 148, y + 4.2);

        y += 6;
      });
      y += 4;
    }

    y += 6;
  });

  // Section: Checkpoint Quiz Questions
  if (roadmap.checkpointQuestions && roadmap.checkpointQuestions.length > 0) {
    y = drawSectionHeader(doc, `Checkpoint Diagnostic Assessment (${roadmap.checkpointQuestions.length} Questions)`, y, '★');

    roadmap.checkpointQuestions.forEach((q, qIdx) => {
      y = checkPageBreak(doc, y, 42);

      // Question Prompt Box
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(203, 213, 225);
      doc.roundedRect(14, y, 182, 8, 1, 1, 'FD');

      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(`Question ${qIdx + 1}: ${q.question}`, 17, y + 5.5);
      y += 12;

      // Options (2 Columns)
      q.options.forEach((opt, oIdx) => {
        y = checkPageBreak(doc, y, 7);
        const isCorrect = oIdx === q.correctIndex;
        const letter = String.fromCharCode(65 + oIdx);

        if (isCorrect) {
          doc.setFillColor(236, 253, 245); // emerald-50
          doc.setDrawColor(52, 211, 153); // emerald-400
          doc.roundedRect(18, y, 174, 6.5, 1, 1, 'FD');
          doc.setFontSize(8.5);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(5, 150, 105); // emerald-600
          doc.text(`[✓] (${letter}) ${opt}  [CORRECT KEY]`, 22, y + 4.5);
        } else {
          doc.setFillColor(255, 255, 255);
          doc.setDrawColor(226, 232, 240);
          doc.roundedRect(18, y, 174, 6.5, 1, 1, 'FD');
          doc.setFontSize(8.5);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(100, 116, 139);
          doc.text(`( ${letter} ) ${opt}`, 22, y + 4.5);
        }
        y += 8;
      });

      // Explanation Box
      if (q.explanation) {
        y = checkPageBreak(doc, y, 16);
        doc.setFillColor(240, 253, 244);
        doc.setDrawColor(187, 247, 208);
        doc.roundedRect(18, y, 174, 10, 1, 1, 'FD');
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(22, 101, 52);
        doc.text('Linguistic Analysis:', 22, y + 4.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(51, 65, 85);
        const expLines = doc.splitTextToSize(q.explanation, 132);
        doc.text(expLines[0] || q.explanation, 52, y + 4.5);
        y += 13;
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
    doc.text('SpeakBot Universal Language Learning Engine  •  Telegram: @SpeakBot', 14, 288);
    doc.text(`Page ${i} of ${totalPages}`, 178, 288);
  }

  const cleanName = (roadmap.title || 'roadmap').toLowerCase().replace(/[^a-z0-9]+/g, '-');
  doc.save(`${cleanName}-comprehensive-roadmap.pdf`);
}

/**
 * Export complete, rich Grammar Study Guide to PDF matching the exact contents shown on the app page
 */
export function exportGrammarGuideToPdf(guide) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  // Top Dark Header Banner
  doc.setFillColor(30, 41, 59); // slate-800
  doc.rect(0, 0, 210, 42, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('SpeakBot Master Grammar Study Guide', 14, 16);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text(
    `CEFR Level: ${guide.level || 'B2'}  •  Category: ${guide.category || 'Grammar'}  •  Total Rules: ${guide.coreRules?.length || 3}`,
    14,
    25
  );

  if (guide.tags && guide.tags.length > 0) {
    doc.setFontSize(8.5);
    doc.setTextColor(129, 140, 248); // indigo-400
    doc.text(`Topics: ${guide.tags.map((t) => `#${t}`).join('   ')}`, 14, 33);
  }

  let y = 50;

  // Title
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  const titleLines = doc.splitTextToSize(guide.title || 'Grammar Study Guide', 182);
  doc.text(titleLines, 14, y);
  y += titleLines.length * 6 + 4;

  // Section: Overview / Summary
  y = drawSectionHeader(doc, 'Grammar Guide Objective & CEFR Summary', y, '◆');
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);
  const summaryLines = doc.splitTextToSize(guide.summary || '', 180);
  doc.text(summaryLines, 16, y);
  y += summaryLines.length * 5 + 8;

  // Section: Core Rules
  y = drawSectionHeader(doc, `Core Syntactic Rules (${guide.coreRules?.length || 0} Core Principles)`, y, '❖');

  (guide.coreRules || []).forEach((rule, rIdx) => {
    y = checkPageBreak(doc, y, 48);

    // Rule Title Banner
    doc.setFillColor(241, 245, 249);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(14, y, 182, 8, 1, 1, 'FD');

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(`Rule ${rIdx + 1}: ${rule.ruleTitle}`, 18, y + 5.6);
    y += 12;

    // Explanation in Mediator Language
    if (rule.explanationInMediator) {
      y = checkPageBreak(doc, y, 14);
      doc.setFillColor(240, 253, 250); // teal-50
      doc.setDrawColor(94, 234, 212); // teal-300
      doc.roundedRect(16, y, 178, 10, 1, 1, 'FD');
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(13, 148, 136); // teal-600
      doc.text('Native Explanation: ', 20, y + 6.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(15, 23, 42);
      const expText = doc.splitTextToSize(rule.explanationInMediator, 134);
      doc.text(expText[0] || rule.explanationInMediator, 52, y + 6.5);
      y += 13;
    }

    // Formula Box
    if (rule.formula) {
      y = checkPageBreak(doc, y, 14);
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(148, 163, 184);
      doc.roundedRect(16, y, 178, 9, 1, 1, 'FD');
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(79, 70, 229); // indigo-600
      doc.text('Formula: ', 20, y + 6);
      doc.setFont('courier', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(rule.formula, 36, y + 6);
      y += 12;
    }

    // Exemplar Sentence
    if (rule.example) {
      y = checkPageBreak(doc, y, 10);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(30, 41, 59);
      doc.text('Standard Example: ', 16, y);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(15, 23, 42);
      const exLines = doc.splitTextToSize(`"${rule.example}"`, 140);
      doc.text(exLines, 46, y);
      y += exLines.length * 4.5 + 3;
    }

    // Tokenized breakdown for rule tokens
    if (rule.tokens && rule.tokens.length > 0) {
      y = checkPageBreak(doc, y, 20);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text('Syntax & Token Mapping:', 16, y);
      y += 3.5;

      rule.tokens.forEach((tok) => {
        y = checkPageBreak(doc, y, 6);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(15, 23, 42);
        doc.text(`• ${tok.text}`, 18, y + 4);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(71, 85, 105);
        doc.text(`[${tok.pos || 'POS'}] Role: ${tok.syntaxRole || 'Constituent'} | CEFR: ${tok.cefrLevel || 'B1'} | IPA: ${tok.ipa || ''} | Meaning: ${tok.mediatorTranslation || ''}`, 38, y + 4);
        y += 5.5;
      });
      y += 3;
    }

    y += 5;
  });

  // Section: Frequent Pitfalls & Common Mistakes
  if (guide.commonMistakes && guide.commonMistakes.length > 0) {
    y = drawSectionHeader(doc, `Frequent Pitfalls & Native Interference (${guide.commonMistakes.length} Crucial Traps)`, y, '▲');

    guide.commonMistakes.forEach((m, mIdx) => {
      y = checkPageBreak(doc, y, 22);

      doc.setFillColor(255, 241, 242); // rose-50
      doc.setDrawColor(254, 205, 211); // rose-200
      doc.roundedRect(14, y, 182, 19, 1.5, 1.5, 'FD');

      // Incorrect
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(225, 29, 72); // rose-600
      doc.text(`[x] Incorrect: ${m.incorrect}`, 18, y + 5.5);

      // Correct
      doc.setTextColor(13, 148, 136); // teal-600
      doc.text(`[✓] Correct:   ${m.correct}`, 18, y + 11);

      // Reason
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      const reasonText = doc.splitTextToSize(`Reason: ${m.reason}`, 174);
      doc.text(reasonText[0] || m.reason, 18, y + 16);

      y += 23;
    });
  }

  // Section: Practice Exercises
  if (guide.practiceExercises && guide.practiceExercises.length > 0) {
    y = drawSectionHeader(doc, `Practice Exercises & Syntactic Verification (${guide.practiceExercises.length} Drills)`, y, '★');

    guide.practiceExercises.forEach((ex, exIdx) => {
      y = checkPageBreak(doc, y, 40);

      // Instruction & Question
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(203, 213, 225);
      doc.roundedRect(14, y, 182, 8, 1, 1, 'FD');

      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(`Exercise ${exIdx + 1}: ${ex.instruction || 'Choose the grammatically accurate sentence'}`, 17, y + 5.5);
      y += 11;

      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(51, 65, 85);
      doc.text(ex.question, 17, y);
      y += 6;

      // Options
      ex.options.forEach((opt, oIdx) => {
        y = checkPageBreak(doc, y, 7);
        const isCorrect = oIdx === ex.correctIndex;
        const letter = String.fromCharCode(65 + oIdx);

        if (isCorrect) {
          doc.setFillColor(236, 253, 245);
          doc.setDrawColor(52, 211, 153);
          doc.roundedRect(18, y, 174, 6.5, 1, 1, 'FD');
          doc.setFontSize(8.5);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(5, 150, 105);
          doc.text(`[✓] (${letter}) ${opt}  [CORRECT KEY]`, 22, y + 4.5);
        } else {
          doc.setFillColor(255, 255, 255);
          doc.setDrawColor(226, 232, 240);
          doc.roundedRect(18, y, 174, 6.5, 1, 1, 'FD');
          doc.setFontSize(8.5);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(100, 116, 139);
          doc.text(`( ${letter} ) ${opt}`, 22, y + 4.5);
        }
        y += 8;
      });

      // Explanation
      if (ex.explanation) {
        y = checkPageBreak(doc, y, 14);
        doc.setFillColor(240, 253, 244);
        doc.setDrawColor(187, 247, 208);
        doc.roundedRect(18, y, 174, 9, 1, 1, 'FD');
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(22, 101, 52);
        doc.text('Key Explanation:', 22, y + 4.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(51, 65, 85);
        const expLines = doc.splitTextToSize(ex.explanation, 132);
        doc.text(expLines[0] || ex.explanation, 50, y + 4.5);
        y += 12;
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
    doc.text('SpeakBot Master Grammar Engine  •  Telegram: @SpeakBot', 14, 288);
    doc.text(`Page ${i} of ${totalPages}`, 178, 288);
  }

  const cleanName = (guide.title || 'grammar-guide').toLowerCase().replace(/[^a-z0-9]+/g, '-');
  doc.save(`${cleanName}-comprehensive-study-guide.pdf`);
}

/**
 * Generate a question paper and a matching answer sheet that deliberately
 * exercise every edge case the app has to handle:
 *
 *   - labelled sub-parts        -> 4 (a) and 4 (b) must extract as two entries
 *   - answers written out of order -> sheet runs 2, 1, 4(b), 5, 4(a)
 *   - an unanswered question    -> Q3 is never attempted
 *   - an answer matching nothing -> a block labelled "Q9", which isn't on the paper
 *   - an answer spanning pages   -> Q5 starts on sheet page 1 and finishes on page 2
 *   - a mislabelled answer       -> 4(a) is written as "4(c)", so only content matching finds it
 *
 * Run: node scripts/make-samples.mjs
 * Output: samples/sample-question-paper.pdf, samples/sample-answer-sheet.pdf
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const OUT_DIR = join(process.cwd(), "samples");
const A4 = [595, 842];
const MARGIN = 56;

const QUESTION_PAPER = {
  title: "Class 10 - Biology Unit Test",
  subtitle: "Time: 1 hour                    Maximum Marks: 20",
  instructions: "All questions are compulsory. Draw diagrams where asked.",
  questions: [
    { label: "1.", text: "Define photosynthesis and state where it occurs in a plant cell.", marks: 3 },
    { label: "2.", text: "Which blood vessel carries blood away from the heart?", marks: 2 },
    { label: "3.", text: "Explain the role of chlorophyll in photosynthesis, naming the two major stages of the process.", marks: 4 },
    { label: "4 (a)", text: "Name the raw materials required for photosynthesis.", marks: 3 },
    { label: "4 (b)", text: "Write the balanced chemical equation for photosynthesis.", marks: 3 },
    { label: "5.", text: "Describe the flow of blood through the human heart, starting from the right atrium and ending at the aorta. Include the names of the valves crossed.", marks: 5 },
  ],
};

// Written in the order the student actually attempted them.
const ANSWER_SHEET = [
  {
    label: "Q2.",
    lines: [
      "The artery carries blood away from the heart.",
      "The main one is the aorta, which leaves the left",
      "ventricle and carries oxygenated blood.",
    ],
  },
  {
    label: "Q1.",
    lines: [
      "Photosynthesis is the process used by green plants",
      "and some other organisms to convert light energy",
      "into chemical energy. It occurs in the chloroplast",
      "of the plant cell.",
    ],
  },
  {
    label: "Q4(b)",
    lines: ["6CO2 + 6H2O  --light/chlorophyll-->  C6H12O6 + 6O2"],
  },
  {
    // Mislabelled on purpose: this is really 4(a). Label matching must fail and
    // content matching must catch it.
    label: "Q4(c)",
    lines: [
      "The raw materials needed are carbon dioxide, water",
      "and sunlight. Chlorophyll is needed too, as the",
      "pigment that traps the light.",
    ],
  },
  {
    // No such question on the paper - must surface as unmatched.
    label: "Q9.",
    lines: [
      "Osmosis is the movement of water molecules from a",
      "region of higher water potential to a region of",
      "lower water potential through a semi-permeable",
      "membrane.",
    ],
  },
  {
    // Long enough to run onto the second page.
    label: "Q5.",
    lines: [
      "Blood enters the right atrium from the vena cava.",
      "It passes through the tricuspid valve into the",
      "right ventricle. From there it is pumped through",
      "the pulmonary valve into the pulmonary artery and",
      "goes to the lungs to pick up oxygen.",
      "The oxygenated blood returns to the left atrium",
      "through the pulmonary vein. It then crosses the",
      "bicuspid (mitral) valve into the left ventricle,",
    ],
    continued: [
      "which is the thickest chamber. Finally the blood is",
      "pushed through the aortic valve into the aorta and",
      "out to the rest of the body.",
    ],
  },
];

async function buildQuestionPaper() {
  const pdf = await PDFDocument.create();
  const bold = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const body = await pdf.embedFont(StandardFonts.TimesRoman);

  const page = pdf.addPage(A4);
  let y = A4[1] - MARGIN;

  page.drawText(QUESTION_PAPER.title, { x: MARGIN, y, size: 17, font: bold });
  y -= 22;
  page.drawText(QUESTION_PAPER.subtitle, { x: MARGIN, y, size: 10, font: body });
  y -= 16;
  page.drawText(QUESTION_PAPER.instructions, {
    x: MARGIN,
    y,
    size: 10,
    font: body,
    color: rgb(0.35, 0.35, 0.35),
  });
  y -= 14;
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: A4[0] - MARGIN, y },
    thickness: 0.8,
    color: rgb(0.7, 0.7, 0.7),
  });
  y -= 30;

  const width = A4[0] - MARGIN * 2 - 40;
  for (const q of QUESTION_PAPER.questions) {
    page.drawText(q.label, { x: MARGIN, y, size: 12, font: bold });
    for (const line of wrap(q.text, body, 12, width)) {
      page.drawText(line, { x: MARGIN + 44, y, size: 12, font: body });
      y -= 17;
    }
    page.drawText(`[${q.marks}]`, { x: A4[0] - MARGIN - 22, y: y + 17, size: 11, font: body });
    y -= 16;
  }

  return pdf.save();
}

async function buildAnswerSheet() {
  const pdf = await PDFDocument.create();
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const hand = await pdf.embedFont(StandardFonts.HelveticaOblique);

  let page = pdf.addPage(A4);
  drawRuling(page);

  let y = A4[1] - MARGIN;
  page.drawText("Name: Aarav Sharma        Roll No: 24        Class: 10-B", {
    x: MARGIN,
    y,
    size: 10,
    font: bold,
    color: rgb(0.25, 0.25, 0.45),
  });
  y -= 34;

  for (const answer of ANSWER_SHEET) {
    // Start a new page when there isn't room for the whole block.
    if (y < MARGIN + answer.lines.length * 19 + 30 && !answer.continued) {
      page = pdf.addPage(A4);
      drawRuling(page);
      y = A4[1] - MARGIN;
    }

    page.drawText(answer.label, {
      x: MARGIN,
      y,
      size: 13,
      font: bold,
      color: rgb(0.1, 0.1, 0.5),
    });
    y -= 20;

    for (const line of answer.lines) {
      page.drawText(line, { x: MARGIN + 12, y, size: 12, font: hand, color: rgb(0.12, 0.12, 0.42) });
      y -= 19;
    }

    if (answer.continued) {
      page = pdf.addPage(A4);
      drawRuling(page);
      y = A4[1] - MARGIN;
      for (const line of answer.continued) {
        page.drawText(line, { x: MARGIN + 12, y, size: 12, font: hand, color: rgb(0.12, 0.12, 0.42) });
        y -= 19;
      }
    }

    y -= 18;
  }

  return pdf.save();
}

/** Faint ruled lines, so the pages read as exercise-book paper. */
function drawRuling(page) {
  for (let y = A4[1] - MARGIN + 6; y > MARGIN; y -= 19) {
    page.drawLine({
      start: { x: MARGIN - 10, y: y - 4 },
      end: { x: A4[0] - MARGIN + 10, y: y - 4 },
      thickness: 0.4,
      color: rgb(0.82, 0.86, 0.92),
    });
  }
  page.drawLine({
    start: { x: MARGIN - 4, y: A4[1] - 20 },
    end: { x: MARGIN - 4, y: 20 },
    thickness: 0.7,
    color: rgb(0.93, 0.74, 0.74),
  });
}

function wrap(text, font, size, maxWidth) {
  const words = text.split(/\s+/);
  const lines = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(join(OUT_DIR, "sample-question-paper.pdf"), await buildQuestionPaper());
writeFileSync(join(OUT_DIR, "sample-answer-sheet.pdf"), await buildAnswerSheet());
console.log(`Wrote sample PDFs to ${OUT_DIR}`);

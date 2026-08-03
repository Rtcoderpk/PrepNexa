import type { ResultsData } from "@/lib/results";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function scoreColor(score: number): string {
  if (score >= 8) return "#10b981";
  if (score >= 6) return "#f59e0b";
  return "#ef4444";
}

function scoreLabel(score: number): string {
  if (score >= 8) return "Strong";
  if (score >= 6) return "Good";
  if (score >= 4) return "Needs work";
  return "Weak";
}

/**
 * Generates a print-friendly HTML report string. Users can save it as PDF via
 * the browser's print dialog (print-to-PDF). This avoids heavy server-side
 * PDF deps while producing a professional report.
 */
export function buildReportHtml(data: ResultsData): string {
  const { interview, questions } = data;
  const score = interview.overall_score ?? 0;
  const color = scoreColor(score);
  const strengths = interview.strengths ?? [];
  const improvements = interview.areas_to_improve ?? [];
  const date = new Date(interview.completed_at ?? interview.created_at).toLocaleDateString(
    "en-US",
    { month: "long", day: "numeric", year: "numeric" },
  );

  const strengthsHtml = strengths.length
    ? strengths.map((s) => `<li>${escapeHtml(s)}</li>`).join("")
    : "<li>No strengths recorded.</li>";

  const improvementsHtml = improvements.length
    ? improvements.map((s) => `<li>${escapeHtml(s)}</li>`).join("")
    : "<li>No areas to improve recorded.</li>";

  const questionsHtml = questions
    .map(
      (q, i) => `
        <div class="qa">
          <div class="qa-header">
            <span class="qa-num">Q${i + 1}</span>
            <span class="qa-cat">${escapeHtml(q.category)}</span>
            ${q.score !== null ? `<span class="qa-score" style="color:${scoreColor(q.score)}">${q.score}/10 · ${scoreLabel(q.score)}</span>` : ""}
          </div>
          <p class="qa-q">${escapeHtml(q.question)}</p>
          ${q.answer ? `<p class="qa-a"><strong>Your answer:</strong> ${escapeHtml(q.answer)}</p>` : ""}
          ${q.feedback ? `<p class="qa-f"><strong>Feedback:</strong> ${escapeHtml(q.feedback)}</p>` : ""}
        </div>
      `,
    )
    .join("");

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>InterviewIQ AI Report</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #0f172a; padding: 40px; line-height: 1.5; }
  .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 24px; }
  .brand { font-size: 20px; font-weight: 800; }
  .brand span { color: #7c3aed; }
  .meta { text-align: right; font-size: 13px; color: #64748b; }
  .score-box { display: flex; align-items: center; gap: 24px; margin-bottom: 28px; padding: 24px; background: #f8fafc; border-radius: 16px; border: 1px solid #e2e8f0; }
  .score-ring { width: 120px; height: 120px; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
  .score-inner { width: 96px; height: 96px; background: #f8fafc; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-direction: column; }
  .score-inner strong { font-size: 34px; color: ${color}; }
  .score-inner span { font-size: 12px; color: #64748b; }
  .score-info h2 { font-size: 20px; margin-bottom: 6px; }
  .score-info p { font-size: 14px; color: #475569; }
  .section { margin-bottom: 24px; }
  .section h3 { font-size: 15px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #7c3aed; margin-bottom: 12px; }
  ul { padding-left: 20px; }
  li { margin-bottom: 6px; font-size: 14px; }
  .summary { font-size: 14px; color: #334155; padding: 16px; background: #f1f5f9; border-radius: 12px; }
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .qa { border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-bottom: 12px; page-break-inside: avoid; }
  .qa-header { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
  .qa-num { background: #7c3aed; color: white; font-size: 12px; font-weight: 700; border-radius: 6px; padding: 2px 8px; }
  .qa-cat { font-size: 12px; color: #64748b; text-transform: capitalize; }
  .qa-score { margin-left: auto; font-size: 13px; font-weight: 700; }
  .qa-q { font-size: 14px; font-weight: 600; margin-bottom: 8px; }
  .qa-a, .qa-f { font-size: 13px; color: #475569; margin-bottom: 6px; }
  .footer { margin-top: 32px; text-align: center; font-size: 12px; color: #94a3b8; }
  @media print { body { padding: 20px; } .score-ring { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
</style>
</head>
<body>
  <div class="header">
    <div class="brand">Interview<span>IQ</span> AI</div>
    <div class="meta">Interview Report<br/>${date}</div>
  </div>

  <div class="score-box">
    <div class="score-ring" style="background: conic-gradient(${color} ${score * 36}deg, #e2e8f0 0deg)">
      <div class="score-inner">
        <strong>${score}</strong>
        <span>/ 10</span>
      </div>
    </div>
    <div class="score-info">
      <h2>${escapeHtml(interview.job_role ?? "Interview")}</h2>
      <p>${scoreLabel(score)} performance · ${questions.length} questions</p>
    </div>
  </div>

  <div class="section">
    <h3>Summary</h3>
    <p class="summary">${escapeHtml(interview.summary ?? "No summary available.")}</p>
  </div>

  <div class="grid2">
    <div class="section">
      <h3>Strengths</h3>
      <ul>${strengthsHtml}</ul>
    </div>
    <div class="section">
      <h3>Areas to Improve</h3>
      <ul>${improvementsHtml}</ul>
    </div>
  </div>

  <div class="section">
    <h3>Question-by-Question Feedback</h3>
    ${questionsHtml || "<p>No questions recorded.</p>"}
  </div>

  <div class="footer">Generated by InterviewIQ AI · ${new Date().toLocaleDateString()}</div>
</body>
</html>`;
}

export function buildReportText(data: ResultsData): string {
  const { interview, questions } = data;
  const lines: string[] = [];

  lines.push(`InterviewIQ AI — Interview Report`);
  lines.push(`Role: ${interview.job_role ?? "N/A"}`);
  lines.push(`Overall Score: ${interview.overall_score ?? "N/A"}/10`);
  lines.push("");
  lines.push(`SUMMARY`);
  lines.push(interview.summary ?? "");
  lines.push("");
  lines.push("STRENGTHS");
  (interview.strengths ?? []).forEach((s) => lines.push(`- ${s}`));
  lines.push("");
  lines.push("AREAS TO IMPROVE");
  (interview.areas_to_improve ?? []).forEach((s) => lines.push(`- ${s}`));
  lines.push("");
  lines.push("PER QUESTION");
  questions.forEach((q, i) => {
    lines.push(`${i + 1}. [${q.category}] ${q.question}`);
    lines.push(`   Score: ${q.score ?? "N/A"}/10`);
    if (q.answer) lines.push(`   Answer: ${q.answer}`);
    if (q.feedback) lines.push(`   Feedback: ${q.feedback}`);
    lines.push("");
  });

  return lines.join("\n");
}

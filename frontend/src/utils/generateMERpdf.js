import jsPDF from "jspdf";

// Mask Aadhaar: expose only last 4 digits — NEVER log or expose the full number
function maskAadhaar(raw) {
  const digits = String(raw || "").replace(/\D/g, "");
  if (digits.length < 4) return "Not available";
  return `XXXX XXXX ${digits.slice(-4)}`;
}

/**
 * Generate and auto-download a print-ready A4 MER PDF.
 * Aadhaar is masked before writing. Filename never contains PII.
 */
export function generateMERpdf({
  name,
  age,
  customerPhoto,
  faceMatchResult,
  ocrResult,
  geoData,
  caseId,
  spoofResult,
}) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  // Layout
  const PW = 210;
  const PH = 297;
  const ML = 18;
  const MR = 18;
  const CW = PW - ML - MR; // 174mm

  // Brand palette
  const ORANGE = [255, 111, 97];   // #FF6F61
  const DARK   = [32, 36, 39];     // #202427
  const MID    = [103, 118, 126];  // mid-gray for labels
  const GREEN  = [59, 165, 93];    // #3BA55D
  const RED    = [211, 47, 47];    // #D32F2F
  const WHITE  = [255, 255, 255];
  const BGRAY  = [248, 249, 250];
  const LGRAY  = [218, 218, 218];

  const setRgb    = (...c) => doc.setTextColor(...c);
  const setFill   = (...c) => doc.setFillColor(...c);
  const setStroke = (...c) => doc.setDrawColor(...c);

  // Section header — returns y after the band
  function sectionHeader(title, yPos) {
    setFill(...ORANGE);
    doc.rect(ML, yPos, CW, 7, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    setRgb(...WHITE);
    doc.text(title, ML + 3.5, yPos + 4.8);
    return yPos + 7;
  }

  // Label → value row, returns next y
  function drawField(label, value, yPos) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    setRgb(...MID);
    doc.text(label.toUpperCase(), ML, yPos);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    setRgb(...DARK);
    const lines = doc.splitTextToSize(String(value || "—"), CW - 48);
    doc.text(lines, ML + 47, yPos);
    return yPos + Math.max(6.5, lines.length * 5.2);
  }

  const ts = new Date().toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "short",
  });

  let y = 0;

  // ── 1. HEADER BAND ───────────────────────────────────────────────────
  setFill(...ORANGE);
  doc.rect(0, 0, PW, 33, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  setRgb(...WHITE);
  doc.text("MEDICAL EXAMINATION REPORT", ML, 15);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(255, 235, 230);
  doc.text("Tata 1mg  ·  Video MER System", ML, 23);

  y = 33;

  // ── 2. META BAR ──────────────────────────────────────────────────────
  setFill(...BGRAY);
  doc.rect(0, y, PW, 13, "F");
  setStroke(...LGRAY);
  doc.setLineWidth(0.2);
  doc.line(0, y + 13, PW, y + 13);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  setRgb(...DARK);
  doc.text(`Case ID: ${caseId || "N/A"}`, ML, y + 5);

  doc.setFont("helvetica", "normal");
  setRgb(...MID);
  doc.text(`Generated: ${ts} IST`, ML, y + 10.5);

  y += 13 + 7;

  // ── 3. PATIENT DETAILS ───────────────────────────────────────────────
  y = sectionHeader("PATIENT DETAILS", y) + 5;

  const ocrFields = ocrResult?.fields || {};

  y = drawField("Full Name", name, y);
  y = drawField("Age", age ? `${age} years` : null, y);
  if (ocrFields.dateOfBirth) y = drawField("Date of Birth", ocrFields.dateOfBirth, y);
  if (ocrFields.gender)      y = drawField("Gender", ocrFields.gender, y);

  // Aadhaar masked — raw number never written anywhere
  const maskedAadhaar = maskAadhaar(ocrFields.idNumber || ocrFields.aadhaarNumber);
  y = drawField("Aadhaar No.", maskedAadhaar, y);

  if (ocrFields.address) y = drawField("Address", ocrFields.address, y);
  if (geoData?.latitude) {
    y = drawField(
      "GPS Location",
      `${geoData.latitude.toFixed(5)}, ${geoData.longitude.toFixed(5)}`,
      y
    );
  }

  y += 6;

  // ── 4. IDENTITY VERIFICATION ─────────────────────────────────────────
  y = sectionHeader("IDENTITY VERIFICATION", y) + 5;

  if (faceMatchResult && !faceMatchResult.loading && !faceMatchResult.error) {
    const matched = faceMatchResult.matched ?? faceMatchResult.match ?? false;
    const score   = faceMatchResult.score ?? faceMatchResult.similarity ?? faceMatchResult.confidence;
    const pct     = score != null ? Math.round(score * 100) : null;

    setFill(...(matched ? GREEN : RED));
    doc.rect(ML, y, 85, 11, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    setRgb(...WHITE);
    doc.text(
      matched ? "✓  FACE MATCH PASSED" : "✗  FACE MATCH FAILED",
      ML + 3.5, y + 7.5
    );

    if (pct != null) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      setRgb(...DARK);
      doc.text(`Similarity score: ${pct}%`, ML + 90, y + 7.5);
    }
    y += 15;
  } else {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    setRgb(...MID);
    doc.text("Face match was not performed.", ML, y + 5);
    y += 10;
  }

  if (spoofResult && !spoofResult.loading && !spoofResult.error) {
    const pct = spoofResult.confidence != null
      ? Math.round(spoofResult.confidence * 100)
      : null;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    setRgb(...(spoofResult.isReal ? GREEN : RED));
    doc.text(
      `Liveness: ${spoofResult.isReal ? "LIVE PERSON" : "SPOOF DETECTED"}${pct != null ? `  (${pct}% confidence)` : ""}`,
      ML, y + 5
    );
    y += 9;
  }

  y += 5;

  // ── 5. CUSTOMER PHOTOGRAPH ───────────────────────────────────────────
  if (customerPhoto) {
    y = sectionHeader("CUSTOMER PHOTOGRAPH", y) + 5;

    const imgW = 52;
    const imgH = 66;

    try {
      doc.addImage(customerPhoto, "JPEG", ML, y, imgW, imgH, undefined, "MEDIUM");
      setStroke(...LGRAY);
      doc.setLineWidth(0.3);
      doc.rect(ML, y, imgW, imgH, "S");
    } catch {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(9);
      setRgb(...MID);
      doc.text("Photograph unavailable.", ML, y + 10);
    }

    y += imgH + 7;
  }

  // ── 6. FOOTER ────────────────────────────────────────────────────────
  const footerY = PH - 14;
  setStroke(...LGRAY);
  doc.setLineWidth(0.25);
  doc.line(ML, footerY, PW - MR, footerY);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  setRgb(160, 160, 160);
  doc.text(
    "System-generated document. Contains confidential patient information. Handle per applicable data protection laws (DPDP Act, India).",
    ML, footerY + 4.5,
    { maxWidth: CW }
  );
  doc.text(
    `Tata 1mg Video MER  ·  ${ts} IST  ·  Case: ${caseId || "N/A"}`,
    ML, footerY + 10
  );

  // Save — filename never contains Aadhaar, name, or any PII
  const safeId = (caseId || "report").replace(/[^a-zA-Z0-9_-]/g, "-");
  doc.save(`MER-${safeId}.pdf`);
}

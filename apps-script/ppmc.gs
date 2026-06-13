/**
 * ppmc.gs — PPMC Google Sheet automation
 *
 * Two responsibilities:
 *   1. Custom menu "PPMC → Generate links…" — calls the Flask backend to
 *      bulk-create VideoSDK rooms and appends rows to this sheet.
 *   2. doPost(e) web app — receives status/recording-URL updates from the
 *      Flask backend and writes them back to the matching sheet row.
 *
 * ─── SETUP (one-time, done by you — not ops) ─────────────────────────────────
 * 1. Open this sheet in Google Sheets → Extensions → Apps Script
 * 2. Paste this entire file into the editor, replacing any existing code.
 * 3. Set Script Properties (Project Settings → Script Properties):
 *      BACKEND_URL     e.g. https://ppmc-backend.yourdomain.com
 *      PPMC_SHARED_KEY same value as PPMC_SHARED_KEY in backend/.env
 *      WEBAPP_SECRET   same value as APPSCRIPT_SECRET in backend/.env
 * 4. Save → Run → generateLinks once to trigger the OAuth consent screen.
 * 5. Deploy as Web App:
 *      Execute as: Me
 *      Access: Anyone
 *    Copy the /exec URL → paste into APPSCRIPT_WEBAPP_URL in backend/.env
 * 6. Sheet must have a tab named "Sessions" with this header row (row 1):
 *      A: Date | B: Meeting ID | C: Doctor Link | D: Patient Link | E: Status | F: Recording Link
 * ──────────────────────────────────────────────────────────────────────────────
 *
 * Column index reference (1-based for getRange, 0-based for array access):
 *   A=1  Date
 *   B=2  Meeting ID      ← used as the lookup key
 *   C=3  Doctor Link
 *   D=4  Patient Link
 *   E=5  Status
 *   F=6  Recording Link  ← filled by recording-stopped webhook or "Fetch recording…" menu
 */

var SHEET_NAME      = "Sessions";
var MEETING_ID_COL  = 2;  // column B (1-based)
var STATUS_COL      = 5;  // column E
var RECORDING_COL   = 6;  // column F

// ── 1. Custom menu ────────────────────────────────────────────────────────────

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("PPMC")
    .addItem("Generate links…",    "generateLinks")
    .addItem("Fetch recording…",   "fetchRecording")
    .addToUi();
}

function generateLinks() {
  var ui = SpreadsheetApp.getUi();

  var dateResp = ui.prompt(
    "PPMC — Generate Links",
    "Session date (YYYY-MM-DD):",
    ui.ButtonSet.OK_CANCEL
  );
  if (dateResp.getSelectedButton() !== ui.Button.OK) return;
  var sessionDate = dateResp.getResponseText().trim();
  if (!sessionDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
    ui.alert("Invalid date format. Use YYYY-MM-DD.");
    return;
  }

  var countResp = ui.prompt(
    "PPMC — Generate Links",
    "Number of sessions:",
    ui.ButtonSet.OK_CANCEL
  );
  if (countResp.getSelectedButton() !== ui.Button.OK) return;
  var count = parseInt(countResp.getResponseText().trim(), 10);
  if (isNaN(count) || count < 1 || count > 50) {
    ui.alert("Number of sessions must be between 1 and 50.");
    return;
  }

  var props      = PropertiesService.getScriptProperties();
  var backendUrl = props.getProperty("BACKEND_URL");
  var ppmcKey    = props.getProperty("PPMC_SHARED_KEY");

  if (!backendUrl || !ppmcKey) {
    ui.alert("Script Properties not configured. Set BACKEND_URL and PPMC_SHARED_KEY.");
    return;
  }

  var response;
  try {
    response = UrlFetchApp.fetch(backendUrl + "/api/v1/ppmc/embed/bulk", {
      method: "post",
      contentType: "application/json",
      headers: { "X-PPMC-Key": ppmcKey },
      payload: JSON.stringify({ date: sessionDate, count: count }),
      muteHttpExceptions: true,
    });
  } catch (e) {
    ui.alert("Could not reach backend: " + e.message);
    return;
  }

  if (response.getResponseCode() !== 200) {
    ui.alert("Backend error " + response.getResponseCode() + ":\n" + response.getContentText());
    return;
  }

  var sessions;
  try {
    sessions = JSON.parse(response.getContentText());
  } catch (e) {
    ui.alert("Unexpected response from backend.");
    return;
  }

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (!sheet) {
    ui.alert('Sheet "' + SHEET_NAME + '" not found. Please create it with the correct header row.');
    return;
  }

  sessions.forEach(function (s) {
    // Columns: Date | Meeting ID | Doctor Link | Patient Link | Status | Recording Link
    sheet.appendRow([sessionDate, s.meetingId, s.doctorLink, s.patientLink, "CREATED", ""]);
  });

  ui.alert(sessions.length + " session(s) added to the sheet for " + sessionDate + ".");
}

// ── 2. Fetch Recording ────────────────────────────────────────────────────────

/**
 * Prompts for a Meeting ID, asks the backend to fetch the VideoSDK recording
 * for that room, and writes the recording URL into the matching sheet row.
 */
function fetchRecording() {
  var ui = SpreadsheetApp.getUi();

  var resp = ui.prompt(
    "PPMC — Fetch Recording",
    "Enter the Meeting ID:",
    ui.ButtonSet.OK_CANCEL
  );
  if (resp.getSelectedButton() !== ui.Button.OK) return;
  var meetingId = resp.getResponseText().trim();
  if (!meetingId) {
    ui.alert("Meeting ID cannot be empty.");
    return;
  }

  var props      = PropertiesService.getScriptProperties();
  var backendUrl = props.getProperty("BACKEND_URL");
  var ppmcKey    = props.getProperty("PPMC_SHARED_KEY");

  if (!backendUrl || !ppmcKey) {
    ui.alert("Script Properties not configured. Set BACKEND_URL and PPMC_SHARED_KEY.");
    return;
  }

  var response;
  try {
    response = UrlFetchApp.fetch(backendUrl + "/api/v1/ppmc/recordings", {
      method: "post",
      contentType: "application/json",
      headers: { "X-PPMC-Key": ppmcKey },
      payload: JSON.stringify({ meetingId: meetingId }),
      muteHttpExceptions: true,
    });
  } catch (e) {
    ui.alert("Could not reach backend: " + e.message);
    return;
  }

  var body = response.getContentText();
  if (response.getResponseCode() !== 200) {
    ui.alert("Backend error " + response.getResponseCode() + ":\n" + body);
    return;
  }

  var result;
  try {
    result = JSON.parse(body);
  } catch (e) {
    ui.alert("Unexpected response from backend (status 200):\n" + body.substring(0, 400));
    return;
  }

  if (!result.found) {
    ui.alert("No recording found yet for meeting: " + meetingId);
    return;
  }

  // Backend already wrote to sheet via sheet_sync; also update here as a fallback.
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (sheet) {
    var rows = sheet.getDataRange().getValues();
    for (var i = 1; i < rows.length; i++) {
      if (rows[i][MEETING_ID_COL - 1] === meetingId) {
        if (result.fileUrl) {
          sheet.getRange(i + 1, RECORDING_COL).setValue(result.fileUrl);
        }
        break;
      }
    }
  }

  ui.alert(
    "Recording found!\n\n" +
    "ID:  " + result.recordingId + "\n" +
    "URL: " + result.fileUrl
  );
}

// ── 3. doPost — receives status/recording-URL updates from Flask backend ──────

/**
 * Deploy this script as a Web App (Execute as: Me, Access: Anyone).
 * The /exec URL goes into APPSCRIPT_WEBAPP_URL in backend/.env.
 *
 * Expected JSON body from Flask sheet_sync.py:
 *   { secret, meetingId, status?, recordingUrl? }
 */
function doPost(e) {
  var props  = PropertiesService.getScriptProperties();
  var secret = props.getProperty("WEBAPP_SECRET");

  var data;
  try {
    data = JSON.parse(e.postData.contents);
  } catch (err) {
    return _jsonResponse({ error: "invalid JSON" }, 400);
  }

  if (!secret || data.secret !== secret) {
    return _jsonResponse({ error: "forbidden" }, 403);
  }

  if (!data.meetingId) {
    return _jsonResponse({ error: "meetingId required" }, 400);
  }

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (!sheet) {
    return _jsonResponse({ error: 'Sheet "' + SHEET_NAME + '" not found' }, 500);
  }

  var rows   = sheet.getDataRange().getValues();
  var updated = false;

  for (var i = 1; i < rows.length; i++) {  // start at 1 to skip header
    if (rows[i][MEETING_ID_COL - 1] === data.meetingId) {  // convert to 0-based
      if (data.status !== undefined) {
        sheet.getRange(i + 1, STATUS_COL).setValue(data.status);
      }
      if (data.recordingUrl !== undefined && data.recordingUrl !== "") {
        sheet.getRange(i + 1, RECORDING_COL).setValue(data.recordingUrl);
      }
      updated = true;
      break;
    }
  }

  if (!updated) {
    // Row not found — log and return ok anyway so Flask doesn't retry forever
    Logger.log("doPost: meetingId not found in sheet: " + data.meetingId);
  }

  return _jsonResponse({ ok: true, updated: updated });
}

function _jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

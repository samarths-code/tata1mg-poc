/**
 * ppmc.gs — PPMC Google Sheet automation
 *
 * COLUMN LAYOUT (1-based):
 *   A=1   POC
 *   B=2   S.No
 *   C=3   Policy No.
 *   D=4   Name              ← patient name (used in doctor link as meetingTitle)
 *   E=5   Contact
 *   F=6   Gender
 *   G=7   Order ID
 *   H=8   App. Date
 *   I=9   App. Time
 *   J=10  Language
 *   K=11  Package
 *   L=12  Fasting
 *   M=13  Address
 *   N=14  Pincode
 *   O=15  Zone
 *   P=16  City
 *   Q=17  State
 *   R=18  MER Link
 *   S=19  Phlebo name
 *   T=20  Phlebo Contact
 *   U=21  Doctor            ← doctor name (used in patient link as meetingTitle)
 *   V=22  Doctors Contact
 *   W=23  Zoom Link         ← REPURPOSED: after-5PM switch. Dropdown ACTIVE/DEACTIVE
 *                             (one-time setup: select column W → Data → Data validation
 *                              → Dropdown with values ACTIVE, DEACTIVE). Rows set to
 *                              ACTIVE keep working after the daily 5PM link cutoff.
 *   X=24  Status of the call
 *   Y=25  Vedio Recoding
 *   Z=26  MER Status
 *   AA=27 Error
 *   AB=28 type of error
 *   AC=29 Remarks (Doctor Error)
 *   AD=30 Phlebo Join Time
 *   AE=31 Doctor Joined Time
 *   AF=32 Call End Time
 *   AG=33 Final Status
 *   AH=34 Remarks (Phlebo Error)
 *   AI=35 Error Related To (Phlebo)
 *   AJ=36 Case status
 *   AK=37 Live call joinned by
 *   AL=38 AI Status
 *   AM=39 Meetind ID        ← Meeting ID written by this script
 *   AN=40 DOCTOR LINK       ← Doctor link written by this script
 *   AO=41 PATIENT LINK      ← Patient link written by this script
 *   AP=42 STATUS            ← Status updated by backend webhook (CREATED/IN_PROGRESS/COMPLETED/DISABLED)
 *   AQ=43 RECORDING         ← Recording URL written by backend webhook
 *
 * ─── SETUP (one-time, done by developer — not ops) ───────────────────────────
 * 1. Open the PPMC sheet → Extensions → Apps Script
 * 2. Paste this entire file, replacing any existing code. Save.
 * 3. Set Script Properties (Project Settings → Script Properties):
 *      BACKEND_URL       e.g. https://ppmc-backend.yourdomain.com
 *      PPMC_SHARED_KEY   same value as PPMC_SHARED_KEY in backend/.env
 *      WEBAPP_SECRET     same value as APPSCRIPT_SECRET in backend/.env
 * 4. Run generateLinks once to trigger the OAuth consent screen.
 * 5. Deploy as Web App:
 *      Execute as: Me
 *      Access: Anyone
 *    Copy the /exec URL → paste into APPSCRIPT_WEBAPP_URL in backend/.env
 * ─────────────────────────────────────────────────────────────────────────────
 */

// Column indices (1-based, for getRange)
var COL_POLICY_NO   = 3;   // C — Policy No. (must be present; rows without it are skipped)
var COL_AFTER5      = 23;  // W — after-5PM switch (ACTIVE/DEACTIVE dropdown)
var COL_NAME        = 4;   // D — patient name
var COL_DOCTOR      = 21;  // U — doctor name
var COL_MEETING_ID  = 39;  // AM
var COL_DOCTOR_LINK = 40;  // AN
var COL_PATIENT_LINK= 41;  // AO
var COL_STATUS      = 42;  // AP
var COL_RECORDING   = 43;  // AQ

// ── 1. Custom menu ────────────────────────────────────────────────────────────

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("PPMC")
    .addItem("Generate links for this sheet", "generateLinks")
    .addItem("Refresh recording status", "refreshStatus")
    .addItem("Fetch recording for a Meeting ID", "fetchRecordingById")
    .addToUi();
}

/**
 * Scans the currently active sheet tab for rows that:
 *   - have a patient Name (col D) filled in
 *   - do NOT already have a Meeting ID (col AM)
 * Creates a VideoSDK room for each such row and writes back the meeting ID,
 * doctor link, patient link, and status "CREATED".
 */
function generateLinks() {
  var ui    = SpreadsheetApp.getUi();
  var sheet = SpreadsheetApp.getActiveSheet();
  var props = PropertiesService.getScriptProperties();

  var backendUrl = props.getProperty("BACKEND_URL");
  var ppmcKey    = props.getProperty("PPMC_SHARED_KEY");

  if (!backendUrl || !ppmcKey) {
    ui.alert("Script Properties not configured. Set BACKEND_URL and PPMC_SHARED_KEY.");
    return;
  }

  // Collect rows that need links (name present, meeting ID absent)
  var lastRow   = sheet.getLastRow();
  var allValues = sheet.getDataRange().getValues();  // 0-indexed
  var rowsToFill = [];  // [{rowIndex (1-based), patientName, doctorName}]

  for (var i = 1; i < allValues.length; i++) {  // skip header row 0
    var policyNo    = String(allValues[i][COL_POLICY_NO - 1]  || "").trim();
    var meetingId   = String(allValues[i][COL_MEETING_ID - 1] || "").trim();

    // Skip rows with no Policy No. (empty/incomplete rows) or already have a link
    if (!policyNo || meetingId) continue;

    var patientName = String(allValues[i][COL_NAME   - 1] || "").trim() || "Patient";
    var doctorName  = String(allValues[i][COL_DOCTOR - 1] || "").trim() || "Doctor";

    rowsToFill.push({
      rowIndex:    i + 1,  // convert to 1-based sheet row
      policyNo:    policyNo,
      patientName: patientName,
      doctorName:  doctorName,
    });
  }

  if (rowsToFill.length === 0) {
    ui.alert("No rows found that need links.\n\nAll rows with a patient name already have a Meeting ID, or no patient names were found.");
    return;
  }

  var confirm = ui.alert(
    "Generate Links",
    "Found " + rowsToFill.length + " row(s) without links on sheet \"" + sheet.getName() + "\".\nGenerate now?",
    ui.ButtonSet.YES_NO
  );
  if (confirm !== ui.Button.YES) return;

  // Call backend in batches of 50 (API cap)
  var BATCH = 50;
  var allResults = [];

  for (var start = 0; start < rowsToFill.length; start += BATCH) {
    var batch = rowsToFill.slice(start, start + BATCH);
    // policyNo is stamped onto the VideoSDK room as customRoomId "PPMC_<policyNo>".
    // That is the only place it is stored — the backend reads it back off the room
    // when the recording finishes and forwards it to QC. Rows deleted from this
    // sheet later cannot break that handoff.
    var sessionsPayload = batch.map(function(r) {
      return { policyNo: r.policyNo, patientName: r.patientName, doctorName: r.doctorName };
    });

    var response;
    try {
      response = UrlFetchApp.fetch(backendUrl + "/api/v1/ppmc/embed/bulk", {
        method:          "post",
        contentType:     "application/json",
        headers:         { "X-PPMC-Key": ppmcKey },
        payload:         JSON.stringify({ sessions: sessionsPayload }),
        muteHttpExceptions: true,
      });
    } catch (e) {
      ui.alert("Network error calling backend:\n" + e.message);
      return;
    }

    if (response.getResponseCode() !== 200) {
      ui.alert("Backend error " + response.getResponseCode() + ":\n" + response.getContentText());
      return;
    }

    var batchResults;
    try {
      batchResults = JSON.parse(response.getContentText());
    } catch (e) {
      ui.alert("Could not parse backend response.");
      return;
    }

    // Write results back to each row immediately (don't wait for all batches)
    for (var j = 0; j < batchResults.length; j++) {
      var result = batchResults[j];
      var rowIdx = batch[j].rowIndex;
      sheet.getRange(rowIdx, COL_MEETING_ID).setValue(result.meetingId);
      sheet.getRange(rowIdx, COL_DOCTOR_LINK).setValue(result.doctorLink);
      sheet.getRange(rowIdx, COL_PATIENT_LINK).setValue(result.patientLink);
      sheet.getRange(rowIdx, COL_STATUS).setValue("CREATED");
    }

    allResults = allResults.concat(batchResults);
    SpreadsheetApp.flush();  // force write to sheet after each batch
  }

  ui.alert("Done! " + allResults.length + " link(s) generated and written to the sheet.");
}

// ── 2. Refresh recording status (PULL model — no web app deployment needed) ───

/**
 * Scans the active sheet for rows that have a Meeting ID but no Recording URL yet.
 * Calls the backend /api/v1/ppmc/recordings for each and writes the URL + COMPLETED status.
 * Ops runs this from the PPMC menu after sessions are done.
 */
function refreshStatus() {
  var ui    = SpreadsheetApp.getUi();
  var sheet = SpreadsheetApp.getActiveSheet();
  var props = PropertiesService.getScriptProperties();

  var backendUrl = props.getProperty("BACKEND_URL");
  var ppmcKey    = props.getProperty("PPMC_SHARED_KEY");

  if (!backendUrl || !ppmcKey) {
    ui.alert("Script Properties not configured. Set BACKEND_URL and PPMC_SHARED_KEY.");
    return;
  }

  var values   = sheet.getDataRange().getValues();
  var rowMap   = {};  // meetingId → row index (1-based)

  for (var i = 1; i < values.length; i++) {
    var meetingId    = String(values[i][COL_MEETING_ID - 1] || "").trim();
    var recordingUrl = String(values[i][COL_RECORDING  - 1] || "").trim();
    if (meetingId && !recordingUrl) {
      rowMap[meetingId] = i + 1;  // 1-based row index
    }
  }

  var meetingIds = Object.keys(rowMap);
  if (meetingIds.length === 0) {
    ui.alert("No rows found that need a recording URL.");
    return;
  }

  // Single call — backend queries VideoSDK in parallel for all IDs
  var response;
  try {
    response = UrlFetchApp.fetch(backendUrl + "/api/v1/ppmc/recordings/bulk", {
      method:             "post",
      contentType:        "application/json",
      headers:            { "X-PPMC-Key": ppmcKey },
      payload:            JSON.stringify({ meetingIds: meetingIds }),
      muteHttpExceptions: true,
    });
  } catch (e) {
    ui.alert("Network error: " + e.message);
    return;
  }

  if (response.getResponseCode() !== 200) {
    ui.alert("Backend error " + response.getResponseCode() + ":\n" + response.getContentText());
    return;
  }

  var results;
  try {
    results = JSON.parse(response.getContentText());
  } catch (e) {
    ui.alert("Could not parse backend response.");
    return;
  }

  var updated  = 0;
  var notReady = 0;

  results.forEach(function(r) {
    var rowIdx = rowMap[r.meetingId];
    if (!rowIdx) return;
    if (r.found && r.fileUrl) {
      sheet.getRange(rowIdx, COL_RECORDING).setValue(r.fileUrl);
      sheet.getRange(rowIdx, COL_STATUS).setValue("COMPLETED");
      updated++;
    } else {
      notReady++;
    }
  });

  SpreadsheetApp.flush();

  var msg = updated + " row(s) updated with recording URL.";
  if (notReady > 0) msg += "\n" + notReady + " session(s) not ready yet — try again in a few minutes.";
  ui.alert(msg);
}

// ── 3. Fetch recording for a specific Meeting ID ──────────────────────────────

/**
 * Prompts ops to enter a Meeting ID, fetches its recording from the backend,
 * and updates the matching row in ANY sheet tab of this spreadsheet.
 */
function fetchRecordingById() {
  var ui    = SpreadsheetApp.getUi();
  var props = PropertiesService.getScriptProperties();

  var backendUrl = props.getProperty("BACKEND_URL");
  var ppmcKey    = props.getProperty("PPMC_SHARED_KEY");

  if (!backendUrl || !ppmcKey) {
    ui.alert("Script Properties not configured. Set BACKEND_URL and PPMC_SHARED_KEY.");
    return;
  }

  var resp = ui.prompt(
    "Fetch Recording",
    "Enter the Meeting ID:",
    ui.ButtonSet.OK_CANCEL
  );
  if (resp.getSelectedButton() !== ui.Button.OK) return;

  var meetingId = resp.getResponseText().trim();
  if (!meetingId) {
    ui.alert("No Meeting ID entered.");
    return;
  }

  var response;
  try {
    response = UrlFetchApp.fetch(backendUrl + "/api/v1/ppmc/recordings", {
      method:             "post",
      contentType:        "application/json",
      headers:            { "X-PPMC-Key": ppmcKey },
      payload:            JSON.stringify({ meetingId: meetingId }),
      muteHttpExceptions: true,
    });
  } catch (e) {
    ui.alert("Network error: " + e.message);
    return;
  }

  if (response.getResponseCode() !== 200) {
    ui.alert("Backend error " + response.getResponseCode() + ":\n" + response.getContentText());
    return;
  }

  var result;
  try {
    result = JSON.parse(response.getContentText());
  } catch (e) {
    ui.alert("Could not parse backend response.");
    return;
  }

  if (!result.found || !result.fileUrl) {
    ui.alert("Recording not ready yet for Meeting ID: " + meetingId + "\n\nTry again in a few minutes.");
    return;
  }

  // Search ALL sheet tabs for the matching Meeting ID row
  var ss      = SpreadsheetApp.getActiveSpreadsheet();
  var sheets  = ss.getSheets();
  var updated = false;

  for (var s = 0; s < sheets.length; s++) {
    var sheet  = sheets[s];
    var values = sheet.getDataRange().getValues();

    for (var i = 1; i < values.length; i++) {
      if (String(values[i][COL_MEETING_ID - 1] || "").trim() === meetingId) {
        sheet.getRange(i + 1, COL_RECORDING).setValue(result.fileUrl);
        sheet.getRange(i + 1, COL_STATUS).setValue("COMPLETED");
        SpreadsheetApp.flush();
        ui.alert(
          "Done!\n\n" +
          "Meeting ID: " + meetingId + "\n" +
          "Sheet: " + sheet.getName() + " (row " + (i + 1) + ")\n" +
          "Recording URL: " + result.fileUrl
        );
        updated = true;
        break;
      }
    }
    if (updated) break;
  }

  if (!updated) {
    ui.alert(
      "Recording found but no matching row in any sheet tab.\n\n" +
      "Meeting ID: " + meetingId + "\n" +
      "Recording URL: " + result.fileUrl + "\n\n" +
      "Copy the URL manually if needed."
    );
  }
}

// ── 4. doPost — backend writes status / recording URL back to the sheet ───────

/**
 * Deploy as Web App (Execute as: Me, Access: Anyone).
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
    return _json({ error: "invalid JSON" });
  }

  if (!secret || data.secret !== secret) {
    return _json({ error: "forbidden" });
  }

  // Backend pulls the meetingIds whose after-5PM switch (col W) is ACTIVE.
  if (data.action === "listActive") {
    return _json({ meetingIds: listActiveMeetingIds() });
  }

  if (!data.meetingId) {
    return _json({ error: "meetingId required" });
  }

  // Search ALL sheets in the spreadsheet (ops may have the wrong tab active)
  var ss      = SpreadsheetApp.getActiveSpreadsheet();
  var sheets  = ss.getSheets();
  var updated = false;

  for (var s = 0; s < sheets.length && !updated; s++) {
    var sheet  = sheets[s];
    var values = sheet.getDataRange().getValues();

    for (var i = 1; i < values.length; i++) {  // skip header
      if (String(values[i][COL_MEETING_ID - 1] || "") === data.meetingId) {
        if (data.status !== undefined) {
          sheet.getRange(i + 1, COL_STATUS).setValue(data.status);
        }
        if (data.recordingUrl !== undefined && data.recordingUrl !== "") {
          sheet.getRange(i + 1, COL_RECORDING).setValue(data.recordingUrl);
        }
        updated = true;
        break;
      }
    }
  }

  if (!updated) {
    Logger.log("doPost: meetingId not found in any sheet: " + data.meetingId);
  }

  return _json({ ok: true, updated: updated });
}

/** Rows (any tab) with a Meeting ID whose col-W switch reads ACTIVE. */
function listActiveMeetingIds() {
  var ids    = [];
  var sheets = SpreadsheetApp.getActiveSpreadsheet().getSheets();

  for (var s = 0; s < sheets.length; s++) {
    var values = sheets[s].getDataRange().getValues();
    for (var i = 1; i < values.length; i++) {  // skip header
      var flag      = String(values[i][COL_AFTER5     - 1] || "").trim().toUpperCase();
      var meetingId = String(values[i][COL_MEETING_ID - 1] || "").trim();
      if (flag === "ACTIVE" && meetingId) ids.push(meetingId);
    }
  }
  return ids;
}

function _json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

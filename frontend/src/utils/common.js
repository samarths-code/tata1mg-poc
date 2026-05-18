export const json_verify = (s) => {
  try {
    JSON.parse(s);
    return true;
  } catch (e) {
    return false;
  }
};

export function getQualityScore(stats) {
  const packetLossPercent = stats.packetsLost / stats.totalPackets || 0;
  const jitter = stats.jitter;
  const rtt = stats.rtt;
  let score = 100;
  score -= packetLossPercent * 50 > 50 ? 50 : packetLossPercent * 50;
  score -= ((jitter / 30) * 25 > 25 ? 25 : (jitter / 30) * 25) || 0;
  score -= ((rtt / 300) * 25 > 25 ? 25 : (rtt / 300) * 25) || 0;
  return score / 10;
}

export function formatAMPM(date) {
  var hours = date.getHours();
  var minutes = date.getMinutes();
  var ampm = hours >= 12 ? "pm" : "am";
  hours = hours % 12;
  hours = hours ? hours : 12;
  minutes = minutes < 10 ? "0" + minutes : minutes;
  var strTime = hours + ":" + minutes + " " + ampm;
  return strTime;
}

export const trimSnackBarText = (text = "") => {
  const maxLength = 52;
  return text.length > maxLength ? `${text.substr(0, maxLength - 5)}...` : text;
};

export const nameTructed = (name, tructedLength) => {
  if (name?.length > tructedLength) {
    if (tructedLength === 15) {
      return `${name.substr(0, 12)}...`;
    } else {
      return `${name.substr(0, tructedLength)}...`;
    }
  } else {
    return name;
  }
};

export const sideBarModes = {
  PARTICIPANTS: "PARTICIPANTS",
  CHAT: "CHAT",
  IMAGE_PANEL: "IMAGE PREVIEW PANEL",
  DOCUMENT_PANEL: "DOCUMENT PANEL",
  LAYOUT: "LAYOUT",
};

export const meetingModes = {
  SCREEN_SHARE: "SCREEN_SHARE",
  SEND_AND_RECV: "SEND_AND_RECV",
};

// MER roles: DOCTOR (host) and CUSTOMER (participant)
export const participantModes = {
  DOCTOR: "DOCTOR",
  CUSTOMER: "CUSTOMER",
  // Legacy aliases so shared components still compile
  AGENT: "DOCTOR",
  CLIENT: "CUSTOMER",
};


export const meetingLeftReasons = {
  LEFT: "LEFT",
  KICKOUT: "KICKOUT",
  END: "END",
  TAB_BROWSER_CLOSED: "TAB_BROWSER_CLOSED",
};

export const meetingLayoutTopics = {
  MEETING_LAYOUT: "MEETING_LAYOUT",
  RECORDING_LAYOUT: "RECORDING_LAYOUT",
};

export function debounce(func, wait, immediate) {
  var timeout;
  return function executedFunction() {
    var context = this;
    var args = arguments;
    var later = function () {
      timeout = null;
      if (!immediate) func.apply(context, args);
    };
    var callNow = immediate && !timeout;
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
    if (callNow) func.apply(context, args);
  };
}

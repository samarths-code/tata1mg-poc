import React, { Suspense, lazy, useEffect, useState } from "react";
import PermissionSetup from "./components/PermissionSetup";

// Route-level code splitting. This module must NOT import @videosdk.live —
// the SDK is ~860 KB of source and only the call itself needs it. Keeping it
// out of the entry chunk means the create-meeting page, the thank-you page and
// the permission gate all paint on a slow link long before the SDK arrives.
const CreateMeetingPage = lazy(() => import("./components/CreateMeetingPage"));
const LeaveScreen = lazy(() =>
  import("./components/screens/LeaveScreen").then((m) => ({ default: m.LeaveScreen }))
);
const CallApp = lazy(() => import("./App"));

const loadCallApp = () => import("./App");

function Splash() {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <span className="w-8 h-8 rounded-full border-2 border-orange-450 border-t-transparent animate-spin" />
    </div>
  );
}

// Permission prompts need no SDK, so they run while the call chunk downloads
// in the background — on a weak connection that overlap hides most of the wait.
function CallRoute({ isAudioOnly }) {
  const [permissionsReady, setPermissionsReady] = useState(false);

  useEffect(() => {
    loadCallApp();
  }, []);

  return (
    <div className="bg-white min-h-screen">
      {!permissionsReady && (
        <PermissionSetup audioOnly={isAudioOnly} onDone={() => setPermissionsReady(true)} />
      )}
      {permissionsReady && (
        <Suspense fallback={<Splash />}>
          <CallApp />
        </Suspense>
      )}
    </div>
  );
}

export default function AppRouter() {
  const path = window.location.pathname;
  const sp = new URLSearchParams(window.location.search);

  let route;
  if (path === "/thank-you") {
    route = <LeaveScreen />;
  } else if (path === "/create-meeting" || !sp.get("meetingId") || !sp.get("mode")) {
    // Any other visit to "/" (direct, bookmark, no params) shows create-meeting.
    route = <CreateMeetingPage />;
  } else {
    return <CallRoute isAudioOnly={sp.get("callType") === "audio"} />;
  }

  return <Suspense fallback={<Splash />}>{route}</Suspense>;
}

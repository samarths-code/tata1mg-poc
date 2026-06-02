import React from "react";
import "./index.css";
import App from "./App";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { createRoot } from "react-dom/client";

const container = document.getElementById("root");
const root = createRoot(container);

root.render(
  <>
    <ToastContainer
      toastClassName={() =>
        "relative flex items-center gap-3 py-3 px-4 rounded-xl overflow-hidden cursor-pointer " +
        "bg-[#1e2026] border border-white/[0.07] shadow-2xl"
      }
      bodyClassName={() => "text-white text-sm font-normal leading-5 flex-1"}
      position="bottom-left"
      autoClose={4000}
      hideProgressBar={false}
      progressClassName="bg-[#ff6f61] opacity-30 h-0.5"
      newestOnTop={false}
      closeButton={false}
      closeOnClick
      rtl={false}
      pauseOnFocusLoss
      draggable
      pauseOnHover
      theme="dark"
    />
    <App />
  </>
);

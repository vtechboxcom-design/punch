import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { storage } from "./storage.js";
import "./index.css";

// The App component was originally built against the Claude-artifact
// window.storage API. Providing a real, IndexedDB-backed implementation of
// that same API here means the component code didn't need to change at all
// to become a genuine offline-first local web app.
window.storage = storage;

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./lib/shortcut/register";
import { initLogging } from "./lib/logging/logger";
import { ThemeProvider } from "./lib/theme/context";

initLogging();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </React.StrictMode>,
);

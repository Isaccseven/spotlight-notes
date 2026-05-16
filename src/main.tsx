import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { initShortcutBridge } from "./lib/shortcut/bridge";
import { initLogging } from "./lib/logging/logger";
import { ThemeProvider } from "./lib/theme/context";
import { PluginProvider } from "./lib/plugin/context";

initLogging();
initShortcutBridge();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ThemeProvider>
      <PluginProvider>
        <App />
      </PluginProvider>
    </ThemeProvider>
  </React.StrictMode>,
);

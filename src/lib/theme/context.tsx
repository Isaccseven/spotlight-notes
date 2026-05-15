import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { listen } from "@tauri-apps/api/event";

interface ThemeContextValue {
  isDark: boolean;
  setIsDark: (value: boolean) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  isDark: true,
  setIsDark: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    const unlisten = listen<boolean>("theme-changed", (event) => {
      setIsDark(event.payload);
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  return (
    <ThemeContext.Provider value={{ isDark, setIsDark }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

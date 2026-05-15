import { useState, useEffect } from "react";
import { useTheme } from "@/lib/theme/context";

export default function Shell({ children }: { children: React.ReactNode }) {
  const [isVisible, setIsVisible] = useState(false);
  const { isDark } = useTheme();

  useEffect(() => {
    setIsVisible(true);
  }, []);

  return (
    <div className="w-screen flex items-start justify-center p-3">
      <div
        className={`
          relative
          backdrop-blur-2xl
          rounded-2xl
          shadow-2xl
          w-full max-w-[640px]
          border
          transition-all duration-300 ease-out
          ${isVisible ? "opacity-100 scale-100" : "opacity-0 scale-95"}
          ${isDark ? "bg-[#1a1a1a]/90 border-white/10" : "bg-white/90 border-black/10"}
        `}
      >
        {children}
      </div>
    </div>
  );
}

import { useState, useEffect } from "react";

export default function Shell({ children }: { children: React.ReactNode }) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  return (
    <div className="w-screen flex items-start justify-center p-3">
      <div
        className={`
          bg-[#1a1a1a]/90 backdrop-blur-2xl 
          rounded-2xl 
          shadow-2xl 
          w-full max-w-[640px]
          border border-white/10
          transition-all duration-300 ease-out
          ${isVisible ? "opacity-100 scale-100" : "opacity-0 scale-95"}
        `}
      >
        {children}
      </div>
    </div>
  );
}

export default function PinIcon({ filled = false }: { filled?: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="2"
      className="text-white/60"
    >
      <path d="M12 2v8" />
      <path d="m16 6-8 8" />
      <path d="m8 6 8 8" />
      <path d="M12 14v8" />
    </svg>
  );
}

import React from "react";

const variants = {
  primary: "bg-blue-600 text-white hover:bg-blue-700",
  secondary: "bg-gray-200 text-gray-800 hover:bg-gray-300",
};

const sizes = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
  lg: "px-5 py-3 text-base",
};

export default function Button({
  children,
  onClick,
  variant = "primary",
  icon: Icon,
  className = "",
  type = "button",
  size = "md",
}) {
  //perf: focus ring visibile, nessun style inline
  const base =
    "inline-flex items-center justify-center gap-2 rounded-xl text-sm font-medium transition active:translate-y-[1px] focus:ring-2 focus:ring-blue-600 focus:outline-none";

  return (
    <button
      type={type}
      onClick={onClick}
      className={[
        base,
        sizes[size] || sizes.md,
        variants[variant],
        className,
      ].join(" ")}
      role="button"
      tabIndex={0}
    >
      {Icon && <Icon size={16} />}
      {children}
    </button>
  );
}
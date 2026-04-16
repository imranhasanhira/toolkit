import React from "react";

type AvatarProps = {
  url?: string | null;
  name: string;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
};

export function ParentAvatar({ url, name, size = "md", className = "" }: AvatarProps) {
  const initials = name.substring(0, 2).toUpperCase();
  const sizeClasses = {
    sm: "w-8 h-8 text-xs",
    md: "w-12 h-12 text-base",
    lg: "w-16 h-16 text-xl",
    xl: "w-24 h-24 text-3xl",
  }[size];

  return (
    <div className={`rounded-full shrink-0 flex items-center justify-center font-jakarta font-bold text-[color:var(--color-carely-primary)] bg-[color:var(--color-carely-tertiary)] overflow-hidden border border-[color:var(--color-carely-surface-high)] ${sizeClasses} ${className}`}>
      {url ? <img src={url} alt={name} className="w-full h-full object-cover" /> : initials}
    </div>
  );
}

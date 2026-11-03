"use client";

export function ConfirmButton({ message, children, className = "btn-ghost" }: { message: string; children: React.ReactNode; className?: string }) {
  return (
    <button
      className={className}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}

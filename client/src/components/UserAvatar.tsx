import { useState } from "react";
import type { UserAvatar as UserAvatarType } from "../types";

function userIniciales(nombre: string): string {
  const parts = nombre.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

interface Props {
  nombre: string;
  avatar: UserAvatarType;
  size?: "sm" | "lg";
  showLock?: boolean;
  className?: string;
}

export default function UserAvatar({
  nombre,
  avatar,
  size = "sm",
  showLock = false,
  className = "",
}: Props) {
  const [imgError, setImgError] = useState(false);
  const showFoto = avatar.tipo === "foto" && avatar.url && !imgError;
  const sizeClass = size === "lg" ? "main-header-user-avatar--lg" : "";

  return (
    <span className={`main-header-user-avatar-btn${className ? ` ${className}` : ""}`} aria-hidden>
      <span
        className={`main-header-user-avatar ${sizeClass}${
          showFoto ? " main-header-user-avatar--foto" : ""
        }`}
      >
        {showFoto ? (
          <img
            src={avatar.url!}
            alt=""
            className="main-header-user-avatar-img"
            onError={() => setImgError(true)}
          />
        ) : (
          userIniciales(nombre)
        )}
      </span>
      {showLock && (
        <span className="main-header-user-avatar-lock" aria-hidden>
          <svg width="8" height="8" viewBox="0 0 24 24" fill="none">
            <path
              d="M7 11V8a5 5 0 0 1 10 0v3"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <rect
              x="5"
              y="11"
              width="14"
              height="10"
              rx="2"
              stroke="currentColor"
              strokeWidth="2"
            />
          </svg>
        </span>
      )}
    </span>
  );
}

export function userInicialesFromNombre(nombre: string): string {
  return userIniciales(nombre);
}

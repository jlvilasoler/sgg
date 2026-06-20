import { useState } from "react";
import type { UserAvatar as UserAvatarType } from "../types";

export const DEFAULT_USER_AVATAR: UserAvatarType = { tipo: "iniciales", url: null };

function userIniciales(nombre: string): string {
  const parts = nombre.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export type UserAvatarVariant =
  | "header-sm"
  | "header-lg"
  | "chat-channel"
  | "chat-bubble"
  | "list";

interface Props {
  nombre: string;
  avatar?: UserAvatarType | null;
  variant?: UserAvatarVariant;
  /** @deprecated Usar variant="header-lg" */
  size?: "sm" | "lg";
  showLock?: boolean;
  className?: string;
}

function circleClass(variant: UserAvatarVariant, showFoto: boolean): string {
  const foto = showFoto ? " user-avatar--foto" : "";
  switch (variant) {
    case "header-lg":
      return `main-header-user-avatar main-header-user-avatar--lg${foto}`;
    case "chat-channel":
      return `chat-interno-channel-avatar${foto}`;
    case "chat-bubble":
      return `chat-interno-bubble-avatar${foto}`;
    case "list":
      return `usuarios-table-avatar${foto}`;
    default:
      return `main-header-user-avatar${foto}`;
  }
}

function wrapClass(variant: UserAvatarVariant): string {
  if (variant === "header-sm" || variant === "header-lg") {
    return "main-header-user-avatar-btn";
  }
  return "user-avatar-wrap";
}

export default function UserAvatar({
  nombre,
  avatar,
  variant,
  size = "sm",
  showLock = false,
  className = "",
}: Props) {
  const [imgError, setImgError] = useState(false);
  const resolvedVariant: UserAvatarVariant =
    variant ?? (size === "lg" ? "header-lg" : "header-sm");
  const av = avatar ?? DEFAULT_USER_AVATAR;
  const showFoto = av.tipo === "foto" && !!av.url && !imgError;

  return (
    <span
      className={`${wrapClass(resolvedVariant)}${className ? ` ${className}` : ""}`}
      aria-hidden
    >
      <span className={circleClass(resolvedVariant, showFoto)}>
        {showFoto ? (
          <img
            key={av.url}
            src={av.url!}
            alt=""
            className="user-avatar-img"
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

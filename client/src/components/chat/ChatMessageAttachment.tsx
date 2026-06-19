import type { ChatMessageAttachment } from "../../types";
import { chatAttachmentUrl } from "../../api";

function formatTamano(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileIcon(mime: string): string {
  if (mime.includes("pdf")) return "PDF";
  if (mime.includes("word") || mime.includes("document")) return "DOC";
  if (mime.includes("sheet") || mime.includes("excel")) return "XLS";
  if (mime.includes("presentation") || mime.includes("powerpoint")) return "PPT";
  if (mime.includes("zip") || mime.includes("rar")) return "ZIP";
  if (mime.startsWith("text/")) return "TXT";
  return "FILE";
}

interface Props {
  messageId: number;
  attachment: ChatMessageAttachment;
  onImageClick?: (url: string) => void;
}

export default function ChatMessageAttachmentView({
  messageId,
  attachment,
  onImageClick,
}: Props) {
  const url = chatAttachmentUrl(messageId);

  if (attachment.tipo === "imagen") {
    return (
      <button
        type="button"
        className="chat-interno-bubble-image-btn"
        onClick={() => onImageClick?.(url)}
        title="Ver imagen"
      >
        <img
          className="chat-interno-bubble-image"
          src={url}
          alt={attachment.nombre}
          loading="lazy"
        />
      </button>
    );
  }

  return (
    <a
      className="chat-interno-bubble-file"
      href={url}
      download={attachment.nombre}
      target="_blank"
      rel="noopener noreferrer"
    >
      <span className="chat-interno-bubble-file-icon" aria-hidden>
        {fileIcon(attachment.mime)}
      </span>
      <span className="chat-interno-bubble-file-meta">
        <span className="chat-interno-bubble-file-name">{attachment.nombre}</span>
        <span className="chat-interno-bubble-file-size">{formatTamano(attachment.tamano)}</span>
      </span>
      <span className="chat-interno-bubble-file-dl" aria-hidden>
        ↓
      </span>
    </a>
  );
}

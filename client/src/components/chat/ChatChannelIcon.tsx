/** Burbuja de chat con tres puntos (canal / conversación grupal). */
export default function ChatChannelIcon() {
  return (
    <svg
      className="chat-channel-icon"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <path
        className="chat-channel-icon-bubble"
        d="M5.25 4.75h13.5a2.25 2.25 0 0 1 2.25 2.25v7.25a2.25 2.25 0 0 1-2.25 2.25H10.5l-3.25 2.75v-2.75H5.25a2.25 2.25 0 0 1-2.25-2.25V7a2.25 2.25 0 0 1 2.25-2.25z"
      />
      <circle className="chat-channel-icon-dot" cx="9.25" cy="10.5" r="1.2" />
      <circle className="chat-channel-icon-dot" cx="12" cy="10.5" r="1.2" />
      <circle className="chat-channel-icon-dot" cx="14.75" cy="10.5" r="1.2" />
    </svg>
  );
}

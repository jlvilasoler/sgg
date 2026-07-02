/** Red comunitaria: burbuja + 4 personas + anillo (alto contraste, estilo editorial). */
export default function ChatExternalPeopleIcon() {
  const person = (
    <>
      <circle className="chat-external-people-icon-head" cy="0" r="4.65" />
      <path
        className="chat-external-people-icon-shoulders"
        d="M-7.2 12.2c0-4.1 3.2-7.4 7.2-7.4s7.2 3.3 7.2 7.4"
      />
    </>
  );

  return (
    <svg
      className="chat-external-people-icon"
      width="34"
      height="34"
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden
    >
      <defs>
        <radialGradient id="chat-ext-icon-glow" cx="50%" cy="52%" r="50%">
          <stop offset="0%" stopColor="var(--bn-gold)" stopOpacity="0.22" />
          <stop offset="100%" stopColor="var(--bn-gold)" stopOpacity="0" />
        </radialGradient>
      </defs>

      <circle className="chat-external-people-icon-halo" cx="32" cy="33" r="15" fill="url(#chat-ext-icon-glow)" />

      <circle className="chat-external-people-icon-ring" cx="32" cy="32" r="21.8" />

      <path
        className="chat-external-people-icon-bubble"
        d="M20.5 27.2h23.2a4.2 4.2 0 0 1 4.2 4.2v10.2a4.2 4.2 0 0 1-4.2 4.2H39l5.4 5.9V46.2H28.8l-3.4 3.8v-3.8h-5.1a4.2 4.2 0 0 1-4.2-4.2V31.4a4.2 4.2 0 0 1 4.2-4.2z"
      />

      <path className="chat-external-people-icon-line" d="M24.8 33.8h14.6" />
      <path className="chat-external-people-icon-line chat-external-people-icon-line--mid" d="M24.8 37.6h12" />
      <path className="chat-external-people-icon-line chat-external-people-icon-line--short" d="M24.8 41.4h8.8" />

      <g className="chat-external-people-icon-person" transform="translate(32 7.8)">
        {person}
      </g>
      <g className="chat-external-people-icon-person" transform="translate(56.2 32)">
        {person}
      </g>
      <g className="chat-external-people-icon-person" transform="translate(32 56.2)">
        {person}
      </g>
      <g className="chat-external-people-icon-person" transform="translate(7.8 32)">
        {person}
      </g>
    </svg>
  );
}

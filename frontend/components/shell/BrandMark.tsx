/** Mark: a risk ruler crossing a decision threshold. */
export default function BrandMark() {
  return (
    <svg className="brand-mark" viewBox="0 0 26 26" aria-hidden>
      <rect x="0.5" y="0.5" width="25" height="25" rx="5" fill="#131821" stroke="#2b3440" />
      <rect x="5" y="16" width="3" height="5" rx="0.6" fill="#3dbe8b" />
      <rect x="10" y="12" width="3" height="9" rx="0.6" fill="#3dbe8b" />
      <rect x="15" y="9" width="3" height="12" rx="0.6" fill="#ef5f5a" />
      <line x1="4" y1="13.5" x2="22" y2="13.5" stroke="#8aa8ff" strokeWidth="1.2" strokeDasharray="1.6 1.4" />
      <circle cx="20.5" cy="6" r="1.8" fill="#8aa8ff" />
    </svg>
  );
}

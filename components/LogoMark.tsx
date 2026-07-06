// The fanned-deck brand mark — same drawing as app/icon.svg, minus the tile.
export default function LogoMark({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="8 8 48 48" aria-hidden>
      <rect x="13" y="13" width="25" height="33" rx="4.5" fill="#3d3d3d" transform="rotate(-12 25.5 29.5)" />
      <rect x="19" y="14" width="25" height="33" rx="4.5" fill="#7a7a7a" transform="rotate(-3 31.5 30.5)" />
      <g transform="rotate(7 38.5 33.5)">
        <rect x="26" y="17" width="25" height="33" rx="4.5" fill="#ffffff" />
        <rect x="30" y="22.5" width="13.5" height="5" rx="2" fill="#2563eb" />
        <rect x="30" y="31.5" width="17" height="2.8" rx="1.4" fill="#191919" />
        <rect x="30" y="36.6" width="17" height="2.8" rx="1.4" fill="#191919" />
        <rect x="30" y="41.7" width="11" height="2.8" rx="1.4" fill="#a3a3a3" />
      </g>
    </svg>
  );
}

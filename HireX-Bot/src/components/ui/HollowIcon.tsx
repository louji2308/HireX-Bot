export type HollowIconName =
  | 'command'
  | 'opportunities'
  | 'studio'
  | 'proof'
  | 'passport'
  | 'inspector';

const ICON_PATHS: Record<HollowIconName, React.ReactNode> = {
  command: (
    <path d="M9 6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6Z" />
  ),
  opportunities: (
    <>
      <circle cx="12" cy="12" r="8.25" />
      <path d="m14.8 9.2-1.7 3.9-3.9 1.7 1.7-3.9 3.9-1.7Z" />
    </>
  ),
  studio: (
    <>
      <path d="m8.5 8.5-4 3.5 4 3.5" />
      <path d="m15.5 8.5 4 3.5-4 3.5" />
      <path d="m13.5 5-3 14" />
    </>
  ),
  proof: (
    <>
      <circle cx="7" cy="6" r="2.25" />
      <circle cx="7" cy="18" r="2.25" />
      <circle cx="17" cy="8" r="2.25" />
      <path d="M7 8.25v7.5" />
      <path d="M17 10.25c0 2.1-1.7 3.75-3.75 3.75H7" />
    </>
  ),
  passport: (
    <>
      <rect x="4" y="5" width="16" height="14" rx="2.25" />
      <circle cx="9" cy="11" r="1.75" />
      <path d="M6.5 16c.45-1.35 1.4-2 2.5-2s2.05.65 2.5 2" />
      <path d="M14 10h3.5M14 13h3.5M14 16h2" />
    </>
  ),
  inspector: (
    <>
      <circle cx="10.75" cy="10.75" r="5.75" />
      <path d="m15 15 4 4" />
    </>
  ),
};

export function HollowIcon({
  name,
  size = 20,
  strokeWidth = 1.25,
  className,
}: {
  readonly name: HollowIconName;
  readonly size?: number;
  readonly strokeWidth?: number;
  readonly className?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {ICON_PATHS[name]}
    </svg>
  );
}

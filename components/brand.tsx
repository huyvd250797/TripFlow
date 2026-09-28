import type { SVGProps } from "react";

export function BrandMark({
  className = "",
  ...props
}: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={`brand-mark ${className}`.trim()}
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <rect x="2" y="2" width="60" height="60" rx="18" fill="#0B6873" />
      <path
        d="M32 10.5c-10.08 0-18.25 7.93-18.25 17.71 0 12.56 14.75 24.72 17.02 26.49a2 2 0 0 0 2.46 0c2.27-1.77 17.02-13.93 17.02-26.49C50.25 18.43 42.08 10.5 32 10.5Z"
        fill="#F7FCFC"
      />
      <circle cx="32" cy="28" r="10.75" fill="#DDF5F1" />
      <path
        d="M23.9 30.7c3.5-6.7 6.35 5.15 10.25.55 2.2-2.6 3.5-6.65 6.1-8.4"
        fill="none"
        stroke="#FF9564"
        strokeWidth="3.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="23.9" cy="30.7" r="2.15" fill="#FF9564" />
      <circle cx="40.25" cy="22.85" r="2.15" fill="#FF9564" />
    </svg>
  );
}

export function BrandName() {
  return (
    <span className="brand-wordmark" aria-label="TripFlow">
      Trip<span>Flow</span>
    </span>
  );
}

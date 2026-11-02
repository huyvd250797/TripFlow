import type { SVGProps } from "react";

export function BrandMark({
  className = "",
  ...props
}: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 512 512"
      className={`brand-mark ${className}`.trim()}
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <image href="/icon.svg" width="512" height="512" />
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

import type { ReactNode } from 'react';
import { cx } from '../ui';

/**
 * Shared SVG refraction filters. Rendered once at app root; referenced by
 * CSS (`backdrop-filter: url(#ruh-lg)`). Two intensities: standard for
 * buttons/orbs, soft for large bars where heavy distortion would look noisy.
 */
export function GlassDefs() {
  return (
    <svg aria-hidden="true" width="0" height="0" style={{ position: 'absolute' }}>
      <defs>
        <filter id="ruh-lg" x="-20%" y="-20%" width="140%" height="140%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.012 0.018" numOctaves="2" seed="7" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="42" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        <filter id="ruh-lg-soft" x="-20%" y="-20%" width="140%" height="140%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.01 0.014" numOctaves="2" seed="11" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="18" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
    </svg>
  );
}

type GlassVariant = 'clear' | 'regular' | 'tinted';

export function GlassButton({ children, onClick, variant = 'regular', size = 'md', label, className, type = 'button', disabled }: {
  children: ReactNode;
  onClick?: () => void;
  variant?: GlassVariant;
  size?: 'circle' | 'md' | 'lg' | 'home';
  label?: string;
  className?: string;
  type?: 'button' | 'submit';
  disabled?: boolean;
}) {
  const sizes = {
    circle: 'h-[60px] w-[60px] rounded-full',
    md: 'h-11 rounded-full px-5 text-sm font-semibold',
    lg: 'h-[52px] rounded-full px-7 text-[15px] font-semibold',
    home: 'h-[60px] w-[60px] rounded-full',
  };
  const tones = {
    clear: 'lg-clear',
    regular: '',
    tinted: 'lg-tinted text-[#1c1500]',
  };
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      aria-label={label}
      className={cx('lg lg-btn text-[var(--ink)]', sizes[size], tones[variant], className)}
    >
      <span className="lg-content">{children}</span>
    </button>
  );
}

/** Frosted refractive container for floating toolbars / tab bars. */
export function GlassBar({ children, className, label }: { children: ReactNode; className?: string; label?: string }) {
  return <div role="toolbar" aria-label={label} className={cx('lg lg-soft', className)}>{children}</div>;
}

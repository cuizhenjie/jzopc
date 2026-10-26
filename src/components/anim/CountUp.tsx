'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { formatCountUp, mountCountUp, type CountUpAnimator } from './count-up-controller';

const animateCount: CountUpAnimator = ({ value, duration, onUpdate, onComplete }) => {
  const counter = { value: 0 };
  return gsap.to(counter, {
    value,
    duration,
    ease: 'power2.out',
    onUpdate: () => onUpdate(counter.value),
    onComplete,
  });
};

/** SSR and assistive technology always receive the final value. */
export default function CountUp({
  value,
  duration = 1.6,
  decimals = 0,
  prefix,
  suffix,
  className,
}: {
  value: number;
  duration?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}) {
  const numberRef = useRef<HTMLSpanElement>(null);
  const finalText = formatCountUp(value, decimals);

  useEffect(() => {
    const element = numberRef.current;
    if (!element) return;
    return mountCountUp(element, { value, duration, decimals }, animateCount);
  }, [value, duration, decimals]);

  return (
    <span className={className ? `${className} tnum` : 'tnum'} data-count-up="">
      {prefix}
      <span style={{ display: 'inline-grid', verticalAlign: 'baseline' }}>
        <span aria-hidden="true" style={{ gridArea: '1 / 1', visibility: 'hidden' }}>{finalText}</span>
        <span ref={numberRef} data-count-number="" aria-hidden="true" style={{ gridArea: '1 / 1', justifySelf: 'end' }}>{finalText}</span>
        <span className="sr-only">{finalText}</span>
      </span>
      <span data-count-suffix="">{suffix}</span>
    </span>
  );
}

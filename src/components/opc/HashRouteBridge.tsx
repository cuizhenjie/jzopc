'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { resolveReferenceLocation } from '@/lib/opc/routes';

export default function HashRouteBridge() {
  const router = useRouter();
  useEffect(() => {
    const navigate = () => {
      if (!window.location.hash.startsWith('#/')) return;
      const destination = resolveReferenceLocation(window.location.hash);
      if (destination) router.replace(destination, { scroll: true });
    };
    navigate();
    window.addEventListener('hashchange', navigate);
    return () => window.removeEventListener('hashchange', navigate);
  }, [router]);
  return null;
}

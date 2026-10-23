import { permanentRedirect } from 'next/navigation';

/** Retire the duplicate list; article routes and the dynamic community feed remain. */
export default function NewsPage() {
  permanentRedirect('/newslist');
}

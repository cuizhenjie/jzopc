import styles from './StaticWave.module.css';

/** Full-viewport SSR poster for the wave layer. No WebGL, animation or JS required. */
export function StaticWave({ className }: { className?: string }) {
  return (
    <div className={className} aria-hidden="true" data-wave-poster="true">
      <div className={styles.sea}>
        <div className={styles.glow} />
        <div className={styles.horizon} />
        <div className={styles.floor} />
        <div className={styles.floorNear} />
      </div>
    </div>
  );
}

export default StaticWave;

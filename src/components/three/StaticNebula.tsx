import styles from './StaticNebula.module.css';

/** Full SSR poster. No WebGL, browser state, external images or animation required. */
export function StaticNebula({ className }: { className?: string }) {
  return (
    <div className={className} aria-hidden="true" data-scene-poster="true">
      <div className={styles.art}>
        <div className={styles.halo} />
        <div className={styles.sphere}>
          <i className={styles.latitude} />
          <i className={styles.latitude} />
          <i className={styles.longitude} />
          <i className={styles.longitude} />
        </div>
        <div className={styles.orbit} />
      </div>
    </div>
  );
}

export default StaticNebula;

import "app/frontend/core/components/LoadingBar/styles.scss";

type LoadingBarProps = {
  isActive: boolean;
  /** Read by screen readers while active. */
  label: string;
};

/**
 * A thin bar that runs for as long as something is loading, with no end
 * point. It always takes its height, so the content below does not jump when
 * it starts or stops.
 */
export function LoadingBar({ isActive, label }: LoadingBarProps) {
  return (
    <div
      className={`loading-bar${isActive ? " --active" : ""}`}
      role="progressbar"
      aria-busy={isActive}
      aria-hidden={!isActive}
      aria-label={isActive ? label : undefined}
    >
      <div className="loading-bar__indicator" />
    </div>
  );
}

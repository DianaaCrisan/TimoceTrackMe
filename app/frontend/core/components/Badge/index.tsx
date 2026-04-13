import "app/frontend/core/components/Badge/styles.scss";

export type BadgeTone =
  | "neutral"
  | "info"
  | "success"
  | "warning"
  | "critical"
  | "attention";

type BadgeProps = {
  children: React.ReactNode;
  tone?: BadgeTone;
};

export function Badge({ children, tone = "neutral" }: BadgeProps) {
  return (
    <span className={`custom-badge custom-badge--${tone}`}>{children}</span>
  );
}

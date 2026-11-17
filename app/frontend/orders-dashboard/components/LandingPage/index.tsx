import type { CSSProperties } from "react";
import { Link } from "react-router";
import "app/frontend/orders-dashboard/components/LandingPage/styles.scss";
import { APP_NAV } from "app/commons/navigation/AppNav";
import { useI18n } from "app/frontend/core/i18n/I18nProvider";

/** The home page: one coloured card per page in the menu. */
export default function LandingPage() {
  const { t } = useI18n();

  return (
    <s-page heading="TrackMe">
      <div className="app-home">
        <div className="app-home__title">{t("landing.welcome")}</div>
        <div className="app-home__intro">{t("landing.intro")}</div>

        <div className="app-home__cards">
          {APP_NAV.map((entry) => (
            <Link
              key={entry.path}
              to={entry.path}
              className="app-home__card"
              style={
                {
                  "--card-background": entry.color.background,
                  "--card-accent": entry.color.accent,
                } as CSSProperties
              }
            >
              <span className="app-home__card-title">{t(entry.label)}</span>
              <span className="app-home__card-description">
                {t(entry.description)}
              </span>
              <span className="app-home__card-arrow" aria-hidden="true">
                →
              </span>
            </Link>
          ))}
        </div>
      </div>
    </s-page>
  );
}

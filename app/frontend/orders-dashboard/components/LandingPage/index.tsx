import "app/frontend/orders-dashboard/components/LandingPage/styles.scss";
import deliveryIcon from "app/frontend/core/icons/DeliveryIcon.svg";
import locationIcon from "app/frontend/core/icons/LocationIcon.svg";
import printIcon from "app/frontend/core/icons/PrintIcon.svg";
import { useI18n } from "app/frontend/core/i18n/I18nProvider";

export default function LandingPage() {
  const { t } = useI18n();

  return (
    <s-page heading="TrackMe">
      <s-section>
        <div className="app-home">
          <div className="app-home__title">{t("landing.welcome")}</div>

          <div className="app-home__intro">{t("landing.intro")}</div>

          <div className="app-home__features">
            <div className="app-home__feature">
              <img src={locationIcon} alt="" width={20} height={20} />
              <span>{t("landing.featureZip")}</span>
            </div>
            <div className="app-home__feature">
              <img src={deliveryIcon} alt="" width={20} height={20} />
              <span>{t("landing.featureTracking")}</span>
            </div>
            <div className="app-home__feature">
              <img src={printIcon} alt="" width={20} height={20} />
              <span>{t("landing.featureLabels")}</span>
            </div>
          </div>

          <div className="app-home__cta">
            <s-button href="/app/orders-dashboard" variant="primary">
              {t("landing.openDashboard")}
            </s-button>
          </div>
        </div>
      </s-section>
    </s-page>
  );
}

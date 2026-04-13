import "app/frontend/orders-dashboard/components/LandingPage/styles.scss";
import deliveryIcon from "app/frontend/core/icons/DeliveryIcon.svg";
import locationIcon from "app/frontend/core/icons/LocationIcon.svg";
import printIcon from "app/frontend/core/icons/PrintIcon.svg";

export default function LandingPage() {
  return (
    <s-page heading="TrackMe">
      <s-section>
        <div className="app-home">
          <div className="app-home__title">Welcome to TrackMe!</div>

          <div className="app-home__intro">
            This app helps you manage your orders in just a few clicks.
          </div>

          <div className="app-home__features">
            <div className="app-home__feature">
              <img src={locationIcon} alt="" width={20} height={20} />
              <span>Solve missing ZIP codes automatically</span>
            </div>
            <div className="app-home__feature">
              <img src={deliveryIcon} alt="" width={20} height={20} />
              <span>Add tracking numbers in bulk</span>
            </div>
            <div className="app-home__feature">
              <img src={printIcon} alt="" width={20} height={20} />
              <span>Download and print shipping labels</span>
            </div>
          </div>

          <div className="app-home__cta">
            <s-button href="/app/orders-dashboard" variant="primary">
              Open Orders Dashboard
            </s-button>
          </div>
        </div>
      </s-section>
    </s-page>
  );
}

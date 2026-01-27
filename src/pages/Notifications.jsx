import { pageWrapper, card, title } from "../uiStyles";

export default function Notifications() {
  return (
    <div style={pageWrapper}>
      <div style={card}>
        <h2 style={title}>Notifications</h2>
        <p>No new notifications at the moment.</p>
      </div>
    </div>
  );
}

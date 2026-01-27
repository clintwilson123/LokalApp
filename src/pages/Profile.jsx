import { pageWrapper, card, title } from "../uiStyles";

export default function Profile() {
  return (
    <div style={pageWrapper}>
      <div style={card}>
        <h2 style={title}>Personal Job Info</h2>
        <p>Skills, experience, and resume visible to employers.</p>
      </div>
    </div>
  );
}

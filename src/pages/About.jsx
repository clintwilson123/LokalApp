import { pageWrapper, card, title } from "../uiStyles";

export default function About() {
  return (
    <div style={pageWrapper}>
      <div style={card}>
        <h2 style={title}>About Lokal</h2>
        <p>
          Lokal is a web-based platform designed to connect local talents with
          nearby employers efficiently.
        </p>
      </div>
    </div>
  );
}

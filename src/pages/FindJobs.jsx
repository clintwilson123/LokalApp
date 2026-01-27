import { pageWrapper, card, title } from "../uiStyles";

export default function FindJobs() {
  return (
    <div style={pageWrapper}>
      <div style={card}>
        <h2 style={title}>Find Jobs</h2>
        <p>Browse job opportunities posted by local companies.</p>
      </div>
    </div>
  );
}

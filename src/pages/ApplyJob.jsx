import { pageWrapper, card, title, button } from "../uiStyles";

export default function ApplyJob() {
  return (
    <div style={pageWrapper}>
      <div style={card}>
        <h2 style={title}>Apply for Position</h2>
        <p>Submit your application for this job.</p>
        <button style={button}>Apply Now</button>
      </div>
    </div>
  );
}

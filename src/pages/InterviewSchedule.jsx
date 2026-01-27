import { pageWrapper, card, title } from "../uiStyles";

export default function InterviewSchedule() {
  return (
    <div style={pageWrapper}>
      <div style={card}>
        <h2 style={title}>Interview Schedule</h2>
        <p>Your scheduled interviews will appear here.</p>
      </div>
    </div>
  );
}

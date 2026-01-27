import { pageWrapper, card, title, input } from "../uiStyles";

export default function JobSearch() {
  return (
    <div style={pageWrapper}>
      <div style={card}>
        <h2 style={title}>Search Jobs</h2>
        <input style={input} placeholder="Search by job title or location" />
      </div>
    </div>
  );
}

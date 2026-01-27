import { Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";

import Home from "./pages/home";
import SelectRole from "./pages/SelectRole";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import FindJobs from "./pages/FindJobs";
import JobSearch from "./pages/JobSearch";
import ApplyJob from "./pages/ApplyJob";
import DiscoverTalent from "./pages/DiscoverTalent";
import Profile from "./pages/Profile";
import About from "./pages/About";
import Notifications from "./pages/Notifications";
import InterviewSchedule from "./pages/InterviewSchedule";

export default function App() {
  return (
    <>
      <Navbar />

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/roles" element={<SelectRole />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/find-jobs" element={<FindJobs />} />
        <Route path="/search-jobs" element={<JobSearch />} />
        <Route path="/apply-job" element={<ApplyJob />} />
        <Route path="/discover-talent" element={<DiscoverTalent />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/about" element={<About />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/interview-schedule" element={<InterviewSchedule />} />
      </Routes>

      {/* 👇 THIS WAS MISSING */}
      <Footer />
    </>
  );
}

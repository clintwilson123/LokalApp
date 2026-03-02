import React, { useState, useRef } from "react";
import { title } from "../uiStyles";

export default function Profile() {
  // State to hold the profile image URL
  const [profileImg, setProfileImg] = useState(null);
  const fileInputRef = useRef(null);

  // Function to handle image selection
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const imageUrl = URL.createObjectURL(file);
      setProfileImg(imageUrl);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current.click();
  };

  return (
    <div style={{ textAlign: "center" }}>
      <h2 style={{ ...title, fontSize: "20px", marginBottom: "25px" }}>MY PROFILE</h2>
      
      <div style={profileHeader}>
        {/* Clickable Avatar Wrapper */}
        <div style={avatarWrapper} onClick={triggerFileInput}>
          {profileImg ? (
            <img src={profileImg} alt="Profile" style={avatarImage} />
          ) : (
            <div style={avatarPlaceholder}>
              <span style={{ fontSize: "40px" }}>👤</span>
              <div style={uploadOverlay}>Upload</div>
            </div>
          )}
        </div>
        
        {/* Hidden File Input */}
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleImageChange} 
          style={{ display: "none" }} 
          accept="image/*"
        />

        <h3 style={nameText}>Applicant Name</h3>
        <p style={locationText}>Toledo City, Cebu</p>
      </div>

      {/* Experience & Skills Grid */}
      <div style={infoGrid}>
        <div style={infoItem}>
          <span style={infoIcon}>👤</span>
          <div>
            <div style={infoLabel}>Years of Experience:</div>
            <div style={infoValue}>5+</div>
          </div>
        </div>
        <div style={infoItem}>
          <span style={infoIcon}>⚙️</span>
          <div>
            <div style={infoLabel}>Primary Skill:</div>
            <div style={infoValue}>Software Dev</div>
          </div>
        </div>
        <div style={infoItem}>
          <span style={infoIcon}>🌐</span>
          <div>
            <div style={infoLabel}>Languages:</div>
            <div style={infoValue}>English, Cebuano</div>
          </div>
        </div>
      </div>

      <button style={darkEditBtn}>Edit Profile</button>
    </div>
  );
}

// --- UPDATED STYLES FOR IMAGE UPLOAD ---

const avatarWrapper = {
  width: "110px",
  height: "110px",
  borderRadius: "50%",
  overflow: "hidden",
  margin: "0 auto 15px",
  border: "4px solid #fff",
  boxShadow: "0 4px 15px rgba(0,0,0,0.1)",
  cursor: "pointer",
  position: "relative",
  backgroundColor: "#f1f5f9"
};

const avatarImage = {
  width: "100%",
  height: "100%",
  objectFit: "cover" // Ensures the photo fills the circle
};

const avatarPlaceholder = {
  width: "100%",
  height: "100%",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  color: "#64748b"
};

const uploadOverlay = {
  position: "absolute",
  bottom: 0,
  width: "100%",
  backgroundColor: "rgba(0,0,0,0.4)",
  color: "#fff",
  fontSize: "10px",
  padding: "4px 0",
  fontWeight: "bold"
};

// --- PREVIOUS UI STYLES ---

const profileHeader = { marginBottom: "30px" };
const nameText = { margin: "0", fontSize: "22px", color: "#1a3b5c", fontWeight: "700" };
const locationText = { margin: "5px 0 0", fontSize: "14px", color: "#64748b" };

const infoGrid = { 
  display: "flex", 
  justifyContent: "center", 
  gap: "30px", 
  marginBottom: "40px", 
  flexWrap: "wrap" 
};

const infoItem = { display: "flex", alignItems: "center", gap: "10px", textAlign: "left" };
const infoIcon = { fontSize: "20px" };
const infoLabel = { fontSize: "11px", color: "#64748b", textTransform: "uppercase", fontWeight: "600" };
const infoValue = { fontSize: "13px", color: "#1a3b5c", fontWeight: "700" };

const darkEditBtn = {
  background: "linear-gradient(to right, #1a73e8, #1a3b5c)", 
  color: "#fff",
  border: "none",
  borderRadius: "15px",
  padding: "12px 60px",
  fontSize: "15px",
  fontWeight: "700",
  cursor: "pointer",
  boxShadow: "0 4px 15px rgba(26, 115, 232, 0.3)"
};
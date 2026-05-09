import React, { useState, useRef } from "react";

export default function Profile() {
  const [profileImg, setProfileImg] = useState(null);
  const fileInputRef = useRef(null);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const imageUrl = URL.createObjectURL(file);
      setProfileImg(imageUrl);
    }
  };

  return (
    <div style={container}>
      <div style={headerTextWrapper}>
        <h2 style={mainTitle}>Profile Settings</h2>
        <p style={subTitle}>Manage your account details, resume, and skills.</p>
      </div>

      <div style={profileLayoutGrid}>
        {/* Left Column Cards */}
        <div style={sideColumn}>
          <div style={profileCard}>
            <div style={cardHeader}>
              <div style={smallIconBox}>📞</div>
              <h4 style={cardTitle}>Contact Information</h4>
            </div>
            <p style={cardDetail}><strong>Phone:</strong> +1 555-123-4567</p>
            <p style={cardDetail}><strong>Location:</strong> Toledo City, Cebu</p>
            <button style={actionBtn}>Edit Details</button>
          </div>

          <div style={profileCard}>
            <div style={cardHeader}>
              <div style={smallIconBox}>⚙️</div>
              <h4 style={cardTitle}>Key Skills</h4>
            </div>
            <p style={cardDetail}>Inventory Management, Customer Service, Team Leadership</p>
            <button style={actionBtn}>Edit Skills</button>
          </div>
        </div>

        {/* Center Profile Photo Section */}
        <div style={centerSection}>
          <div style={photoWrapper} onClick={() => fileInputRef.current.click()}>
            {profileImg ? (
              <img src={profileImg} alt="Profile" style={avatarImage} />
            ) : (
              <div style={photoPlaceholder}>👤</div>
            )}
            <div style={editPhotoBadge}>✏️</div>
          </div>
          <h3 style={profileName}>Alex Thompson</h3>
          <p style={profileEmail}>alex.thompson@email.com</p>
          <button style={blueActionBtn}>Edit Photo</button>
          <input type="file" ref={fileInputRef} onChange={handleImageChange} style={{ display: "none" }} accept="image/*" />
        </div>

        {/* Right Column Cards */}
        <div style={sideColumn}>
          <div style={profileCard}>
            <div style={cardHeader}>
              <div style={smallIconBox}>☁️</div>
              <h4 style={cardTitle}>Resume & Cover Letter</h4>
            </div>
            <p style={cardDetail}>Resume_Alex_v3.pdf</p>
            <div style={buttonGroup}>
              <button style={actionBtn}>Upload New</button>
              <button style={actionBtn}>📥</button>
            </div>
          </div>

          <div style={profileCard}>
            <div style={cardHeader}>
              <div style={smallIconBox}>💼</div>
              <h4 style={cardTitle}>Work Experience</h4>
            </div>
            <p style={cardDetail}>Store Manager at RetailMart (3 yrs) | Assistant Manager at LocalShop (1.5 yrs)</p>
            <button style={actionBtn}>Add Experience</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- STYLES REPLICATING image_d57d77.jpg ---

const container = { padding: "20px", width: "100%" };

const headerTextWrapper = { textAlign: "center", marginBottom: "40px" };

const mainTitle = { fontSize: "32px", fontWeight: "800", color: "#1a3b5c", marginBottom: "8px" };

const subTitle = { fontSize: "16px", color: "#64748b" };

const profileLayoutGrid = {
  display: "grid",
  gridTemplateColumns: "1fr 0.8fr 1fr", // 3-column layout
  gap: "25px",
  maxWidth: "1100px",
  margin: "0 auto",
  alignItems: "start"
};

const sideColumn = { display: "flex", flexDirection: "column", gap: "25px" };

const centerSection = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  paddingTop: "20px"
};

const photoWrapper = {
  width: "160px",
  height: "160px",
  borderRadius: "30px", // Rounded square style
  backgroundColor: "#f1f5f9",
  marginBottom: "15px",
  position: "relative",
  cursor: "pointer",
  overflow: "hidden",
  boxShadow: "0 10px 20px rgba(0,0,0,0.1)"
};

const photoPlaceholder = { fontSize: "60px", display: "flex", height: "100%", alignItems: "center", justifyContent: "center" };

const avatarImage = { width: "100%", height: "100%", objectFit: "cover" };

const editPhotoBadge = {
  position: "absolute",
  bottom: "10px",
  right: "10px",
  backgroundColor: "#fff",
  borderRadius: "50%",
  padding: "5px",
  fontSize: "12px",
  boxShadow: "0 2px 5px rgba(0,0,0,0.2)"
};

const profileName = { fontSize: "22px", fontWeight: "800", color: "#1a3b5c", margin: "0" };

const profileEmail = { fontSize: "14px", color: "#64748b", marginBottom: "15px" };

const profileCard = {
  backgroundColor: "#ffffff",
  borderRadius: "30px",
  padding: "25px",
  boxShadow: "0 10px 25px rgba(0,0,0,0.05)",
  textAlign: "left"
};

const cardHeader = { display: "flex", alignItems: "center", gap: "12px", marginBottom: "15px" };

const smallIconBox = {
  backgroundColor: "#f0f7ff",
  padding: "8px",
  borderRadius: "12px",
  fontSize: "18px"
};

const cardTitle = { fontSize: "16px", fontWeight: "800", color: "#1a3b5c", margin: 0 };

const cardDetail = { fontSize: "14px", color: "#64748b", lineHeight: "1.5", marginBottom: "15px" };

const actionBtn = {
  backgroundColor: "#f0f7ff",
  color: "#1a73e8",
  border: "none",
  padding: "8px 16px",
  borderRadius: "10px",
  fontSize: "13px",
  fontWeight: "700",
  cursor: "pointer"
};

const blueActionBtn = { ...actionBtn, backgroundColor: "#1a73e8", color: "#fff" };

const buttonGroup = { display: "flex", gap: "10px" };
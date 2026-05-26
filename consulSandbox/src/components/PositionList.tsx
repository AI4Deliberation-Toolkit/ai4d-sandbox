import { useState } from "react";
import { ThumbsUp, ThumbsDown, AlertCircle, ChevronDown } from "lucide-react";

const styles = {
  item: {
    border: "1px solid #e2e8f0",
    borderRadius: "8px",
    overflow: "hidden",
    background: "#fff",
    marginBottom: "8px",
  },
  header: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 16px",
    background: "none",
    border: "none",
    cursor: "pointer",
    textAlign: "left",
    gap: "12px",
  },
  title: {
    fontWeight: "500",
    fontSize: "14px",
    color: "#1e293b",
    flex: 1,
  },
  badge: (type) => ({
    fontSize: "11px",
    padding: "3px 8px",
    borderRadius: "20px",
    fontWeight: "500",
    whiteSpace: "nowrap",
    ...(type === "removal"
      ? { background: "#fff1f2", color: "#9f1239", border: "1px solid #fecdd3" }
      : type === "addition"
      ? { background: "#f0fdf4", color: "#166534", border: "1px solid #bbf7d0" }
      : { background: "#f8fafc", color: "#475569", border: "1px solid #e2e8f0" }),
  }),
  body: {
    borderTop: "1px solid #e2e8f0",
    padding: "12px",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  count: {
    fontSize: "12px",
    color: "#94a3b8",
    margin: "0 0 4px",
  },
  argCard: (type) => ({
    display: "flex",
    alignItems: "flex-start",
    gap: "10px",
    padding: "10px 12px",
    borderRadius: "6px",
    fontSize: "13px",
    lineHeight: "1.5",
    ...(type === "positive"
      ? { background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#166534" }
      : type === "negative"
      ? { background: "#fff1f2", border: "1px solid #fecdd3", color: "#9f1239" }
      : { background: "#f8fafc", border: "1px solid #e2e8f0", color: "#64748b" }),
  }),
  icon: {
    marginTop: "2px",
    flexShrink: 0,
    width: "16px",
    height: "16px",
  },
};

function PositionItem({ position }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div style={styles.item}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={styles.header}
        onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
      >
        <span style={styles.title}>{position.label}</span>
        <span style={styles.badge(position.amendment_type)}>
          {position.amendment_type}
        </span>
        <ChevronDown
          style={{
            ...styles.icon,
            color: "#94a3b8",
            transition: "transform 0.2s",
            transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
          }}
        />
      </button>

      {isOpen && (
        <div style={styles.body}>
          <p style={styles.count}>{position.arguments.length} επιχειρήματα</p>
          {position.arguments.map((arg, i) => (
            <div key={i} style={styles.argCard(arg.is_type)}>
              <span style={styles.icon}>
                {arg.is_type === "positive" ? (
                  <ThumbsUp width={16} height={16} />
                ) : arg.is_type === "negative" ? (
                  <ThumbsDown width={16} height={16} />
                ) : (
                  <AlertCircle width={16} height={16} />
                )}
              </span>
              <span>{arg.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function PositionList({ positions }) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {positions.map((pos, i) => (
        <PositionItem key={i} position={pos} />
      ))}
    </div>
  );
}
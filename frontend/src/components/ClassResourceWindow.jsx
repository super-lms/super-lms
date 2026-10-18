export default function ClassResourceWindow({ children, style }) {
  return (
    <div
      role="region"
      aria-label="Class resources, newest first"
      tabIndex={0}
      style={{
        display: "grid",
        gap: "8px",
        maxHeight: "360px",
        overflowY: "auto",
        scrollbarGutter: "stable",
        overscrollBehaviorY: "contain",
        padding: "2px 4px 2px 2px",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

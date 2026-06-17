import { useEffect, useState } from "react";

function UsersPage() {
  const [users, setUsers] = useState([]);
  const [status, setStatus] = useState("Loading users...");

  useEffect(() => {
    fetch("/api/users")
      .then((response) => {
        if (!response.ok) {
          throw new Error("Server error");
        }
        return response.json();
      })
      .then((data) => {
        setUsers(data);
        setStatus("Users loaded");
      })
      .catch((error) => {
        console.error(error);
        setStatus("Could not load users");
      });
  }, []);

  return (
    <div>
      <header
        style={{
          marginBottom: "24px",
          padding: "24px",
          backgroundColor: "#ffffff",
          border: "1px solid #cbd5e1",
          borderRadius: "10px",
        }}
      >
        <h2 style={{ marginTop: 0, marginBottom: "10px", fontSize: "48px" }}>
          Users
        </h2>
        <p style={{ margin: 0, fontSize: "20px" }}>{status}</p>
      </header>

      <section
        style={{
          padding: "24px",
          backgroundColor: "#ffffff",
          border: "1px solid #cbd5e1",
          borderRadius: "10px",
        }}
      >
        {users.length === 0 ? (
          <p style={{ fontSize: "20px", margin: 0 }}>No users found.</p>
        ) : (
          <ul style={{ paddingLeft: "24px", margin: 0 }}>
            {users.map((user) => (
              <li key={user.id} style={{ marginBottom: "12px", fontSize: "22px" }}>
                {user.first_name} {user.last_name} — {user.email} ({user.role})
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default UsersPage;
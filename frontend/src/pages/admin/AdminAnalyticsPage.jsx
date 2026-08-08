import { useEffect, useMemo, useState } from "react"
import authFetch from "../../services/authFetch"

export default function AdminAnalyticsPage() {
  const [courses, setCourses] = useState([])
  const [users, setUsers] = useState([])
  const [loginAnalytics, setLoginAnalytics] = useState({ summary: {}, people: [] })
  const [status, setStatus] = useState("loading")
  const [error, setError] = useState("")

  useEffect(() => {
    let mounted = true

    async function load() {
      try {
        const [coursesRes, usersRes, loginAnalyticsRes] = await Promise.all([
          authFetch("/api/courses"),
          authFetch("/api/users"),
          authFetch("/api/auth/admin/login-analytics")
        ])

        const coursesData = await coursesRes.json()
        const usersData = await usersRes.json()
        const loginAnalyticsData = await loginAnalyticsRes.json()

        if (!coursesRes.ok) throw new Error("Unable to load courses")
        if (!usersRes.ok) throw new Error("Unable to load users")
        if (!loginAnalyticsRes.ok) throw new Error("Unable to load login analytics")

        if (!mounted) return

        setCourses(Array.isArray(coursesData) ? coursesData : [])
        setUsers(Array.isArray(usersData) ? usersData : [])
        setLoginAnalytics({
          summary: loginAnalyticsData?.summary || {},
          people: Array.isArray(loginAnalyticsData?.people)
            ? loginAnalyticsData.people
            : []
        })
        setStatus("ready")
      } catch (err) {
        if (!mounted) return
        setError(err.message)
        setStatus("error")
      }
    }

    load()
    return () => { mounted = false }
  }, [])

  const analytics = useMemo(() => {
    const students = users.filter(u => String(u.role).toLowerCase() === "student")
    const faculty = users.filter(u =>
      String(u.role).toLowerCase() === "teacher" ||
      courses.some(c => Number(c.teacher_id) === Number(u.id))
    )

    const totalSeats = courses.reduce((s,c)=>s+Number(c.student_count||0),0)
    const activeCourses = courses.filter(c=>Number(c.student_count||0)>0)
    const averageClassSize = activeCourses.length
      ? Math.round(totalSeats/activeCourses.length)
      : 0

    const largest = [...courses]
      .sort((a,b)=>Number(b.student_count||0)-Number(a.student_count||0))
      .slice(0,5)

    return {
      students: students.length,
      faculty: faculty.length,
      courses: courses.length,
      activeCourses: activeCourses.length,
      totalSeats,
      averageClassSize,
      largest
    }
  }, [courses, users])

  if (status==="error") {
    return <div>{error}</div>
  }

  return (
    <div>
      <h1 style={{marginTop:0,fontSize:"28px"}}>School Analytics</h1>

      <p style={{fontSize:"16px",color:"#4b5563"}}>
        Executive overview of the current school.
      </p>

      <div style={{
        display:"grid",
        gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",
        gap:"14px",
        marginTop:"24px",
        marginBottom:"24px"
      }}>
        <Card title="Students" value={analytics.students}/>
        <Card title="Faculty" value={analytics.faculty}/>
        <Card title="Courses" value={analytics.courses}/>
        <Card title="Active Courses" value={analytics.activeCourses}/>
        <Card title="Student Seats" value={analytics.totalSeats}/>
        <Card title="Average Class Size" value={analytics.averageClassSize}/>
      </div>

      <section style={{marginBottom:"24px"}}>
        <h2 style={{marginBottom:"6px"}}>Login Analytics</h2>
        <p style={{marginTop:0,fontSize:"15px",color:"#4b5563"}}>
          Principal-only view of successful account logins.
        </p>

        <div style={{
          display:"grid",
          gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))",
          gap:"14px",
          marginTop:"16px",
          marginBottom:"18px"
        }}>
          <LoginCard
            title="Parents"
            data={loginAnalytics.summary.parent}
          />
          <LoginCard
            title="Chinese Homeroom Teachers"
            data={loginAnalytics.summary.chinese_homeroom_teacher}
          />
          <LoginCard
            title="BC Teachers"
            data={loginAnalytics.summary.bc_teacher}
          />
        </div>

        <div style={{
          background:"white",
          border:"1px solid #d7d7d7",
          borderRadius:"14px",
          padding:"20px",
          overflowX:"auto"
        }}>
          <h3 style={{marginTop:0}}>Who Has Logged In</h3>

          {loginAnalytics.people.length === 0 ? (
            <p style={{color:"#6b7280",marginBottom:0}}>
              No tracked parent or teacher logins yet. Counts begin after this update is running.
            </p>
          ) : (
            <table style={{width:"100%",borderCollapse:"collapse",minWidth:"720px"}}>
              <thead>
                <tr>
                  <TableHeader>Name</TableHeader>
                  <TableHeader>Email</TableHeader>
                  <TableHeader>Account Type</TableHeader>
                  <TableHeader align="right">Login Count</TableHeader>
                  <TableHeader>Last Login</TableHeader>
                </tr>
              </thead>
              <tbody>
                {loginAnalytics.people.map(person => (
                  <tr key={`${person.category}-${person.user_id || person.email}`}>
                    <TableCell><strong>{person.name || "Name not listed"}</strong></TableCell>
                    <TableCell>{person.email}</TableCell>
                    <TableCell>{categoryLabel(person.category)}</TableCell>
                    <TableCell align="right">{Number(person.login_count || 0)}</TableCell>
                    <TableCell>{formatDate(person.last_login)}</TableCell>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <div style={{
        background:"white",
        border:"1px solid #d7d7d7",
        borderRadius:"14px",
        padding:"20px"
      }}>
        <h2 style={{marginTop:0}}>Largest Courses</h2>

        {analytics.largest.map(course=>(
          <div
            key={course.id}
            style={{
              display:"flex",
              justifyContent:"space-between",
              padding:"10px 0",
              borderBottom:"1px solid #eee"
            }}
          >
            <strong>{course.title}</strong>
            <span>{course.student_count} students</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function LoginCard({title,data}) {
  return (
    <div style={{
      background:"white",
      border:"1px solid #d7d7d7",
      borderRadius:"12px",
      padding:"16px"
    }}>
      <div style={{fontSize:"15px",fontWeight:700,marginBottom:"10px"}}>{title}</div>
      <div style={{display:"flex",gap:"28px"}}>
        <Metric label="People" value={Number(data?.unique_users || 0)} />
        <Metric label="Total Logins" value={Number(data?.total_logins || 0)} />
      </div>
    </div>
  )
}

function Metric({label,value}) {
  return (
    <div>
      <div style={{fontSize:"28px",fontWeight:800}}>{value}</div>
      <div style={{fontSize:"13px",color:"#6b7280"}}>{label}</div>
    </div>
  )
}

function TableHeader({children,align="left"}) {
  return (
    <th style={{
      textAlign:align,
      padding:"10px 8px",
      borderBottom:"1px solid #d1d5db",
      color:"#4b5563",
      fontSize:"13px"
    }}>
      {children}
    </th>
  )
}

function TableCell({children,align="left"}) {
  return (
    <td style={{textAlign:align,padding:"11px 8px",borderBottom:"1px solid #eee"}}>
      {children}
    </td>
  )
}

function categoryLabel(category) {
  if (category === "parent") return "Parent"
  if (category === "chinese_homeroom_teacher") return "Chinese Homeroom Teacher"
  if (category === "bc_teacher") return "BC Teacher"
  return category
}

function formatDate(value) {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleString()
}

function Card({title,value}) {
  return (
    <div style={{
      background:"white",
      border:"1px solid #d7d7d7",
      borderRadius:"12px",
      padding:"16px"
    }}>
      <div style={{fontSize:"14px",color:"#6b7280"}}>{title}</div>
      <div style={{fontSize:"30px",fontWeight:800}}>{value}</div>
    </div>
  )
}

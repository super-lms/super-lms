import { useEffect, useMemo, useState } from "react"
import authFetch from "../../services/authFetch"

export default function AdminAnalyticsPage() {
  const [courses, setCourses] = useState([])
  const [users, setUsers] = useState([])
  const [status, setStatus] = useState("loading")
  const [error, setError] = useState("")

  useEffect(() => {
    let mounted = true

    async function load() {
      try {
        const [coursesRes, usersRes] = await Promise.all([
          authFetch("/api/courses"),
          authFetch("/api/users")
        ])

        const coursesData = await coursesRes.json()
        const usersData = await usersRes.json()

        if (!coursesRes.ok) throw new Error("Unable to load courses")
        if (!usersRes.ok) throw new Error("Unable to load users")

        if (!mounted) return

        setCourses(Array.isArray(coursesData) ? coursesData : [])
        setUsers(Array.isArray(usersData) ? usersData : [])
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

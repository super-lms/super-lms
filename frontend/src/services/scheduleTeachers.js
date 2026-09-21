export function timetableTeacherName(value) {
  const original = String(value || "").trim()
  const key = original.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "")
  const aliases = [
    [["carriefang", "drcarrie", "carrie"], "Dr. Carrie"],
    [["michaelsamuels", "mrsamuels", "samuels"], "Mr. Samuels"],
    [["nicolinevanderwatt", "msvanderwatt", "vanderwatt"], "Ms. Van der Watt"],
    [["davidcheng", "mrcheng", "cheng"], "Mr. Cheng"],
    [["mrfeng", "feng"], "Mr. Feng"],
    [["mrrobinson", "robinson"], "Mr. Robinson"],
    [["msmoses", "moses"], "Ms. Moses"],
    [["msboyd", "boyd"], "Ms. Boyd"],
    [["drdvainer", "drvainer", "vainer"], "Dr. D. Vainer"],
    [["mrpniu", "peteniu", "pniu"], "Mr. P. Niu"],
    [["drbrecht", "davidbrecht", "drb"], "Dr. B"],
    [["mrnhansen", "nhansen", "hansen"], "Mr. N. Hansen"],
    [["academicplanning12teacher"], "Academic Planning 12 Teacher"],
  ]

  return aliases.find(([matches]) => matches.some((match) => key === match || key.includes(match)))?.[1] || original || "Teacher TBA"
}

export function scheduleTeacherLabel(row) {
  const names = Array.isArray(row.teacher_names)
    ? row.teacher_names.filter((name) => String(name || "").trim())
    : []
  return names.length
    ? names.map(timetableTeacherName).join(" / ")
    : timetableTeacherName(row.teacher_name)
}

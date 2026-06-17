const express = require("express");
const { Pool } = require("pg");

const router = express.Router();

const pool = new Pool({
  user: "postgres",
  host: "localhost",
  database: "postgres",
  password: "",
  port: 5432,
});

async function resetEnglish10Demo() {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    let courseResult = await client.query(
      `
      SELECT id, teacher_id
      FROM courses
      WHERE LOWER(title) = LOWER($1)
      ORDER BY id ASC
      LIMIT 1
      `,
      ["English 10"]
    );

    let courseId;
    let teacherId = null;
    let createdCourse = false;

    if (courseResult.rows.length === 0) {
      const insertedCourseResult = await client.query(
        `
        INSERT INTO courses (title, description)
        VALUES ($1, $2)
        RETURNING id, teacher_id
        `,
        ["English 10", "Stable demo course"]
      );

      courseId = insertedCourseResult.rows[0].id;
      teacherId = insertedCourseResult.rows[0].teacher_id || null;
      createdCourse = true;
    } else {
      courseId = courseResult.rows[0].id;
      teacherId = courseResult.rows[0].teacher_id || null;

      await client.query(
        `
        UPDATE courses
        SET description = $1
        WHERE id = $2
        `,
        ["Stable demo course", courseId]
      );
    }

    await client.query(
      `
      DELETE FROM submissions
      WHERE assignment_id IN (
        SELECT id
        FROM assignments
        WHERE class_id = $1
      )
      `,
      [courseId]
    );

    await client.query(
      `
      DELETE FROM assignments
      WHERE class_id = $1
      `,
      [courseId]
    );

    await client.query(
      `
      DELETE FROM category_subcategories
      WHERE course_category_id IN (
        SELECT id
        FROM course_categories
        WHERE course_id = $1
      )
      `,
      [courseId]
    );

    await client.query(
      `
      DELETE FROM course_categories
      WHERE course_id = $1
      `,
      [courseId]
    );

    const categoryResult = await client.query(
      `
      INSERT INTO course_categories (course_id, name, weight_percent, sort_order)
      VALUES ($1, $2, $3, $4)
      RETURNING id
      `,
      [courseId, "Writing", 100, 1]
    );

    const categoryId = categoryResult.rows[0].id;

    const subcategoryResult = await client.query(
      `
      INSERT INTO category_subcategories (
        course_category_id,
        parent_subcategory_id,
        name,
        weight_percent_of_parent,
        level_number,
        sort_order
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
      `,
      [categoryId, null, "Major Assessments", 100, 1, 1]
    );

    const subcategoryId = subcategoryResult.rows[0].id;

    const demoAssignments = [
      {
        title: "Literary Analysis Paragraph",
        description: "Close reading response using evidence and analysis.",
        due_date: "2026-09-15",
      },
      {
        title: "Seminar Reflection",
        description: "Written reflection on seminar participation and learning.",
        due_date: "2026-09-29",
      },
      {
        title: "Poetry Response",
        description: "Personal and analytical response to a studied poem.",
        due_date: "2026-10-10",
      },
      {
        title: "Personal Response Essay",
        description: "Multi-paragraph response connecting text and personal insight.",
        due_date: "2026-10-24",
      },
      {
        title: "Final Composition",
        description: "Polished final writing piece for the course demo pack.",
        due_date: "2026-11-14",
      },
    ];

    const insertedAssignments = [];

    for (const assignment of demoAssignments) {
      const insertedAssignmentResult = await client.query(
        `
        INSERT INTO assignments (
          class_id,
          teacher_id,
          title,
          description,
          due_date,
          subcategory_id
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, title, due_date
        `,
        [
          courseId,
          teacherId,
          assignment.title,
          assignment.description,
          assignment.due_date,
          subcategoryId,
        ]
      );

      insertedAssignments.push(insertedAssignmentResult.rows[0]);
    }

    const enrolledStudentsResult = await client.query(
      `
      SELECT
        u.name AS student_name,
        u.email AS student_email
      FROM class_enrollments ce
      JOIN users u
        ON ce.student_user_id = u.id
      WHERE ce.class_id = $1
      ORDER BY u.id ASC
      `,
      [courseId]
    );

    const enrolledStudents = enrolledStudentsResult.rows;

    const demoFeedbackByAssignmentTitle = {
      "Literary Analysis Paragraph": "Strong evidence selection and clear analysis.",
      "Seminar Reflection": "Thoughtful reflection with specific classroom connections.",
      "Poetry Response": "Good personal response and developing interpretation.",
      "Personal Response Essay": "Clear structure and effective support.",
      "Final Composition": "Polished final piece with solid communication of ideas.",
    };

    const demoScoreMatrix = [
      [88, 84, 91, 86, 90],
      [76, 79, 81, 78, 83],
      [92, 90, 94, 91, 95],
      [69, 72, 74, 71, 75],
      [85, 87, 89, 88, 90],
    ];

    const insertedSubmissions = [];

    for (let studentIndex = 0; studentIndex < enrolledStudents.length; studentIndex += 1) {
      const student = enrolledStudents[studentIndex];

      for (
        let assignmentIndex = 0;
        assignmentIndex < insertedAssignments.length;
        assignmentIndex += 1
      ) {
        const assignment = insertedAssignments[assignmentIndex];
        const scoreRow =
          demoScoreMatrix[studentIndex % demoScoreMatrix.length] || demoScoreMatrix[0];
        const score = scoreRow[assignmentIndex % scoreRow.length];

        const insertedSubmissionResult = await client.query(
          `
          INSERT INTO submissions (
            assignment_id,
            student_name,
            student_email,
            content,
            score,
            feedback,
            grade
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING id, assignment_id, student_name, student_email, score, grade
          `,
          [
            assignment.id,
            student.student_name,
            student.student_email,
            `Demo submission for ${assignment.title}.`,
            score,
            demoFeedbackByAssignmentTitle[assignment.title] || "Demo feedback added.",
            String(score),
          ]
        );

        insertedSubmissions.push(insertedSubmissionResult.rows[0]);
      }
    }

    await client.query("COMMIT");

    return {
      ok: true,
      message: "English 10 demo data reset complete.",
      course: {
        id: courseId,
        title: "English 10",
        created_course: createdCourse,
      },
      grading_structure: {
        category: "Writing",
        subcategory: "Major Assessments",
      },
      assignments_reset_count: insertedAssignments.length,
      submissions_reset_count: insertedSubmissions.length,
      assignments: insertedAssignments,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function handleReset(req, res) {
  try {
    const result = await resetEnglish10Demo();
    return res.json(result);
  } catch (error) {
    console.error("Demo reset failed:", error);
    return res.status(500).json({
      ok: false,
      error: error.message || "Demo reset failed",
    });
  }
}

router.get("/reset", handleReset);
router.post("/reset", handleReset);

module.exports = router;
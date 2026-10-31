// Report reads reuse Survey Studio's administrator and school access checks.
function registerSurveyReports(router, pool, admin, isId) {
  router.get('/reports', ...admin, async (req, res, next) => {
    try {
      const result = await pool.query(`
        SELECT s.id, s.title, s.description, s.status, s.created,
               COUNT(r.id)::INTEGER AS response_count
        FROM school_surveys s
        LEFT JOIN school_survey_responses r ON r.survey_id = s.id
        WHERE s.school_id IS NOT DISTINCT FROM $1
        GROUP BY s.id ORDER BY s.created DESC, s.id
      `, [req.schoolId]);
      res.set('Cache-Control', 'no-store').json({ surveys: result.rows });
    } catch (error) { next(error); }
  });

  router.get('/reports/:surveyId', ...admin, async (req, res, next) => {
    try {
      if (!isId(req.params.surveyId)) return res.status(400).json({ error: 'Invalid survey ID.' });
      const survey = await pool.query(`
        SELECT id, title, description, status FROM school_surveys
        WHERE id = $1 AND school_id IS NOT DISTINCT FROM $2
      `, [req.params.surveyId, req.schoolId]);
      if (!survey.rows.length) return res.status(404).json({ error: 'Survey unavailable.' });
      // Include the snapshot, not today's survey questions: edits must not relabel old answers.
      const responses = await pool.query(`
        SELECT r.id, r.survey_id, r.student, r.answers, r.questions, r.created
        FROM school_survey_responses r
        JOIN school_surveys s ON s.id = r.survey_id
        WHERE r.survey_id = $1 AND s.school_id IS NOT DISTINCT FROM $2
        ORDER BY r.created DESC, r.id DESC
      `, [req.params.surveyId, req.schoolId]);
      res.set('Cache-Control', 'no-store').json({ survey: survey.rows[0], responses: responses.rows });
    } catch (error) { next(error); }
  });
}
module.exports = { registerSurveyReports };

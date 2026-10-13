// A null actor removes only the author restriction; school boundaries remain mandatory.
function quizActor(req) { return req.user.role === 'admin' ? null : req.user.id; }
module.exports = { quizActor };

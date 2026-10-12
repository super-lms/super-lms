const {
  test
} = require('node:test');
const assert = require('node:assert/strict');
const {
  createReadAloudRouter
} = require('./readAloudRoutes');
const {
  wav
} = require('../../test/helpers/readAloudAudio');
function fixture(options = {}) {
  const queries = [],
    events = [];
  let stored, result;
  const assignment = {
    id: 7,
    class_id: 10,
    school_id: 1,
    teacher_id: 2,
    title: 'Reading',
    points_possible: 10,
    is_published: true
  };
  const pool = {
    query: async (sql, args = []) => {
      queries.push({
        sql,
        args
      });
      if (sql.startsWith('CREATE TABLE')) return {
        rows: []
      };
      if (sql.startsWith('SELECT audio,passage')) return {
        rows: [{
          audio: stored.audio,
          passage: stored.passage
        }]
      };
      if (sql.startsWith('SELECT a.*')) return {
        rows: options.missing ? [] : [assignment]
      };
      if (sql.startsWith('SELECT c.id')) return {
        rows: options.teacherDenied ? [] : [{
          id: 10
        }]
      };
      if (sql.startsWith('SELECT u.id')) return {
        rows: options.foreignStudent ? [] : [{
          id: 3,
          email: 'learner@example.com',
          name: 'Learner'
        }]
      };
      if (sql.startsWith('SELECT * FROM read_aloud_attempts')) return {
        rows: [{
          id: 8,
          assignment_id: 7,
          student_id: options.otherOwner ? 99 : 3,
          audio: wav(120),
          passage: 'hello world',
          status: 'assessed',
          result: {
            accuracy: 90,
            needsReview: options.uncertain || false
          }
        }]
      };
      if (sql.startsWith('SELECT * FROM read_aloud_settings')) return {
        rows: [{
          assignment_id: 7,
          passage: 'hello world',
          max_attempts: 3
        }]
      };
      if (sql.startsWith('SELECT passage')) return {
        rows: [{
          passage: 'hello world'
        }]
      };
      if (sql.startsWith('SELECT id FROM read_aloud_attempts')) return {
        rows: [{
          id: 8
        }]
      };
      if (sql.startsWith('SELECT COUNT')) return {
        rows: [{
          count: options.attemptCount || 0
        }]
      };
      if (sql.startsWith('SELECT id,email')) return {
        rows: [{
          id: 3,
          email: 'learner@example.com',
          name: 'Learner'
        }]
      };
      if (sql.startsWith('SELECT id FROM submissions')) return {
        rows: [{
          id: 9
        }]
      };
      if (sql.startsWith('INSERT INTO read_aloud_attempts')) {
        stored = {
          audio: args[2],
          passage: args[4]
        };
        return {
          rows: [{
            id: 8
          }]
        };
      }
      if (sql.includes("SET status='assessed'")) {
        result = args[1];
        events.push('assessed');
      }
      if (sql.includes("SET status='needs_review'")) events.push('needs_review');
      if (sql.startsWith('UPDATE submissions')) events.push('published');
      if (sql.startsWith('UPDATE read_aloud_attempts SET published_at') && options.auditFailure) throw Error('Audit write failed');
      return {
        rows: []
      };
    },
    connect: async () => ({
      query: (sql, args) => {
        if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(sql)) events.push(sql);
        return pool.query(sql, args);
      },
      release() {
        events.push('released');
      }
    })
  };
  const deadlines = {
    check: async () => {
      events.push('deadline');
      if (options.pastDue) throw Object.assign(Error('Past due'), {
        status: 403,
        code: 'PAST_DUE'
      });
      return {
        late: false
      };
    },
    notifyBlocked: async () => events.push('blocked'),
    record: async () => {
      events.push('audit');
      if (options.deadlineAuditFailure) throw Error('Deadline audit failed');
    }
  };
  const router = createReadAloudRouter(pool, deadlines, {
    studentHasLiveCourseAccess: async () => !options.unenrolled,
    assignmentIsAvailableToStudents: () => !options.unpublished,
    provider: {
      configured: () => !options.unconfigured,
      transcribe: async () => {
        events.push('provider');
        if (options.providerFailure) throw Error('Recognition failed');
        return {
          transcript: 'hello world',
          confidence: 0.9
        };
      }
    },
    uploadAudio: (req, res, cb) => {
      events.push('upload');
      req.file = {
        buffer: options.badAudio ? Buffer.from('not audio') : wav(120)
      };
      cb();
    }
  });
  async function invoke(path, method = 'get', req = {}) {
    const route = router.stack.find(l => l.route?.path === path && l.route.methods[method]).route;
    let resolve;
    const done = new Promise(r => resolve = r);
    const res = {
      statusCode: 200,
      status(n) {
        this.statusCode = n;
        return this;
      },
      set() {
        return this;
      },
      type() {
        return this;
      },
      send(body) {
        resolve({
          status: this.statusCode,
          body
        });
      },
      json(body) {
        resolve({
          status: this.statusCode,
          body
        });
      }
    };
    await route.stack.at(-1).handle({
      params: {
        assignmentId: '7',
        attemptId: '8'
      },
      user: {
        id: 3,
        role: 'student'
      },
      body: {},
      ...req
    }, res);
    return done;
  }
  return {
    invoke,
    events,
    queries,
    get stored() {
      return stored;
    },
    get result() {
      return result;
    }
  };
}
const uploadPath = '/:assignmentId/read-aloud/attempts',
  publishPath = '/:assignmentId/read-aloud/attempts/:attemptId/publish';
test('student must have a published live course and pass deadline before any upload or provider call', async () => {
  for (const opts of [{
    unenrolled: true
  }, {
    unpublished: true
  }, {
    pastDue: true
  }]) {
    const f = fixture(opts),
      r = await f.invoke(uploadPath, 'post');
    assert.equal(r.status, 403);
    assert.ok(!f.events.includes('upload'));
    assert.ok(!f.events.includes('provider'));
    if (opts.pastDue) assert.ok(f.events.includes('blocked'));
  }
});
test('unconfigured service, invalid audio and exhausted attempt allowance cannot create attempts', async () => {
  for (const [opts, status] of [[{
    unconfigured: true
  }, 503], [{
    badAudio: true
  }, 400], [{
    attemptCount: 3
  }, 409]]) {
    const f = fixture(opts);
    assert.equal((await f.invoke(uploadPath, 'post')).status, status);
    assert.equal(f.stored, undefined);
    assert.ok(!f.events.includes('provider'));
  }
});
test('two minute audio and passage snapshot commit before assessment; percentages are not published automatically', async () => {
  const f = fixture();
  assert.equal((await f.invoke(uploadPath, 'post')).status, 202);
  await new Promise(setImmediate);
  assert.equal(f.stored.audio.length, 44 + 120 * 32000);
  assert.equal(f.stored.passage, 'hello world');
  assert.ok(f.events.indexOf('COMMIT') < f.events.indexOf('provider'));
  assert.equal(f.result.accuracy, 100);
  assert.ok(!f.events.includes('published'));
});
test('provider failure retains the committed recording for review without inventing a score', async () => {
  const f = fixture({
    providerFailure: true
  });
  assert.equal((await f.invoke(uploadPath, 'post')).status, 202);
  await new Promise(setImmediate);
  assert.ok(f.stored);
  assert.ok(f.events.includes('needs_review'));
  assert.equal(f.result, undefined);
  assert.ok(!f.events.includes('published'));
});
test('late acceptance audit failure rolls back recording and never calls speech service', async () => {
  const f = fixture({
    deadlineAuditFailure: true
  });
  assert.equal((await f.invoke(uploadPath, 'post')).status, 500);
  assert.ok(f.events.includes('ROLLBACK'));
  assert.ok(!f.events.includes('COMMIT'));
  assert.ok(!f.events.includes('provider'));
});
test('a student cannot download another student recording', async () => {
  const f = fixture({
    otherOwner: true
  });
  assert.equal((await f.invoke('/:assignmentId/read-aloud/attempts/:attemptId/audio')).status, 403);
});
test('publishing requires teaching access, enrolled students and a reason for uncertain or adjusted marks', async () => {
  for (const options of [{
    teacherDenied: true
  }, {
    foreignStudent: true
  }, {
    uncertain: true
  }]) {
    const f = fixture(options);
    const r = await f.invoke(publishPath, 'post', {
      user: {
        id: 2,
        role: 'teacher'
      },
      body: {
        percent: 90
      }
    });
    assert.equal(r.status, options.uncertain ? 400 : 403);
    assert.ok(!f.events.includes('published'));
  }
  const f = fixture();
  const r = await f.invoke(publishPath, 'post', {
    user: {
      id: 2,
      role: 'teacher'
    },
    body: {
      percent: 85
    }
  });
  assert.equal(r.status, 400);
});
test('reviewed percentage publishes using direct gradebook percentages and original assignment points', async () => {
  const f = fixture();
  assert.equal((await f.invoke(publishPath, 'post', {
    user: {
      id: 2,
      role: 'teacher'
    },
    body: {
      percent: 85,
      reason: 'Reviewed recording'
    }
  })).status, 200);
  const q = f.queries.find(q => q.sql.startsWith('UPDATE submissions'));
  assert.equal(q.args[0], 85);
  assert.equal(q.args[3].pointsEarned, 8.5);
  assert.equal(q.args[3].directPercentage, true);
  assert.ok(f.events.includes('COMMIT'));
});
test('publication audit failure rolls back the grade change', async () => {
  const f = fixture({
    auditFailure: true
  });
  assert.equal((await f.invoke(publishPath, 'post', {
    user: {
      id: 2,
      role: 'teacher'
    },
    body: {
      percent: 90
    }
  })).status, 500);
  assert.ok(f.events.includes('ROLLBACK'));
  assert.ok(!f.events.includes('COMMIT'));
});
test('passage cannot change after recordings exist', async () => {
  const f = fixture();
  const original = f.queries;
  const r = await f.invoke('/:assignmentId/read-aloud', 'put', {
    user: {
      id: 2,
      role: 'teacher'
    },
    body: {
      passage: 'a different passage',
      maxAttempts: 3
    }
  });
  assert.equal(r.status, 400);
  assert.ok(!original.some(q => q.sql.startsWith('INSERT INTO read_aloud_settings')));
});

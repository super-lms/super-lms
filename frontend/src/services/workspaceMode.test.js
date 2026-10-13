import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getWorkspaceMode, setWorkspaceMode, usesAdminWorkspace } from './workspaceMode.js';
import { openAdminCourseBuilder } from './adminCourseBuilder.js';

test('opening a course retains admin mode and selection without assigning a co-teacher', async () => {
  const values=new Map();const original=globalThis.window;
  globalThis.window={localStorage:{getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value)}};
  try {
    setWorkspaceMode('teacher');let target;
    await openAdminCourseBuilder(94,path=>{target=path},'learning-paths');
    assert.equal(getWorkspaceMode(),'admin');assert.equal(target,'/courses?courseId=94&open=learning-paths');
    assert.equal(usesAdminWorkspace('admin',getWorkspaceMode()),true);
    setWorkspaceMode('teacher');assert.equal(usesAdminWorkspace('admin',getWorkspaceMode()),false);
    assert.equal(usesAdminWorkspace('teacher','admin'),false);
    assert.equal(usesAdminWorkspace('student','admin'),false);
  } finally {globalThis.window=original;}
});

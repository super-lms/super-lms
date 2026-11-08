import test from 'node:test'
import assert from 'node:assert/strict'
import { updateWorkspaceUrl, readWorkspaceLocation, WORKSPACE_LOCATION_EVENT } from './workspaceLocation.js'
import { gradebookPath } from './gradebookNavigation.js'

test('in-place workspace navigation updates link targets after the address changes', () => {
  const browser = new EventTarget()
  browser.location = new URL('https://example.invalid/courses?courseId=110')
  const calls = []
  for (const method of ['pushState', 'replaceState']) {
    browser.history ||= {}
    browser.history[method] = (state, title, url) => {
      calls.push({method, state, title, url})
      browser.location = new URL(url, browser.location)
    }
  }
  const targets = []
  browser.addEventListener(WORKSPACE_LOCATION_EVENT, () => {
    const {pathname,search} = readWorkspaceLocation(browser)
    targets.push(gradebookPath(pathname,search,'110'))
  })
  updateWorkspaceUrl('/courses?courseId=168', false, browser)
  updateWorkspaceUrl('/courses?courseId=170&view=master', true, browser)
  updateWorkspaceUrl('/courses', false, browser)
  assert.deepEqual(targets, ['/gradebook?classId=168','/gradebook?classId=170&sectionId=all','/gradebook?classId=110'])
  assert.deepEqual(calls.map(c=>c.method), ['pushState','replaceState','pushState'])
  assert.ok(calls.every(c=>c.state===null && c.title===''))
})

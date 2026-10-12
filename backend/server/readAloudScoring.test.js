const {
  test
} = require('node:test');
const assert = require('node:assert/strict');
const {
  words,
  compare,
  validateWav
} = require('./readAloudScoring');
const {
  wav
} = require('../test/helpers/readAloudAudio');
test('word alignment scores omissions, substitutions and additions and clamps at zero', () => {
  const reference = Array.from({
    length: 100
  }, (_, i) => `word${String.fromCharCode(97 + Math.floor(i / 26))}${String.fromCharCode(97 + i % 26)}`);
  const read = reference.slice(3);
  read[20] = 'changed';
  read[30] = 'different';
  read.push('extra');
  const r = compare(reference.join(' '), read.join(' '));
  assert.equal(r.accuracy, 94);
  assert.equal(r.missed, 3);
  assert.equal(r.changed, 2);
  assert.equal(r.added, 1);
  assert.equal(r.alignment.filter(w => w.expected).length, 100);
  assert.equal(compare('one', 'one two three four').accuracy, 0);
});
test('case, punctuation, common contractions and numeric formats are normalized consistently', () => {
  assert.equal(compare("I’m reading 24 books. I can't stop!", 'i am reading twenty four books i can not stop').accuracy, 100);
  assert.deepEqual(words("don't won't we're"), ['do', 'not', 'will', 'not', 'we', 'are']);
});
test('repetitions are additions; an empty transcript has zero word accuracy rather than a perfect mark', () => {
  assert.equal(compare('the cat sat', 'the the cat sat').added, 1);
  assert.equal(compare('hello world', '').accuracy, 0);
  assert.throws(() => compare('', 'hello'));
});
test('recordings through three minutes are accepted, longer and malformed audio are rejected', () => {
  assert.equal(validateWav(wav(120)), 120);
  assert.equal(validateWav(wav(180)), 180);
  assert.throws(() => validateWav(wav(181)), /3 minutes/);
  const stereo = wav(2);
  stereo.writeUInt16LE(2, 22);
  assert.throws(() => validateWav(stereo), /mono/);
  assert.throws(() => validateWav(wav(2).subarray(0, 100)), /incomplete/);
  assert.throws(() => validateWav(Buffer.from('not audio')));
});

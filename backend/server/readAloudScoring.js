const small = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
function numberWords(n) {
  if (n < 20) return small[n];
  if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + small[n % 10] : '');
  if (n < 1000) return small[Math.floor(n / 100)] + ' hundred' + (n % 100 ? ' ' + numberWords(n % 100) : '');
  return numberWords(Math.floor(n / 1000)) + ' thousand' + (n % 1000 ? ' ' + numberWords(n % 1000) : '');
}
function words(text) {
  return String(text).normalize('NFKC').toLowerCase().replace(/[’‘]/g, "'").replace(/\b\d{1,4}\b/g, n => numberWords(Number(n))).replace(/\b(can't|cannot)\b/g, 'can not').replace(/\bwon't\b/g, 'will not').replace(/n't\b/g, ' not').replace(/\b(i|you|we|they)'re\b/g, '$1 are').replace(/\bi'm\b/g, 'i am').replace(/\b(i|you|we|they)'ve\b/g, '$1 have').replace(/\b(i|you|he|she|it|we|they)'ll\b/g, '$1 will').match(/[a-z]+(?:'[a-z]+)?/g) || [];
}
function compare(reference, transcript) {
  const a = words(reference),
    b = words(transcript);
  if (!a.length || a.length > 300 || b.length > 1000) throw Error('Use a passage of 1 to 300 words and a recording up to 3 minutes.');
  const d = Array.from({
    length: a.length + 1
  }, () => new Uint16Array(b.length + 1));
  for (let i = 0; i <= a.length; i++) d[i][0] = i;
  for (let j = 0; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  let i = a.length,
    j = b.length;
  const alignment = [];
  while (i || j) {
    if (i && j && d[i][j] === d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)) {
      alignment.push({
        type: a[i - 1] === b[j - 1] ? 'correct' : 'changed',
        expected: a[--i],
        spoken: b[--j]
      });
    } else if (i && d[i][j] === d[i - 1][j] + 1) {
      alignment.push({
        type: 'missed',
        expected: a[--i]
      });
    } else {
      alignment.push({
        type: 'added',
        spoken: b[--j]
      });
    }
  }
  alignment.reverse();
  const counts = {
    missed: 0,
    changed: 0,
    added: 0
  };
  for (const item of alignment) if (item.type !== 'correct') counts[item.type]++;
  return {
    accuracy: Number((Math.max(0, 1 - d[a.length][b.length] / a.length) * 100).toFixed(2)),
    wordCount: a.length,
    ...counts,
    alignment,
    version: 1
  };
}
function validateWav(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 44 || buffer.length > 6000000 || buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WAVE') throw Error('Upload a valid mono PCM WAV recording up to 3 minutes.');
  let format, dataSize;
  for (let offset = 12; offset + 8 <= buffer.length;) {
    const size = buffer.readUInt32LE(offset + 4),
      name = buffer.toString('ascii', offset, offset + 4);
    if (offset + 8 + size > buffer.length) throw Error('Recording is incomplete.');
    if (name === 'fmt ' && size >= 16) format = {
      codec: buffer.readUInt16LE(offset + 8),
      channels: buffer.readUInt16LE(offset + 10),
      rate: buffer.readUInt32LE(offset + 12),
      bits: buffer.readUInt16LE(offset + 22)
    };
    if (name === 'data') dataSize = size;
    offset += 8 + size + size % 2;
  }
  if (!format || format.codec !== 1 || format.channels !== 1 || format.rate !== 16000 || format.bits !== 16 || !dataSize) throw Error('Recording must be 16 kHz mono 16-bit PCM WAV.');
  const seconds = dataSize / 32000;
  if (seconds < 0.5 || seconds > 180) throw Error('Record between 0.5 and 3 minutes.');
  return seconds;
}
module.exports = {
  words,
  compare,
  validateWav
};

const sdk = require('microsoft-cognitiveservices-speech-sdk');
const {
  validateWav
} = require('./readAloudScoring');
sdk.Recognizer.enableTelemetry(false);
function createSpeechProvider(sdkClient = sdk, env = process.env) {
  function configured() {
    return !!env.AZURE_SPEECH_KEY && /^[a-z0-9-]+$/.test(env.AZURE_SPEECH_REGION || '');
  }
  function pcmData(audio) {
    for (let offset = 12; offset + 8 <= audio.length;) {
      const size = audio.readUInt32LE(offset + 4);
      if (audio.toString('ascii', offset, offset + 4) === 'data') return audio.subarray(offset + 8, offset + 8 + size);
      offset += 8 + size + size % 2;
    }
    throw Error('Recording is incomplete.');
  }
  let running = 0;
  async function transcribe(audio) {
    if (!configured()) throw Error('Automatic assessment is not configured. Ask the administrator to set Azure Speech key and region.');
    validateWav(audio);
    if (running >= 3) throw Error('Speech assessment is busy. The recording is saved; your teacher can reassess it shortly.');
    running++;
    try {
      return await new Promise((resolve, reject) => {
        const config = sdkClient.SpeechConfig.fromSubscription(env.AZURE_SPEECH_KEY, env.AZURE_SPEECH_REGION);
        config.speechRecognitionLanguage = 'en-US';
        config.outputFormat = sdkClient.OutputFormat.Detailed;
        config.setProfanity(sdkClient.ProfanityOption.Raw);
        const push = sdkClient.AudioInputStream.createPushStream(sdkClient.AudioStreamFormat.getWaveFormatPCM(16000, 16, 1));
        const input = sdkClient.AudioConfig.fromStreamInput(push),
          recognizer = new sdkClient.SpeechRecognizer(config, input),
          segments = [];
        let settled = false;
        const finish = error => {
          if (settled) return;
          settled = true;
          clearTimeout(timeout);
          recognizer.stopContinuousRecognitionAsync(() => recognizer.close(), () => recognizer.close());
          push.close();
            config.close();
          if (error) return reject(error);
          if (!segments.length) return reject(Error('Speech could not be recognized. The recording is saved for teacher review.'));
          const uncertain = segments.some(s => s.confidence === null);
          resolve({
            transcript: segments.map(s => s.text).join(' '),
            confidence: uncertain ? null : Math.min(...segments.map(s => s.confidence))
          });
        };
        const timeout = setTimeout(() => finish(Error('Assessment timed out. The recording is saved for teacher review.')), 240000);
        recognizer.recognized = (_, event) => {
          if (event.result.reason !== sdkClient.ResultReason.RecognizedSpeech) return;
          let best;
          try {
            best = JSON.parse(event.result.properties.getProperty(sdkClient.PropertyId.SpeechServiceResponse_JsonResult)).NBest?.[0];
          } catch {}
          const text = best?.Lexical || event.result.text;
          if (text?.trim()) segments.push({
            text,
            confidence: Number.isFinite(best?.Confidence) ? best.Confidence : null
          });
        };
        recognizer.canceled = (_, event) => {
          if (event.reason === sdkClient.CancellationReason.Error) finish(Error('Speech assessment failed. Check the service connection; the recording is saved for review.'));
        };
        recognizer.sessionStopped = () => finish();
        recognizer.startContinuousRecognitionAsync(() => {
          const pcm = pcmData(audio);
          push.write(pcm.buffer.slice(pcm.byteOffset, pcm.byteOffset + pcm.byteLength));
          push.close();
        }, () => finish(Error('Unable to connect to speech assessment. The recording is saved for review.')));
      });
    } finally {
      running--;
    }
  }
  return {
    configured,
    transcribe
  };
}
module.exports = {
  ...createSpeechProvider(),
  createSpeechProvider
};

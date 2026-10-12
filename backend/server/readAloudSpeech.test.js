const {
  test
} = require('node:test');
const assert = require('node:assert/strict');
const {
  createSpeechProvider
} = require('./readAloudSpeech');
const {
  wav
} = require('../test/helpers/readAloudAudio');
function sdkFixture({
  segments = [{
    Lexical: 'hello',
    Confidence: 0.92
  }, {
    Lexical: 'world',
    Confidence: 0.88
  }],
  fail = false
} = {}) {
  let pcmBytes = 0,
    closed = false;
  const config = {
    setProfanity() {},
    close() {}
  };
  const sdk = {
    SpeechConfig: {
      fromSubscription: () => config
    },
    OutputFormat: {
      Detailed: 1
    },
    ProfanityOption: {
      Raw: 1
    },
    AudioInputStream: {
      createPushStream: () => ({
        write(b) {
          pcmBytes = b.byteLength;
        },
        close() {}
      })
    },
    AudioStreamFormat: {
      getWaveFormatPCM: (...args) => {
        assert.deepEqual(args, [16000, 16, 1]);
        return {};
      }
    },
    AudioConfig: {
      fromStreamInput: () => ({
        close() {}
      })
    },
    ResultReason: {
      RecognizedSpeech: 1
    },
    CancellationReason: {
      Error: 1
    },
    PropertyId: {
      SpeechServiceResponse_JsonResult: 1
    },
    SpeechRecognizer: class {
      startContinuousRecognitionAsync(callback) {
        callback();
        queueMicrotask(() => {
          if (fail) return this.canceled(null, {
            reason: 1
          });
          for (const segment of segments) this.recognized(null, {
            result: {
              reason: 1,
              text: segment.Lexical,
              properties: {
                getProperty: () => JSON.stringify({
                  NBest: [segment]
                })
              }
            }
          });
          this.sessionStopped();
        });
      }
      stopContinuousRecognitionAsync(callback) {
        callback();
      }
      close() {
        closed = true;
      }
    }
  };
  return {
    sdk,
    get pcmBytes() {
      return pcmBytes;
    },
    get closed() {
      return closed;
    },
    config
  };
}
test('continuous recognition combines every utterance in a two minute recording and excludes WAV headers', async () => {
  const f = sdkFixture(),
    provider = createSpeechProvider(f.sdk, {
      AZURE_SPEECH_KEY: 'k'.repeat(32),
      AZURE_SPEECH_REGION: 'eastus'
    });
  const r = await provider.transcribe(wav(120));
  assert.equal(r.transcript, 'hello world');
  assert.equal(r.confidence, 0.88);
  assert.equal(f.pcmBytes, 120 * 32000);
  assert.equal(f.closed, true);
  assert.equal(f.config.speechRecognitionLanguage, 'en-US');
});
test('absent recognition confidence requires review instead of an invented confidence', async () => {
  const f = sdkFixture({
    segments: [{
      Lexical: 'hello'
    }]
  });
  assert.equal((await createSpeechProvider(f.sdk, {
    AZURE_SPEECH_KEY: 'k'.repeat(32),
    AZURE_SPEECH_REGION: 'eastus'
  }).transcribe(wav(1))).confidence, null);
});
test('silence, service cancellation and missing credentials do not produce transcripts or scores', async () => {
  for (const opts of [{
    segments: []
  }, {
    fail: true
  }]) {
    const f = sdkFixture(opts);
    await assert.rejects(() => createSpeechProvider(f.sdk, {
      AZURE_SPEECH_KEY: 'k'.repeat(32),
      AZURE_SPEECH_REGION: 'eastus'
    }).transcribe(wav(1)));
    assert.equal(f.closed, true);
  }
  const f = sdkFixture();
  assert.equal(createSpeechProvider(f.sdk, {}).configured(), false);
  await assert.rejects(() => createSpeechProvider(f.sdk, {}).transcribe(wav(1)), /not configured/);
});

test('clipboard prose and multiline values cannot enable the Speech service',()=>{
 const f=sdkFixture();
 for(const key of ['# Read Aloud assignments\nA guide to recording','too short','x'.repeat(300)])assert.equal(createSpeechProvider(f.sdk,{AZURE_SPEECH_KEY:key,AZURE_SPEECH_REGION:'canadacentral'}).configured(),false);
 assert.equal(createSpeechProvider(f.sdk,{AZURE_SPEECH_KEY:'k'.repeat(32),AZURE_SPEECH_REGION:'canadacentral'}).configured(),true);
});

// AudioEngine lifecycle tests: context reuse, enabled-state sync and
// rejection swallowing, all against a fake AudioContext. No dependencies.
//   node tests/audio.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');

let failures = 0;
const fail = msg => { failures += 1; console.log('FAIL  ' + msg); };
const ok = (cond, msg) => { if (!cond) fail(msg); };

const loadAudio = window => {
  const sandbox = {
    window, console,
    performance: { now: () => 0 },
    setTimeout: cb => 0,
  };
  sandbox.window.Maze3D = sandbox.Maze3D = {};
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(
    fs.readFileSync(path.join(ROOT, 'js', 'audio.js'), 'utf8'),
    sandbox, { filename: 'audio.js' });
  return sandbox.Maze3D;
};

const makeEnv = () => {
  const created = [];
  class FakeAC {
    constructor() {
      this.state = 'suspended';
      this.sampleRate = 8000;
      this.currentTime = 0;
      this.destination = {};
      this.resumes = 0;
      this.suspends = 0;
      this.oscillators = 0;
      this.rejectResume = false;
      this.rejectSuspend = false;
      created.push(this);
    }
    resume() {
      this.resumes += 1;
      if (this.rejectResume) return Promise.reject(new Error('denied'));
      this.state = 'running';
      return Promise.resolve();
    }
    suspend() {
      this.suspends += 1;
      if (this.rejectSuspend) return Promise.reject(new Error('denied'));
      this.state = 'suspended';
      return Promise.resolve();
    }
    createBuffer(ch, length) {
      return { getChannelData: () => new Float32Array(length) };
    }
    createOscillator() {
      this.oscillators += 1;
      return {
        type: '',
        frequency: {
          setValueAtTime() {}, exponentialRampToValueAtTime() {},
        },
        connect() { return this; },
        start() {}, stop() {},
      };
    }
    createGain() {
      return {
        gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
        connect() { return this; },
      };
    }
    createBufferSource() {
      return {
        buffer: null,
        connect() { return this; },
        start() {}, stop() {},
      };
    }
    createBiquadFilter() {
      return { type: '', frequency: { value: 0 }, connect() { return this; } };
    }
  }
  const window = { AudioContext: FakeAC };
  const M = loadAudio(window);
  return { M, created };
};

// 1. Unlock creates exactly one context and resumes it for an enabled
// gesture; repeat gestures reuse it instead of building new contexts.
{
  const { M, created } = makeEnv();
  const a = new M.AudioEngine(true);
  a.unlock();
  ok(created.length === 1, 'unlock did not create a context');
  ok(created[0].resumes === 1 && created[0].state === 'running',
    'enabled unlock should resume the fresh context');
  a.unlock();
  a.unlock();
  ok(created.length === 1, 'repeat unlock recreated the context');
  ok(created[0].resumes === 1, 'running context resumed again on gesture');
}

// 2. Creation syncs with `enabled`: a muted engine keeps the new context
// suspended until enabled, and toggle calls resume/suspend on the same
// context — never a second construction.
{
  const { M, created } = makeEnv();
  const a = new M.AudioEngine(false);
  a.unlock();
  ok(created.length === 1, 'no context created');
  ok(created[0].resumes === 0 && created[0].state === 'suspended',
    'disabled engine should leave the context suspended');
  a.unlock();
  ok(created[0].resumes === 0, 'disabled unlock resumed the context');
  a.setEnabled(true);
  ok(created[0].resumes === 1 && created[0].state === 'running',
    'enabling did not resume the suspended context');
  a.setEnabled(false);
  ok(created[0].suspends === 1 && created[0].state === 'suspended',
    'disabling did not suspend the running context');
  ok(created.length === 1, 'engine built a second context');
}

// 3. resume()/suspend() rejections are swallowed, never thrown.
{
  const { M, created } = makeEnv();
  const a = new M.AudioEngine(true);
  a.unlock();
  created[0].state = 'suspended';
  created[0].rejectResume = true;
  a.unlock(); // rejected resume must not throw
  ok(created[0].resumes === 2, 'resume retry not attempted');
  created[0].state = 'running';
  created[0].rejectSuspend = true;
  a.setEnabled(false); // rejected suspend must not throw
  ok(created[0].suspends === 1, 'suspend not attempted');
  ok(a.enabled === false, 'enabled flag lost after rejected suspend');
}

// 4. No WebAudio at all: every call is a silent no-op.
{
  const M = loadAudio({});
  const a = new M.AudioEngine(true);
  a.unlock();
  a.setEnabled(false);
  a.setEnabled(true);
  a.play('bump');
  a.play('warp');
  ok(a.context === null, 'context exists without AudioContext support');
}

// 5. Cues actually drive oscillators once running; 'warp' is a real case.
{
  const { M, created } = makeEnv();
  const a = new M.AudioEngine(true);
  a.unlock();
  const base = created[0].oscillators;
  a.play('warp');
  ok(created[0].oscillators > base, "'warp' produced no oscillator");
  a.play('bump');
  a.play('relic');
  a.play('exit');
  ok(created[0].oscillators > base + 1, 'cues did not fire');
}

console.log(failures === 0 ? 'AUDIO ALL VALID' : `${failures} AUDIO FAILURES`);
process.exit(failures === 0 ? 0 : 1);

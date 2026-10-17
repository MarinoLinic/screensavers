import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.min.js';
import { DIRS, OPPOSITE } from '../js/engine.js';
import {
  elbowPlacement, makeTubeGeometry, makeElbowGeometry, makeBallGeometry,
  planTransition, planPending, pendingTipPoint,
  TUBE_RADIUS, BEND_RADIUS, vAdd, vScale,
} from '../js/geometry.js';

const EPS = 1e-6;
const close = (a, b, eps = 1e-5) =>
  assert.ok(
    Math.abs(a[0] - b[0]) < eps && Math.abs(a[1] - b[1]) < eps && Math.abs(a[2] - b[2]) < eps,
    `expected ${a} ≈ ${b}`
  );

const JOINT = [3, -2, 5];

test('elbowPlacement: all 24 turn orientations produce correct tangent frame', () => {
  let checked = 0;
  for (let dIn = 0; dIn < 6; dIn++) {
    for (let dOut = 0; dOut < 6; dOut++) {
      if (dOut === dIn || dOut === OPPOSITE[dIn]) continue; // perpendicular only
      const din = DIRS[dIn];
      const dout = DIRS[dOut];
      const { center, entry, exit, e1, e2, e3, basis } =
        elbowPlacement(din, dout, JOINT, BEND_RADIUS);
      checked++;

      // tangent points: entry = joint - R*dIn, exit = joint + R*dOut
      close(entry, [JOINT[0] - BEND_RADIUS * din[0], JOINT[1] - BEND_RADIUS * din[1], JOINT[2] - BEND_RADIUS * din[2]]);
      close(exit, [JOINT[0] + BEND_RADIUS * dout[0], JOINT[1] + BEND_RADIUS * dout[1], JOINT[2] + BEND_RADIUS * dout[2]]);
      close(center, [entry[0] + BEND_RADIUS * dout[0], entry[1] + BEND_RADIUS * dout[1], entry[2] + BEND_RADIUS * dout[2]]);

      // torus local start (R,0,0) maps to entry; local end (0,R,0) to exit
      const p0 = new THREE.Vector3(BEND_RADIUS, 0, 0).applyMatrix4(basis);
      const p1 = new THREE.Vector3(0, BEND_RADIUS, 0).applyMatrix4(basis);
      close([p0.x, p0.y, p0.z], entry);
      close([p1.x, p1.y, p1.z], exit);

      // tangents: local +y at u=0 maps to dIn; local -x at u=pi/2 maps to dOut
      close(e2, din);
      close(e1, vScale(dout, -1));
      close(e3, [
        din[1] * dout[2] - din[2] * dout[1],
        din[2] * dout[0] - din[0] * dout[2],
        din[0] * dout[1] - din[1] * dout[0],
      ]);

      // orthonormal right-handed basis (det = 1, no mirroring)
      assert.ok(Math.abs(basis.determinant() - 1) < 1e-5, `det ${basis.determinant()}`);
    }
  }
  assert.equal(checked, 24);
});

test('elbow geometry: finite vertices/normals, radial consistency (all facets)', () => {
  for (const facets of [6, 8, 12]) {
    const geo = makeElbowGeometry(facets);
    const pos = geo.getAttribute('position');
    const nor = geo.getAttribute('normal');
    assert.ok(pos.count > 0 && nor.count === pos.count);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      assert.ok(Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z));
      assert.ok(Number.isFinite(nor.getX(i)) && Number.isFinite(nor.getY(i)) && Number.isFinite(nor.getZ(i)));
      // every vertex lies within the tube shell around the quarter-circle
      const inPlane = Math.hypot(x, y);
      assert.ok(
        inPlane >= BEND_RADIUS - TUBE_RADIUS - EPS && inPlane <= BEND_RADIUS + TUBE_RADIUS + EPS,
        `facets=${facets} vertex ${i} plane radius ${inPlane}`
      );
      assert.ok(Math.abs(z) <= TUBE_RADIUS + EPS, `facets=${facets} vertex ${i} z ${z}`);
    }
    geo.dispose();
  }
});

test('placed elbow end-to-end: transformed centerline meets tangent points', () => {
  // spot-check a few orientations by transforming all vertices and verifying
  // the mesh reaches the entry/exit tangent points within the arc plane
  for (const [dIn, dOut] of [[0, 2], [2, 0], [1, 4], [4, 5], [3, 0], [5, 3]]) {
    const { basis, entry, exit } = elbowPlacement(DIRS[dIn], DIRS[dOut], JOINT, BEND_RADIUS);
    const geo = makeElbowGeometry(8);
    const pos = geo.getAttribute('position');
    let minEntry = Infinity, minExit = Infinity;
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(basis);
      minEntry = Math.min(minEntry, v.distanceTo(new THREE.Vector3(...entry)));
      minExit = Math.min(minExit, v.distanceTo(new THREE.Vector3(...exit)));
    }
    assert.ok(minEntry <= TUBE_RADIUS + EPS, `entry gap ${minEntry}`);
    assert.ok(minExit <= TUBE_RADIUS + EPS, `exit gap ${minExit}`);
    geo.dispose();
  }
});

test('tube geometry: unit length along +Y, finite, correct radius', () => {
  for (const facets of [6, 8, 12]) {
    const geo = makeTubeGeometry(facets);
    const pos = geo.getAttribute('position');
    let minY = Infinity, maxY = -Infinity;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      assert.ok(Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z));
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      const r = Math.hypot(x, z);
      assert.ok(r <= TUBE_RADIUS + EPS, `radius ${r}`);
    }
    assert.ok(Math.abs(minY) < EPS && Math.abs(maxY - 1) < EPS, `y span ${minY}..${maxY}`);
    geo.dispose();
  }
});

test('planTransition: forced finish re-plans dangling elbow into end cap', () => {
  // turned path: +x into cell (1,0,0), then +y; pending pretends +z
  const path = {
    cells: [[0, 0, 0], [1, 0, 0], [1, 1, 0]],
    dirs: [0, 2],
    pending: { from: [1, 1, 0], to: [1, 1, 1], dir: 4, progress: 0.4 },
  };
  const turning = planTransition(path, 1, 'elbows');
  assert.equal(turning.joint, 'elbow');
  assert.ok(Math.abs(turning.segLen - (1 - 2 * BEND_RADIUS)) < 1e-9); // trimmed both ends
  assert.equal(turning.endSig, 'n4');

  // forced finish: pending removed -> same transition becomes a clean cap
  path.pending = null;
  const finished = planTransition(path, 1, 'elbows');
  assert.equal(finished.joint, 'cap');
  assert.equal(finished.endSig, 'cap');
  assert.ok(Math.abs(finished.segLen - (1 - BEND_RADIUS)) < 1e-9); // end untrimmed
  assert.deepEqual(finished.segStart, vAdd(path.cells[1], vScale(DIRS[2], BEND_RADIUS)));
});

test('planTransition: straight joints honor joints mode', () => {
  const path = {
    cells: [[0, 0, 0], [1, 0, 0], [2, 0, 0]],
    dirs: [0, 0],
    pending: { from: [2, 0, 0], to: [3, 0, 0], dir: 0, progress: 0.5 },
  };
  assert.equal(planTransition(path, 1, 'elbows').joint, 'none');
  assert.equal(planTransition(path, 1, 'ball').joint, 'ball');
  assert.equal(planTransition(path, 1, 'mixed').joint, 'ball');
  // ball mode never trims segments for turns
  const turned = {
    cells: [[0, 0, 0], [1, 0, 0], [1, 1, 0]],
    dirs: [0, 2],
    pending: { from: [1, 1, 0], to: [1, 1, 1], dir: 4, progress: 0.4 },
  };
  const p = planTransition(turned, 1, 'ball');
  assert.equal(p.joint, 'ball');
  assert.equal(p.segLen, 1);
});

test('ball geometry: finite and roughly spherical', () => {
  const geo = makeBallGeometry(8);
  const pos = geo.getAttribute('position');
  const R = TUBE_RADIUS * 1.28;
  for (let i = 0; i < pos.count; i++) {
    const r = Math.hypot(pos.getX(i), pos.getY(i), pos.getZ(i));
    assert.ok(Math.abs(r - R) < EPS, `ball vertex radius ${r}`);
  }
  geo.dispose();
});

// ---- pending growth plan ----------------------------------------------------

const mkPath = (cells, dirs, pending) => ({ cells, dirs, pending, terminalDir: null });

test('planPending: all 24 turn orientations are continuous through commit', () => {
  let checked = 0;
  for (let d = 0; d < 6; d++) {
    for (let nd = 0; nd < 6; nd++) {
      if (nd === d || nd === OPPOSITE[d]) continue; // real turns only
      const B = [1, -1, 2];
      const A = [B[0] - DIRS[d][0], B[1] - DIRS[d][1], B[2] - DIRS[d][2]];
      const nextCell = [B[0] + DIRS[nd][0], B[1] + DIRS[nd][1], B[2] + DIRS[nd][2]];
      // prevDir = d covers a straight approach; prevDir = nd covers a
      // start-and-end double bend (arrive at A perpendicular, leave B perpendicular)
      for (const prevDir of [d, nd]) {
        const C0 = [A[0] - DIRS[prevDir][0], A[1] - DIRS[prevDir][1], A[2] - DIRS[prevDir][2]];
        // B is the pending target — reserved but not yet committed
        const path = mkPath(
          [C0, A],
          [prevDir],
          { from: A, to: B, dir: d, progress: 0, next: { to: nextCell, dir: nd } }
        );
        checked++;
        for (const joints of ['elbows', 'mixed']) {
          const plan = planPending(path, joints);
          assert.equal(plan.e, BEND_RADIUS, `joints=${joints} d=${d} nd=${nd} end offset`);
          assert.equal(plan.hasArc, true);
          assert.equal(plan.endJoint, 'elbow');
          const s = prevDir === d ? 0 : BEND_RADIUS;
          assert.equal(plan.s, s, `joints=${joints} prev=${prevDir} d=${d} start offset`);
          assert.ok(Math.abs(plan.total - (1 - s - BEND_RADIUS + (BEND_RADIUS * Math.PI) / 2)) < 1e-9);

          // p=0: tip sits at segment start (A + s*d)
          const t0 = pendingTipPoint(plan, 0);
          close(t0.point, vAdd(A, vScale(DIRS[d], plan.s)));
          assert.equal(t0.arcFrac, 0);

          // mid progress is finite and monotone along the arc
          const t25 = pendingTipPoint(plan, 0.25);
          const t90 = pendingTipPoint(plan, 0.9);
          assert.ok(t90.arcFrac > t25.arcFrac || t25.segShown < plan.segLen,
            'arc fraction should grow past the segment');

          // p=1: cap lands exactly on the elbow exit = next segment start
          const t1 = pendingTipPoint(plan, 1);
          const placed = elbowPlacement(DIRS[d], DIRS[nd], B, BEND_RADIUS);
          close(t1.point, placed.exit, 1e-4);
          assert.ok(Math.abs(t1.arcFrac - 1) < 1e-9);

          // after commit the planTransition for the same transition must agree
          const committed = mkPath(
            [C0, A, B],
            [prevDir, d],
            { from: B, to: nextCell, dir: nd, progress: 0, next: null }
          );
          const post = planTransition(committed, 1, joints);
          assert.equal(post.joint, 'elbow');
          assert.ok(Math.abs(post.segLen - plan.segLen) < 1e-9, 'segment length mismatch');
          assert.deepEqual(post.segStart, vAdd(A, vScale(DIRS[d], plan.s)));
        }
      }
    }
  }
  assert.equal(checked, 48); // 24 turn orientations x straight/bent approach
});

test('planPending: cap end when no lookahead (blocked/capped finish)', () => {
  const A = [0, 0, 0];
  const path = mkPath(
    [A],
    [],
    { from: A, to: [1, 0, 0], dir: 0, progress: 0.5, next: null }
  );
  const plan = planPending(path, 'elbows');
  assert.equal(plan.e, 0);
  assert.equal(plan.hasArc, false);
  assert.equal(plan.endJoint, 'cap');
  assert.ok(Math.abs(plan.total - 1) < 1e-9);
  const t1 = pendingTipPoint(plan, 1);
  close(t1.point, [1, 0, 0]);
  // committed plan must agree: straight segment + cap at B
  const committed = mkPath([A, [1, 0, 0]], [0], null);
  const post = planTransition(committed, 0, 'elbows');
  assert.equal(post.joint, 'cap');
  assert.ok(Math.abs(post.segLen - 1) < 1e-9);
});

test('planPending: ball mode is untrimmed with a growing cap', () => {
  const A = [0, 0, 0];
  const path = mkPath(
    [A, [1, 0, 0]],
    [0],
    { from: [1, 0, 0], to: [1, 1, 0], dir: 2, progress: 0, next: { to: [1, 2, 0], dir: 2 } }
  );
  const plan = planPending(path, 'ball');
  assert.equal(plan.s, 0);
  assert.equal(plan.e, 0);
  assert.equal(plan.hasArc, false);
  assert.equal(plan.endJoint, 'ball');
  assert.ok(Math.abs(plan.segLen - 1) < 1e-9);
  const t1 = pendingTipPoint(plan, 1);
  close(t1.point, [1, 1, 0]);
});

test('planTransition: terminalDir retains the formed bend and caps at exit', () => {
  // path arrives at B along +x; the lookahead had reserved a turn to +y that
  // graceful retirement keeps: elbow at B, cap on the outgoing tangent exit.
  const B = [2, 0, 0];
  const path = {
    cells: [[0, 0, 0], [1, 0, 0], B],
    dirs: [0, 0],
    pending: null,
    terminalDir: 2, // +y
  };
  const p = planTransition(path, 1, 'elbows');
  assert.equal(p.joint, 'elbow');
  assert.equal(p.terminalBend, true);
  assert.equal(p.endSig, 'n2!');
  assert.ok(Math.abs(p.segLen - (1 - BEND_RADIUS)) < 1e-9);
  const placed = elbowPlacement(DIRS[0], DIRS[2], B, BEND_RADIUS);
  close(p.capPos, placed.exit);
  // ball mode ignores the retained bend direction (a ball covers the joint)
  const pb = planTransition(path, 1, 'ball');
  assert.equal(pb.joint, 'ball');
  assert.equal(pb.terminalBend, false);
  assert.deepEqual(pb.capPos, B);
});

test('planPending: straight continuation in elbows mode gets no joint', () => {
  const A = [0, 0, 0];
  const path = mkPath(
    [A],
    [],
    { from: A, to: [1, 0, 0], dir: 0, progress: 0, next: { to: [2, 0, 0], dir: 0 } }
  );
  const plan = planPending(path, 'elbows');
  assert.equal(plan.endJoint, 'none');
  assert.equal(plan.hasArc, false);
  // in ball/mixed the through-joint is a ball
  assert.equal(planPending(path, 'ball').endJoint, 'ball');
  assert.equal(planPending(path, 'mixed').endJoint, 'ball');
});

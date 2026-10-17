// Shared geometry + elbow placement math for the pipes renderer.
// Imported by the browser app and by node tests alike.
//
// Angular surface geometry is always 12 radial segments (12 tubular segments
// on elbow arcs); smooth normals, never flat-shaded.

import * as THREE from '../vendor/three.module.min.js';
import { DIRS } from './engine.js';

export const TUBE_RADIUS = 0.18;  // lattice spacing is 1.0
export const BEND_RADIUS = 0.42;  // elbow centerline radius (< 0.5 cell)
export const BALL_SCALE = 1.28;   // joint sphere radius = TUBE_RADIUS * this
export const FACETS = 12;         // radial segments, fixed for all surfaces

// ---- small vector helpers (plain arrays, test-friendly) --------------------

export const vAdd = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const vSub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const vScale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
export const vDot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const vCross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

const clamp01 = (v) => Math.min(1, Math.max(0, v));

/**
 * Placement for a quarter-torus elbow at `joint`.
 * The pipe arrives travelling along `dIn` (unit axis) and leaves along `dOut`
 * (a perpendicular unit axis). Returns the torus-center, the entry/exit tangent
 * points on the centerline, the local basis (columns e1,e2,e3 mapping torus
 * local x/y/z), and a THREE.Matrix4 ready to drop on a TorusGeometry mesh.
 *
 * Torus local space: centerline (R cos u, R sin u, 0), u in [0, PI/2].
 * We need: u=0 -> entry with tangent dIn;  u=pi/2 -> exit with tangent dOut.
 */
export function elbowPlacement(dIn, dOut, joint, bendR = BEND_RADIUS) {
  const e1 = vScale(dOut, -1); // torus +x maps to -dOut
  const e2 = dIn.slice();      // torus +y maps to +dIn
  const e3 = vCross(dIn, dOut); // right-handed: (-dOut) x dIn == dIn x dOut
  const center = vAdd(vSub(joint, vScale(dIn, bendR)), vScale(dOut, bendR));
  const entry = vSub(joint, vScale(dIn, bendR));
  const exit = vAdd(joint, vScale(dOut, bendR));
  const basis = new THREE.Matrix4().makeBasis(
    new THREE.Vector3(e1[0], e1[1], e1[2]),
    new THREE.Vector3(e2[0], e2[1], e2[2]),
    new THREE.Vector3(e3[0], e3[1], e3[2])
  );
  basis.setPosition(center[0], center[1], center[2]);
  return { center, entry, exit, e1, e2, e3, basis };
}

/** How far along the travel direction an elbow consumes from a cell center. */
export function tangentOffset(dIn, dOut) {
  // symmetric: incoming cylinder ends at joint - R*dIn, outgoing starts at
  // joint + R*dOut, so each adjoining segment is shortened by R.
  return BEND_RADIUS;
}

// ---- shared geometries ------------------------------------------------------

/** Unit cylinder along +Y spanning y in [0,1]; scale.y = world length. */
export function makeTubeGeometry(facets = FACETS, radius = TUBE_RADIUS) {
  const g = new THREE.CylinderGeometry(radius, radius, 1, facets, 1, false);
  g.translate(0, 0.5, 0);
  return g;
}

/** Quarter torus in local XY plane, arc starting at +X sweeping toward +Y. */
export function makeElbowGeometry(facets = FACETS, radius = TUBE_RADIUS, bendR = BEND_RADIUS) {
  return new THREE.TorusGeometry(bendR, radius, facets, facets, Math.PI / 2);
}

/** Ball joint sphere (radius = tube radius * BALL_SCALE). */
export function makeBallGeometry(facets = FACETS, radius = TUBE_RADIUS * BALL_SCALE) {
  return new THREE.SphereGeometry(
    radius, Math.max(6, facets), Math.max(4, Math.round(facets * 0.75))
  );
}

/**
 * Pure plan for one committed transition A -> B (dirs[i]) of a path:
 * how long the tube segment is (trimmed by adjoining elbows) and which joint
 * piece sits at B. `endSig` captures what the plan assumed about B's joint —
 * if a forced finish removes the pending step, the signature changes and the
 * renderer re-plans the tail instead of leaving a dangling elbow.
 *
 * `path.terminalDir` (set by graceful retirement) describes a bend that was
 * already forming at the final cell: the last transition keeps its elbow and
 * gains a terminal cap at the elbow's outgoing tangent exit.
 *
 * joints: 'elbows' | 'ball' | 'mixed'
 */
export function planTransition(path, i, joints) {
  const d = path.dirs[i];
  const A = path.cells[i];
  const B = path.cells[i + 1];
  const isTip = i + 1 === path.cells.length - 1;
  const nd = i + 1 < path.dirs.length
    ? path.dirs[i + 1]
    : path.pending ? path.pending.dir
    : isTip && path.terminalDir != null ? path.terminalDir : null;
  const elbowAtTurns = joints !== 'ball';
  const startTurn = i > 0 && path.dirs[i - 1] !== d;
  const endTurn = nd !== null && nd !== d;
  const s = startTurn && elbowAtTurns ? BEND_RADIUS : 0;
  const e = endTurn && elbowAtTurns ? BEND_RADIUS : 0;
  const terminalBend =
    isTip && !path.pending && path.terminalDir != null && endTurn && elbowAtTurns;
  const joint =
    nd === null ? 'cap'
    : endTurn ? (elbowAtTurns ? 'elbow' : 'ball')
    : joints === 'elbows' ? 'none' : 'ball';
  // A retained terminal elbow gets its end cap at the outgoing tangent exit
  // rather than the joint center.
  const capPos = terminalBend ? vAdd(B, vScale(DIRS[nd], BEND_RADIUS)) : B;
  return {
    d, A, B, nd,
    segStart: vAdd(A, vScale(DIRS[d], s)),
    segLen: 1 - s - e,
    joint,
    terminalBend,
    capPos,
    endSig: nd === null ? 'cap' : `n${nd}${terminalBend ? '!' : ''}`,
  };
}

/**
 * Pure plan for the in-flight (pending) growth step A -> B along dir d.
 * Because pending.next is a real lookahead reservation, the end treatment at
 * B is decided before the tip arrives: e = BEND_RADIUS when a retained elbow
 * will form there (pending.next.dir differs, elbows/mixed joints).
 *
 * Lengths are centerline distances: the trimmed straight segment is
 * 1 - s - e; the (optional) quarter-arc adds e * PI/2; `total` is the path
 * length the tip travels, so arc-length u = progress * total parameterizes
 * the tip continuously across the straight and around the bend.
 */
export function planPending(path, joints) {
  const pending = path.pending;
  const d = pending.dir;
  const A = pending.from;
  const B = pending.to;
  const prevDir = path.dirs.length ? path.dirs[path.dirs.length - 1] : -1;
  const nd = pending.next ? pending.next.dir : null;
  const elbowAtTurns = joints !== 'ball';
  const startTurn = prevDir >= 0 && prevDir !== d;
  const endTurn = nd !== null && nd !== d;
  const s = startTurn && elbowAtTurns ? BEND_RADIUS : 0;
  const e = endTurn && elbowAtTurns ? BEND_RADIUS : 0;
  const segLen = 1 - s - e;
  const arcLen = (e * Math.PI) / 2;
  const endJoint =
    nd === null ? 'cap'
    : endTurn ? (elbowAtTurns ? 'elbow' : 'ball')
    : joints === 'elbows' ? 'none' : 'ball';
  return {
    d, A, B, nd, s, e,
    segLen,
    arcLen,
    total: segLen + arcLen,
    hasArc: e > 0,
    endJoint,
  };
}

/**
 * Tip position + elbow reveal for arc-length progress `p` (0..1) of a
 * planPending plan. The tip cap center follows the centerline: straight from
 * A + s*d to the elbow entry, then around the arc at B with
 * center = B - R*d + R*nd and point = center - R*cos(a)*nd + R*sin(a)*d,
 * a = arcFraction * PI/2. At p=1 the cap sits exactly on the outgoing tangent
 * start of the next segment.
 */
export function pendingTipPoint(plan, p) {
  const u = clamp01(p) * plan.total;
  const d = DIRS[plan.d];
  const segShown = Math.min(u, plan.segLen);
  if (!plan.hasArc || u <= plan.segLen) {
    return {
      point: vAdd(plan.A, vScale(d, plan.s + segShown)),
      segShown,
      arcFrac: 0,
      onArc: false,
    };
  }
  const arcFrac = Math.min(1, (u - plan.segLen) / plan.arcLen);
  const angle = (arcFrac * Math.PI) / 2;
  const nd = DIRS[plan.nd];
  const center = vAdd(vSub(plan.B, vScale(d, BEND_RADIUS)), vScale(nd, BEND_RADIUS));
  const point = vAdd(
    vSub(center, vScale(nd, BEND_RADIUS * Math.cos(angle))),
    vScale(d, BEND_RADIUS * Math.sin(angle))
  );
  return { point, segShown, arcFrac, onArc: true };
}

const UP = new THREE.Vector3(0, 1, 0);

/** Quaternion rotating +Y onto a unit axis direction (array). */
export function axisQuat(dir) {
  const d = new THREE.Vector3(dir[0], dir[1], dir[2]);
  return new THREE.Quaternion().setFromUnitVectors(UP, d.normalize());
}

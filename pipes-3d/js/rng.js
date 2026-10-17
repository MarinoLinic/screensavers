// Deterministic seeded RNG (mulberry32). Same seed -> same sequence.

export class Rng {
  constructor(seed = 1) {
    this.state = seed >>> 0; // seed 0 is valid and distinct from seed 1
  }

  next() {
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  range(min, max) {
    return min + (max - min) * this.next();
  }

  int(n) {
    return Math.floor(this.next() * n);
  }

  pick(arr) {
    return arr[this.int(arr.length)];
  }

  // Weighted pick: items = [{w, v}] -> v
  weighted(items) {
    let total = 0;
    for (const it of items) total += it.w;
    let roll = this.next() * total;
    for (const it of items) {
      roll -= it.w;
      if (roll <= 0) return it.v;
    }
    return items[items.length - 1].v;
  }
}

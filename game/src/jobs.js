// The four jobs, the debt story, and the progression numbers.
// RP and rank are derived from real job completions, never typed in.
export const JOBS = [
  {
    title: 'The Pickup',
    pay: 200,
    text: 'Pick up the package at the corner of 48th and Harbour.',
    story: 'Rico grabs the package. One down — the Ledger is watching.',
    speaker: 'vinnie',
    marker: [0, -60],
    district: 'Marina',
  },
  {
    title: 'The Drop',
    pay: 300,
    text: 'Deliver the package to the docks before the heat arrives.',
    story: 'Drop made. Vinnie counts the bills and nods. Two to go.',
    speaker: 'vinnie',
    marker: [104, -104],
    district: 'Marina',
  },
  {
    title: 'The Getaway',
    pay: 300,
    text: 'Reach the safehouse while the sirens are on you.',
    story: 'Rico slips into the safehouse. The sirens fade. One last job.',
    speaker: 'rico',
    marker: [-104, 52],
    district: 'Old Town',
  },
  {
    title: 'The Payoff',
    pay: 400,
    text: "Drive to Vinnie's office and settle the debt.",
    story: "Debt paid. Neon Bay is Rico's again — free roam, no more jobs.",
    speaker: 'vinnie',
    marker: [52, 104],
    district: 'Hillside',
  },
];

export const SPEAKERS = {
  vinnie: 'VINNIE "THE LEDGER" MARLOW',
  rico: 'RICO',
};

export function rankFor(rp) {
  if (rp >= 800) return 'S';
  if (rp >= 500) return 'A';
  if (rp >= 250) return 'B';
  if (rp >= 100) return 'C';
  return 'D';
}

export class JobState {
  constructor() {
    this.index = 0;
    this.money = 0;
    this.rp = 0;
    this.doneByDistrict = {};
    this.missionsDone = 0;
  }

  get current() {
    return JOBS[Math.min(this.index, JOBS.length - 1)];
  }

  get nextTitle() {
    if (this.index + 1 < JOBS.length) return JOBS[this.index + 1].title;
    return 'Free roam';
  }

  get district() {
    return this.current.district;
  }

  get standing() {
    return (this.doneByDistrict[this.current.district] || 0) * 25;
  }

  get rank() {
    return rankFor(this.rp);
  }

  get finished() {
    return this.index >= JOBS.length;
  }

  // Called when the player reaches the current marker. Returns the payout.
  complete() {
    const job = this.current;
    this.money += job.pay;
    this.rp += Math.round(job.pay / 2) + 25;
    this.doneByDistrict[job.district] = (this.doneByDistrict[job.district] || 0) + 1;
    this.missionsDone += 1;
    this.index += 1;
    return job;
  }
}

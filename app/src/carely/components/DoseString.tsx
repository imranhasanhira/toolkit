import React from 'react';

export function DoseString({ schedule }: { schedule: any }) {
  if (schedule?.type === 'custom') {
    return <span className="font-jakarta text-sm text-[color:var(--color-carely-on-surface-variant)]">{schedule.notes}</span>;
  }
  
  // schedule: { morning: 1, afternoon: 0, evening: 0, night: 1 }
  const { morning = 0, afternoon = 0, evening = 0, night = 0 } = schedule || {};
  let str = `${morning}+${afternoon}`;
  if (evening > 0) {
    str += `+${evening}+${night}`;
  } else {
    str += `+${night}`;
  }

  return <span className="font-lexend font-semibold text-lg text-[color:var(--color-carely-on-surface)] tracking-widest">{str}</span>;
}

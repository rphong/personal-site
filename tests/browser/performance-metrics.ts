export const PERFORMANCE_BUDGETS = {
  cumulativeLayoutShift: 0.1,
  interactionToNextPaintMs: 200,
  largestContentfulPaintMs: 2_500,
  longestTaskMs: 250,
  settledIdleWindowMs: 500,
  totalBlockingTimeMs: 200,
} as const;

export interface LayoutShiftSample {
  readonly hadRecentInput: boolean;
  readonly startTime: number;
  readonly value: number;
}

export interface LongTaskSample {
  readonly duration: number;
  readonly startTime: number;
}

export function calculateCumulativeLayoutShift(
  samples: readonly LayoutShiftSample[],
): number {
  const shifts = samples
    .filter(({ hadRecentInput, value }) => !hadRecentInput && value > 0)
    .toSorted((left, right) => left.startTime - right.startTime);
  let maximumWindowValue = 0;
  let sessionStart = 0;
  let previousStart = 0;
  let sessionValue = 0;

  for (const shift of shifts) {
    const continuesSession =
      sessionValue > 0 &&
      shift.startTime - previousStart < 1_000 &&
      shift.startTime - sessionStart < 5_000;

    if (continuesSession) {
      sessionValue += shift.value;
    } else {
      sessionStart = shift.startTime;
      sessionValue = shift.value;
    }
    previousStart = shift.startTime;
    maximumWindowValue = Math.max(maximumWindowValue, sessionValue);
  }

  return maximumWindowValue;
}

export function calculateTotalBlockingTime(
  samples: readonly LongTaskSample[],
  {
    endTime,
    startTime = 0,
  }: {
    readonly endTime: number;
    readonly startTime?: number;
  },
): number {
  return samples.reduce((total, task) => {
    const blockingStart = task.startTime + 50;
    const blockingEnd = task.startTime + task.duration;
    const overlapStart = Math.max(startTime, blockingStart);
    const overlapEnd = Math.min(endTime, blockingEnd);
    return total + Math.max(0, overlapEnd - overlapStart);
  }, 0);
}

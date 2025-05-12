// Statistical helper functions (e.g., z-score) 

/**
 * Calculates the z-score of a value given the mean and standard deviation.
 * Z-score indicates how many standard deviations an element is from the mean.
 *
 * @param x The value for which to calculate the z-score.
 * @param mean The mean (μ) of the dataset.
 * @param stdDev The standard deviation (σ) of the dataset.
 * @returns The z-score, or 0 if standard deviation is 0.
 */
export function zScore(x: number, mean: number, stdDev: number): number {
  if (stdDev === 0) {
    // If standard deviation is 0, it means all values are the same as the mean.
    // So, any value x would be equal to the mean, hence z-score is 0.
    // Or, it can be seen as x is 0 standard deviations away from the mean.
    return 0;
  }
  return (x - mean) / stdDev;
} 
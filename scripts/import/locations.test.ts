import { describe, it, expect } from 'vitest';
import { tripIdForDate, locationForDate } from './locations';

describe('tripIdForDate', () => {
  it('maps May 10–16 to Malaysia', () => {
    expect(tripIdForDate('2024-05-10')).toBe('trip.malaysia');
    expect(tripIdForDate('2024-05-16')).toBe('trip.malaysia');
  });
  it('maps May 17–27 to Singapore', () => {
    expect(tripIdForDate('2024-05-17')).toBe('trip.singapore');
    expect(tripIdForDate('2024-05-27')).toBe('trip.singapore');
  });
});

describe('locationForDate', () => {
  it('KL for days 1–4', () => {
    expect(locationForDate('2024-05-13').name).toBe('Kuala Lumpur');
  });
  it('Langkawi for days 5–7', () => {
    expect(locationForDate('2024-05-14').name).toBe('Langkawi');
  });
  it('Singapore from day 8', () => {
    expect(locationForDate('2024-05-17').name).toBe('Singapore');
  });
});

import { describe, expect, it } from 'vitest';
import { dailyPlan, dailyScore, dayOf, decodeResult, encodeResult, type DailyResult } from './daily';

const LINE = ['fabryczna', 'niciarniana', 'widzew', 'andrzejow', 'bedon', 'justynow', 'galkowek', 'zakowice', 'koluszki'];
const ARMS = ['teczka', 'gnat', 'puszka'];
const result: DailyResult = { day: '2026-11-14', station: 'widzew', kills: 812, level: 23, time: 431, cleared: true, weapons: ['teczka', 'gnat'] };

describe('codzienny kurs', () => {
  it('liczy dzień w czasie polskim', () => {
    // 23:30 UTC in November is already 00:30 the next day in Łódź.
    expect(dayOf(new Date('2026-11-14T23:30:00Z'))).toBe('2026-11-15');
    expect(dayOf(new Date('2026-07-01T21:59:00Z'))).toBe('2026-07-01');
    expect(dayOf(new Date('2026-07-01T22:01:00Z'))).toBe('2026-07-02');
  });

  it('każdy dostaje ten sam kurs, bez finału', () => {
    const a = dailyPlan('2026-11-14', LINE);
    expect(dailyPlan('2026-11-14', LINE)).toEqual(a);
    const seen = new Set<string>();
    for (let d = 1; d <= 28; d++) seen.add(dailyPlan(`2026-02-${String(d).padStart(2, '0')}`, LINE).station);
    expect(seen.has('koluszki')).toBe(false);
    expect(seen.size).toBeGreaterThan(4);
  });

  it('wynik liczy się z liczb, nie z linku', () => {
    expect(dailyScore(result)).toBe(812 + 23 * 25 + 1500);
    expect(dailyScore({ ...result, cleared: false })).toBe(812 + 23 * 25);
  });

  it('kod wyniku wraca bez zmian', () => {
    const code = encodeResult(result);
    expect(code).toMatch(/^[\w-]+\.[0-9a-z]+$/);
    expect(decodeResult(code, LINE, ARMS)).toEqual(result);
    expect(decodeResult(encodeResult({ ...result, weapons: [] }), LINE, ARMS)?.weapons).toEqual([]);
  });

  it('zepsuty, poprawiony ręcznie albo obcy kod nie przechodzi', () => {
    const code = encodeResult(result);
    const [body, check] = code.split('.');
    const edited = btoa(atob(body.replace(/-/g, '+').replace(/_/g, '/')).replace('812', '9999')).replace(/=+$/, '');
    expect(decodeResult(`${edited}.${check}`, LINE, ARMS)).toBeNull();
    expect(decodeResult(code.slice(0, -1), LINE, ARMS)).toBeNull();
    expect(decodeResult('', LINE, ARMS)).toBeNull();
    expect(decodeResult('a.b.c', LINE, ARMS)).toBeNull();
    expect(decodeResult(encodeResult({ ...result, station: 'warszawa' }), LINE, ARMS)).toBeNull();
    expect(decodeResult(encodeResult({ ...result, weapons: ['bazooka'] }), LINE, ARMS)).toBeNull();
  });
});

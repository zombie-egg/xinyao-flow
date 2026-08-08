import {describe,it,expect} from 'vitest';import {haversineMeters,startOfChinaDay} from '../lib/utils';
describe('考勤距离',()=>{it('同一坐标距离为 0',()=>expect(haversineMeters({latitude:31.2,longitude:121.4},{latitude:31.2,longitude:121.4})).toBe(0));it('约 111 米纬度差',()=>expect(haversineMeters({latitude:0,longitude:0},{latitude:.001,longitude:0})).toBeGreaterThan(110))});
describe('日期',()=>{it('返回上海自然日起点',()=>expect(startOfChinaDay(new Date('2026-08-08T10:00:00Z')).toISOString()).toBe('2026-08-07T16:00:00.000Z'))});

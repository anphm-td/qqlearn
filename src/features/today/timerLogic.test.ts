import { describe, expect, it } from 'vitest'

import { advanceTimer, elapsedMs, emptyTimer, formatClock, pauseTimer, remainingMs, startTimer } from './timerLogic'

describe('startTimer / elapsedMs — đếm bằng timestamp, không drift', () => {
  it('chạy 59 giây tính từ startedAt', () => {
    const s = startTimer(1_000, emptyTimer())
    expect(elapsedMs(60_000, s)).toBe(59_000)
  })

  it('pause chốt thời gian, chạy tiếp cộng dồn', () => {
    let s = startTimer(1_000, emptyTimer())
    s = pauseTimer(31_000, s) // học 30s
    expect(elapsedMs(99_999, s)).toBe(30_000) // dừng thì thời gian đứng yên
    s = startTimer(40_000, s)
    expect(elapsedMs(70_000, s)).toBe(60_000)
  })

  it('idempotent khi đang chạy', () => {
    const s = startTimer(1_000, emptyTimer())
    expect(startTimer(5_000, s)).toBe(s)
  })

  it('timer rỗng → 0', () => {
    expect(elapsedMs(123_456, emptyTimer())).toBe(0)
  })
})

describe('pauseTimer — chốt không vượt target', () => {
  it('đi quá đích thì chốt đúng target', () => {
    const s = startTimer(0, emptyTimer())
    expect(pauseTimer(30_000, s, 25_000).accumulatedMs).toBe(25_000)
  })
  it('chưa tới đích thì chốt theo thời gian thực', () => {
    const s = startTimer(0, emptyTimer())
    expect(pauseTimer(10_000, s, 25_000).accumulatedMs).toBe(10_000)
  })
})

describe('advanceTimer — tự dừng đúng target khi đủ giờ', () => {
  it('đủ target → finished, chốt ĐÚNG target (không cộng ms thừa giữa 2 tick)', () => {
    const s = startTimer(0, emptyTimer())
    const res = advanceTimer(26_400, s, 25_000) // tick muộn 1.4s
    expect(res.finished).toBe(true)
    expect(res.state.accumulatedMs).toBe(25_000)
    expect(res.state.running).toBe(false)
  })
  it('chưa đủ → giữ nguyên state', () => {
    const s = startTimer(0, emptyTimer())
    const res = advanceTimer(10_000, s, 25_000)
    expect(res.finished).toBe(false)
    expect(res.state).toBe(s)
  })
  it('đang dừng → không bao giờ finished', () => {
    const res = advanceTimer(99_999, emptyTimer(), 25_000)
    expect(res.finished).toBe(false)
  })
})

describe('remainingMs — thời gian còn lại, không âm', () => {
  it('target − elapsed', () => {
    const s = startTimer(0, emptyTimer())
    expect(remainingMs(5_000, s, 25_000)).toBe(20_000)
  })
  it('vượt target → 0', () => {
    const s = startTimer(0, emptyTimer())
    expect(remainingMs(30_000, s, 25_000)).toBe(0)
  })
})

describe('formatClock — mm:ss (h:mm:ss khi quá 1 giờ)', () => {
  it('định dạng phút:giây', () => {
    expect(formatClock(1_500_000)).toBe('25:00') // 25 phút
    expect(formatClock(65_000)).toBe('1:05')
    expect(formatClock(5030)).toBe('0:05')
  })
  it('quá 1 giờ và giá trị âm', () => {
    expect(formatClock(3_661_000)).toBe('1:01:01')
    expect(formatClock(-1)).toBe('0:00')
  })
})

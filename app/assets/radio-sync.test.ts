import * as assert from "remix/assert";
import { describe, it } from "remix/test";

import { NTP_CONSTANTS, epochNow } from "../data/protocol.ts";
import {
  calculateOffsetEstimate,
  calculateWaitTimeMilliseconds,
  handleNtpResponse,
  resetProbeState,
  type NtpMeasurement,
} from "./radio-sync.ts";

function createMeasurement(data: { roundTripDelay: number; clockOffset: number }): NtpMeasurement {
  return {
    t0: 1000,
    t1: 1000 + data.clockOffset + data.roundTripDelay / 2,
    t2: 1000 + data.clockOffset + data.roundTripDelay / 2,
    t3: 1000 + data.roundTripDelay,
    roundTripDelay: data.roundTripDelay,
    clockOffset: data.clockOffset,
  };
}

describe("calculateOffsetEstimate", () => {
  it("selects the offset from the minimum-RTT measurement", () => {
    let result = calculateOffsetEstimate([
      createMeasurement({ roundTripDelay: 10, clockOffset: 100 }),
      createMeasurement({ roundTripDelay: 20, clockOffset: 110 }),
      createMeasurement({ roundTripDelay: 200, clockOffset: 500 }),
      createMeasurement({ roundTripDelay: 300, clockOffset: 800 }),
    ]);

    assert.equal(result.offset, 100);
    assert.equal(result.roundTrip, 132.5);
  });

  it("ignores high-RTT spikes for offset selection", () => {
    let result = calculateOffsetEstimate([
      createMeasurement({ roundTripDelay: 18, clockOffset: 149 }),
      createMeasurement({ roundTripDelay: 22, clockOffset: 151 }),
      createMeasurement({ roundTripDelay: 20, clockOffset: 150 }),
      createMeasurement({ roundTripDelay: 500, clockOffset: 350 }),
      createMeasurement({ roundTripDelay: 800, clockOffset: -150 }),
    ]);

    assert.equal(result.offset, 149);
  });

  it("handles negative clock offsets", () => {
    let result = calculateOffsetEstimate([
      createMeasurement({ roundTripDelay: 12, clockOffset: -48 }),
      createMeasurement({ roundTripDelay: 10, clockOffset: -50 }),
      createMeasurement({ roundTripDelay: 15, clockOffset: -55 }),
      createMeasurement({ roundTripDelay: 500, clockOffset: -200 }),
    ]);

    assert.equal(result.offset, -50);
  });

  it("handles a single measurement", () => {
    let result = calculateOffsetEstimate([
      createMeasurement({ roundTripDelay: 50, clockOffset: 200 }),
    ]);

    assert.equal(result.offset, 200);
    assert.equal(result.roundTrip, 50);
  });
});

describe("calculateWaitTimeMilliseconds", () => {
  it("returns approximately the remaining wait time when the target is in the future", () => {
    let wait = calculateWaitTimeMilliseconds(epochNow() + 500, 0);
    assert.ok(wait >= 450);
    assert.ok(wait <= 500);
  });

  it("returns 0 when the target time has already passed", () => {
    assert.equal(calculateWaitTimeMilliseconds(epochNow() - 1000, 0), 0);
  });

  it("handles negative clock offset when the client is ahead of the server", () => {
    let wait = calculateWaitTimeMilliseconds(epochNow() + 300, -200);
    assert.ok(wait >= 450);
    assert.ok(wait <= 500);
  });
});

describe("coded NTP probes", () => {
  it("keeps the better probe when a pair has a pure gap", () => {
    resetProbeState();
    let first = handleNtpResponse({
      type: "NTP_RESPONSE",
      t0: epochNow() - 10,
      t1: 1000,
      t2: 1000,
      probeGroupId: 7,
      probeGroupIndex: 0,
    });
    let second = handleNtpResponse({
      type: "NTP_RESPONSE",
      t0: epochNow() - 5,
      t1: 1005,
      t2: 1005,
      probeGroupId: 7,
      probeGroupIndex: 1,
    });

    assert.equal(first, null);
    assert.ok(second);
  });

  it("rejects distorted probe gaps", () => {
    resetProbeState();
    handleNtpResponse({
      type: "NTP_RESPONSE",
      t0: 1000,
      t1: 2000,
      t2: 2000,
      probeGroupId: 8,
      probeGroupIndex: 0,
    });
    let measurement = handleNtpResponse({
      type: "NTP_RESPONSE",
      t0: 1000 + NTP_CONSTANTS.PROBE_GAP_MS,
      t1: 2000 + NTP_CONSTANTS.PROBE_GAP_MS + NTP_CONSTANTS.PROBE_GAP_TOLERANCE_MS + 1,
      t2: 2000,
      probeGroupId: 8,
      probeGroupIndex: 1,
    });

    assert.equal(measurement, null);
  });
});

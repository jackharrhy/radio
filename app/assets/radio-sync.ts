import { NTP_CONSTANTS, epochNow, type ServerMessage } from "../data/protocol.ts";

export interface NtpMeasurement {
  t0: number;
  t1: number;
  t2: number;
  t3: number;
  roundTripDelay: number;
  clockOffset: number;
}

let probeGroupCounter = 0;
let pendingFirstProbe: NtpMeasurement | null = null;
let pendingFirstProbeGroupId: number | null = null;

export function resetProbeState(): void {
  probeGroupCounter = 0;
  pendingFirstProbe = null;
  pendingFirstProbeGroupId = null;
}

export function sendProbePair(data: {
  send: (value: unknown) => void;
  currentRTT?: number;
  compensationMs?: number;
  nudgeMs?: number;
}): void {
  let probeGroupId = probeGroupCounter++;
  data.send({
    type: "NTP_REQUEST",
    t0: epochNow(),
    clientRTT: data.currentRTT,
    clientCompensationMs: data.compensationMs,
    clientNudgeMs: data.nudgeMs,
    probeGroupId,
    probeGroupIndex: 0,
  });

  setTimeout(() => {
    data.send({
      type: "NTP_REQUEST",
      t0: epochNow(),
      clientRTT: data.currentRTT,
      clientCompensationMs: data.compensationMs,
      clientNudgeMs: data.nudgeMs,
      probeGroupId,
      probeGroupIndex: 1,
    });
  }, NTP_CONSTANTS.PROBE_GAP_MS);
}

export function handleNtpResponse(
  response: Extract<ServerMessage, { type: "NTP_RESPONSE" }>,
): NtpMeasurement | null {
  let t3 = epochNow();
  let measurement: NtpMeasurement = {
    t0: response.t0,
    t1: response.t1,
    t2: response.t2,
    t3,
    roundTripDelay: t3 - response.t0 - (response.t2 - response.t1),
    clockOffset: (response.t1 - response.t0 + (response.t2 - t3)) / 2,
  };

  return validateProbePair(measurement, response.probeGroupId, response.probeGroupIndex);
}

export function calculateOffsetEstimate(measurements: NtpMeasurement[]): {
  offset: number;
  roundTrip: number;
} {
  let minRTT = Infinity;
  let bestOffset = 0;
  for (let measurement of measurements) {
    if (measurement.roundTripDelay < minRTT) {
      minRTT = measurement.roundTripDelay;
      bestOffset = measurement.clockOffset;
    }
  }

  return {
    offset: bestOffset,
    roundTrip:
      measurements.length > 0
        ? measurements.reduce((sum, measurement) => sum + measurement.roundTripDelay, 0) /
          measurements.length
        : 0,
  };
}

export function calculateWaitTimeMilliseconds(
  targetServerTime: number,
  clockOffset: number,
): number {
  return Math.max(0, targetServerTime - (epochNow() + clockOffset));
}

function validateProbePair(
  measurement: NtpMeasurement,
  probeGroupId: number,
  probeGroupIndex: 0 | 1,
): NtpMeasurement | null {
  if (probeGroupIndex === 0) {
    pendingFirstProbe = measurement;
    pendingFirstProbeGroupId = probeGroupId;
    return null;
  }

  if (!pendingFirstProbe || pendingFirstProbeGroupId !== probeGroupId) return null;

  let first = pendingFirstProbe;
  pendingFirstProbe = null;
  pendingFirstProbeGroupId = null;

  let clientGap = measurement.t0 - first.t0;
  let serverGap = measurement.t1 - first.t1;
  if (Math.abs(serverGap - clientGap) > NTP_CONSTANTS.PROBE_GAP_TOLERANCE_MS) return null;

  return first.roundTripDelay <= measurement.roundTripDelay ? first : measurement;
}

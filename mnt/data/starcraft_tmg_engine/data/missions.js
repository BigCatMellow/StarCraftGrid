export const MISSION_DATA = {
  take_and_hold: {
    id: "take_and_hold",
    name: "Take and Hold",
    roundLimit: 5,
    startingSupply: 4,
    supplyEscalation: 2
  }
};

export function getMission(missionId) {
  const mission = MISSION_DATA[missionId];
  if (!mission) throw new Error(`Unknown mission: ${missionId}`);
  return mission;
}

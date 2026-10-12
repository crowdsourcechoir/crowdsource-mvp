/**
 * Four-pad room. A pin wins. A take just kept wins until refresh.
 * A refresh picks from the pile. An empty pile plays the starter.
 */

export const ROOM_PADS = [
  { id: "clap", label: "Clap", prompt: "Add a clap." },
  { id: "tap", label: "Tap", prompt: "Add a tap." },
  { id: "voice", label: "Ah", prompt: "Hold an ah." },
  { id: "room", label: "Room", prompt: "Leave the sound of the room." },
] as const;

export type RoomPadId = (typeof ROOM_PADS)[number]["id"];

export type RoomTake = {
  id: string;
  padId: RoomPadId;
  createdAt: number;
};

export const STARTER_ID = "starter";

export type RoomChoice = {
  id: string;
  reason: "pin" | "newest" | "refresh" | "starter";
};

export function isRoomPadId(value: string): value is RoomPadId {
  return ROOM_PADS.some((pad) => pad.id === value);
}

export function roomPad(id: RoomPadId) {
  return ROOM_PADS.find((pad) => pad.id === id) ?? ROOM_PADS[0];
}

/** The role with the fewest kept takes. Ties follow the pad order. */
export function scarcePad(takes: RoomTake[]): RoomPadId {
  let best: RoomPadId = ROOM_PADS[0].id;
  let bestCount = Number.POSITIVE_INFINITY;
  for (const pad of ROOM_PADS) {
    const count = takes.filter((take) => take.padId === pad.id).length;
    if (count < bestCount) {
      best = pad.id;
      bestCount = count;
    }
  }
  return best;
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function resolveTake(args: {
  padId: RoomPadId;
  takes: RoomTake[];
  pinId: string | null;
  refreshKey: number;
  newestId: string | null;
}): RoomChoice {
  const pile = args.takes
    .filter((take) => take.padId === args.padId)
    .slice()
    .sort((a, b) => a.createdAt - b.createdAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  if (args.pinId === STARTER_ID) return { id: STARTER_ID, reason: "pin" };
  if (args.pinId && pile.some((take) => take.id === args.pinId)) return { id: args.pinId, reason: "pin" };
  if (args.newestId && pile.some((take) => take.id === args.newestId)) return { id: args.newestId, reason: "newest" };
  if (pile.length === 0) return { id: STARTER_ID, reason: "starter" };
  const index = hashString(`${args.refreshKey}:${args.padId}`) % pile.length;
  return { id: pile[index].id, reason: "refresh" };
}

export function choiceLabel(reason: RoomChoice["reason"]): string {
  if (reason === "pin") return "Pinned";
  if (reason === "newest") return "Just kept";
  if (reason === "refresh") return "From the room";
  return "Starter";
}

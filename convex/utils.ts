const ROOM_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export const generateRoomCode = () => {
  let result = "";
  for (let i = 0; i < 6; i++) {
    result += ROOM_CHARS.charAt(Math.floor(Math.random() * ROOM_CHARS.length));
  }
  return result;
};

export const generateRoomCode = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "";
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

// Rate limiter helper (simple implementation)
// In production, use a dedicated table or Redis
export const validateMoveRate = (lastMoveTime: number) => {
  if (Date.now() - lastMoveTime < 100) { // 100ms debounce
    return false;
  }
  return true;
};

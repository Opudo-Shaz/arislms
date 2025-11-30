// Format a Date to `YYYY-MM-DD HH:mm:ss.SSS ±HHMM` (e.g. `2025-11-21 11:52:55.984 +0300`)
function formatDateWithOffset(date) {
	const pad = (n, digits = 2) => String(n).padStart(digits, '0');
	const year = date.getFullYear();
	const month = pad(date.getMonth() + 1);
	const day = pad(date.getDate());
	const hh = pad(date.getHours());
	const mm = pad(date.getMinutes());
	const ss = pad(date.getSeconds());
	const ms = String(date.getMilliseconds()).padStart(3, '0');
	const offsetMinutes = -date.getTimezoneOffset();
	const sign = offsetMinutes >= 0 ? '+' : '-';
	const absOffset = Math.abs(offsetMinutes);
	const offH = pad(Math.floor(absOffset / 60));
	const offM = pad(absOffset % 60);
	return `${year}-${month}-${day} ${hh}:${mm}:${ss}.${ms} ${sign}${offH}${offM}`;
}


const formatDateWithOffset = (date, offsetMinutes = 0) => {
  const localDate = new Date(date.getTime() + offsetMinutes * 60000);
  return localDate.toISOString();
};

// NEW: safely get the logged-in user's ID
const getUserId = (req) => {
  if (!req || !req.user || !req.user.id) return null;
  return req.user.id;
};

// NEW: return full user object or null
const getUser = (req) => {
  if (!req || !req.user) return null;
  return req.user;
};

module.exports = {
  formatDateWithOffset,
  getUserId,
  getUser
};

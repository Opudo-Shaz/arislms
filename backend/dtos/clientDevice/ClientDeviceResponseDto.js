/** Public view of a trusted device. Never exposes the device hash. */
const ClientDeviceResponseDto = (device, { currentHash = null } = {}) => ({
  id: device.id,
  userAgent: device.userAgent,
  lastIp: device.lastIp,
  trustedAt: device.trustedAt,
  lastSeenAt: device.lastSeenAt,
  current: Boolean(currentHash) && device.deviceHash === currentHash,
});

module.exports = ClientDeviceResponseDto;

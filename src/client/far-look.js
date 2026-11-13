// City rendering tunables. Distances are in blocks unless marked in metres.
export const FAR_LOOK = Object.freeze({
 nearPlaneMeters:.1, farPlaneMeters:1400, fogMeters:420, fogExponent:1.3,
 fogCap:.90, fogLowY:40, fogHighY:320, fogHighMultiplier:.45,
 emissionFog:.35, facadeMinScale:.85,
 bay:5, storey:6, litRowThreshold:.82, busyWindowThreshold:.45,
 quietWindowThreshold:.965, windowGlow:.23,
 middleRadius:160, overlap:12, middleVertexBudget:25000,
 farVertexBudget:250000, tierInset:.5, tierMergeTolerance:1
});

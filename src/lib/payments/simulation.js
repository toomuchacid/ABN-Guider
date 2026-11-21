/** Local click-through only. Production hostnames never qualify. */
export function simulationAllowed(request, env) {
  if (env?.ENABLE_PAYMENT_SIMULATION !== 'true') return false;
  const host = new URL(request.url).hostname;
  return host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
}

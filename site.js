const SECOND_LEVEL = /^(?:co|com|net|org|ac|gov|edu|gen|id|sch|ltd|plc|or|ne|go)\.[a-z]{2}$/;

function siteOf(hostname) {
  const host = hostname.replace(/\.$/, '').toLowerCase();
  if (!host.includes('.') || host.includes(':') || /^[\d.]+$/.test(host)) return host;
  const parts = host.split('.');
  return parts.slice(SECOND_LEVEL.test(parts.slice(-2).join('.')) ? -3 : -2).join('.');
}

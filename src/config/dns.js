import dns from 'node:dns';

const stripPort = (server) => server.replace(/^\[(.+)\](:\d+)?$/, '$1').replace(/:\d+$/, '');

const isLoopbackOrEmpty = (server) => {
  const host = stripPort(server);
  return !host || host === '::1' || host === '0.0.0.0' || host.startsWith('127.');
};

const FALLBACK_SERVERS = ['1.1.1.1', '8.8.8.8', '1.0.0.1', '8.8.4.4'];

const configured = dns.getServers();

if (configured.length === 0 || configured.every(isLoopbackOrEmpty)) {
  dns.setServers(FALLBACK_SERVERS);
}

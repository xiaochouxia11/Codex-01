import './styles.css';

if (location.pathname === '/demo/provider') {
  await import('./provider.js');
} else if (location.pathname === '/react') {
  await import('./react.js');
} else {
  await import('./vanilla.js');
}

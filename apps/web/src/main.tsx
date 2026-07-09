import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './globals.css';

async function prepare() {
	if (import.meta.env.DEV && import.meta.env.VITE_MOCK === 'true') {
		const { worker } = await import('./mocks/browser');

		return worker.start({ onUnhandledRequest: 'bypass' });
	}
}

const rootElement = document.getElementById('root');

if (!rootElement) {
	throw new Error('Root element #root not found in index.html');
}

prepare().then(() => {
	createRoot(rootElement).render(
		<StrictMode>
			<App />
		</StrictMode>,
	);
});

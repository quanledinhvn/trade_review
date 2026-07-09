import { RouterProvider } from '@tanstack/react-router';
import { router } from './config/router';

export function App() {
	return <RouterProvider router={router} />;
}

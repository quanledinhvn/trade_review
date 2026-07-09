import { Outlet } from '@tanstack/react-router';

export function RootLayout() {
	return (
		<div>
			<Outlet />
		</div>
	);
}

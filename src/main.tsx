import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { AuthGate } from './components/AuthGate.tsx';
import './index.css';
import { installNumberInputFix } from './services/numberInputs.ts';
import { installTranslator } from './i18n/index.ts';
import { installPwa } from './services/pwa.ts';

installNumberInputFix();
installTranslator();
installPwa();

createRoot(document.getElementById('root')!).render(
	<AuthGate>
		{(user, signOut) => <App authenticatedUser={user} onSignOut={signOut} />}
	</AuthGate>
);

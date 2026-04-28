import { BrowserRouter } from 'react-router-dom';
import AppProviders from './app/providers/AppProviders';
import AppRouter from './app/router/AppRouter';
import './App.css';

function App() {
  return (
    <AppProviders>
      <BrowserRouter>
        <AppRouter />
      </BrowserRouter>
    </AppProviders>
  );
}

export default App;

import { BrowserRouter } from 'react-router-dom';
import QueryProvider from './app/providers/QueryProvider';
import AppRouter from './app/router/AppRouter';
import './App.css';

function App() {
  return (
    <QueryProvider>
      <BrowserRouter>
        <AppRouter />
      </BrowserRouter>
    </QueryProvider>
  );
}

export default App;

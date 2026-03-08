import { useState } from 'react';
import './App.css';
import Login from './components/Login';
import Dashboard from './components/Dashboard';

function App() {
  const [shop, setShop] = useState(() => {
    const saved = localStorage.getItem('umi_shop');
    return saved ? JSON.parse(saved) : null;
  });

  const handleLogin = (shopData) => {
    setShop(shopData);
    localStorage.setItem('umi_shop', JSON.stringify(shopData));
  };

  const handleLogout = () => {
    setShop(null);
    localStorage.removeItem('umi_shop');
  };

  return shop ? (
    <Dashboard shop={shop} onLogout={handleLogout} />
  ) : (
    <Login onLogin={handleLogin} />
  );
}

export default App;

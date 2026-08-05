import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { ReceiptModal } from './components/ReceiptModal';

import { LoginView } from './views/LoginView';
import { DashboardView } from './views/DashboardView';
import { MedicinesView } from './views/MedicinesView';
import { CustomersView } from './views/CustomersView';
import { DoctorsView } from './views/DoctorsView';
import { StockInView } from './views/StockInView';
import { PosView } from './views/PosView';
import { TransactionsView } from './views/TransactionsView';
import { ReportsView } from './views/ReportsView';
import { FinancesView } from './views/FinancesView';
import { UsersView } from './views/UsersView';
import { SettingsView } from './views/SettingsView';

const MainContent: React.FC = () => {
  const { currentUser, activeTab } = useApp();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Requirement: Protection of all pages with authentication
  if (!currentUser) {
    return <LoginView />;
  }

  const renderActiveView = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardView />;
      case 'medicines':
        return <MedicinesView />;
      case 'customers':
        return <CustomersView />;
      case 'doctors':
        return <DoctorsView />;
      case 'stock-in':
        return <StockInView />;
      case 'pos':
        return <PosView />;
      case 'transactions':
        return <TransactionsView />;
      case 'reports':
        return <ReportsView />;
      case 'finances':
        return <FinancesView />;
      case 'users':
        return <UsersView />;
      case 'settings':
        return <SettingsView />;
      default:
        return <DashboardView />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800 antialiased selection:bg-emerald-500 selection:text-white">
      <div className="flex flex-1 min-h-0">
        {/* Responsive Sidebar */}
        <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0">
          <Header onToggleSidebar={() => setIsSidebarOpen(prev => !prev)} />

          <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto overflow-y-auto">
            {renderActiveView()}
          </main>
        </div>
      </div>

      {/* Global Receipt Modal */}
      <ReceiptModal />
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <MainContent />
    </AppProvider>
  );
}

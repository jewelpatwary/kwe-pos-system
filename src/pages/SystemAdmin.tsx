import React from 'react';
import { useAuthStore } from '../store/authStore';
import SystemResetView from '../components/SystemResetView';

export default function SystemAdmin() {
  const { token } = useAuthStore();
  
  return (
    <div className="w-full h-full overflow-y-auto bg-slate-50">
      <div className="p-8 pb-24">
        <SystemResetView token={token} />
      </div>
    </div>
  );
}

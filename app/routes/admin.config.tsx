/**
 * Admin Configuration Page
 * Route: /admin/config
 */
import type { Route } from './+types/admin.config';
import { ConfigManager } from '../components/ConfigManager';

export function meta({}: Route.MetaArgs) {
  return [
    { title: 'Configuration Management - Alice' },
    { name: 'description', content: 'Manage website configurations' },
  ];
}

export default function AdminConfigPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <ConfigManager />
    </div>
  );
}

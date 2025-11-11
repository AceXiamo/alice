/**
 * Configuration Manager Component
 * Allows managing website configurations like discussion groups and descriptions
 */
import { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import type { Configuration, ConfigInput, ConfigType } from '../lib/config';
import {
  fetchConfigurations,
  saveConfiguration,
  deleteConfiguration,
  CONFIG_KEYS,
} from '../lib/config';

export function ConfigManager() {
  const [configs, setConfigs] = useState<Configuration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [formData, setFormData] = useState<ConfigInput>({
    key: '',
    value: '',
    type: 'text',
    description: '',
  });

  useEffect(() => {
    loadConfigs();
  }, []);

  const loadConfigs = async () => {
    try {
      setLoading(true);
      const data = await fetchConfigurations();
      setConfigs(data);
      setError(null);
    } catch (err) {
      setError('Failed to load configurations');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (config: Configuration) => {
    setEditingKey(config.key);
    setFormData({
      key: config.key,
      value: config.value,
      type: config.type as ConfigType,
      description: config.description || '',
    });
  };

  const handleDelete = async (key: string) => {
    if (!confirm('Are you sure you want to delete this configuration?')) {
      return;
    }

    try {
      await deleteConfiguration(key);
      await loadConfigs();
    } catch (err) {
      setError('Failed to delete configuration');
      console.error(err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      await saveConfiguration(formData);
      setEditingKey(null);
      setFormData({ key: '', value: '', type: 'text', description: '' });
      await loadConfigs();
    } catch (err) {
      setError('Failed to save configuration');
      console.error(err);
    }
  };

  const handleCancel = () => {
    setEditingKey(null);
    setFormData({ key: '', value: '', type: 'text', description: '' });
  };

  const renderValuePreview = (config: Configuration) => {
    if (config.type === 'markdown') {
      return (
        <div className="text-sm text-gray-600 truncate max-w-md">
          {config.value.substring(0, 100)}
          {config.value.length > 100 ? '...' : ''}
        </div>
      );
    }

    if (config.type === 'json') {
      try {
        const parsed = JSON.parse(config.value);
        return (
          <div className="text-sm text-gray-600">
            {Array.isArray(parsed) ? `Array (${parsed.length} items)` : 'Object'}
          </div>
        );
      } catch {
        return <div className="text-sm text-red-500">Invalid JSON</div>;
      }
    }

    if (config.type === 'url') {
      return (
        <a
          href={config.value}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-blue-600 hover:underline truncate max-w-md block"
        >
          {config.value}
        </a>
      );
    }

    return <div className="text-sm text-gray-600 truncate max-w-md">{config.value}</div>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Icon icon="svg-spinners:ring-resize" className="w-8 h-8 text-blue-500" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Configuration Management</h1>
        <p className="text-gray-600">
          Manage website configurations including discussion groups and descriptions
        </p>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {/* Configuration Form */}
      <div className="mb-8 bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold mb-4">
          {editingKey ? 'Edit Configuration' : 'Add New Configuration'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Key
              </label>
              <input
                type="text"
                value={formData.key}
                onChange={(e) => setFormData({ ...formData, key: e.target.value })}
                disabled={!!editingKey}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                placeholder="e.g., discussion_groups"
                required
              />
              <div className="mt-1 text-xs text-gray-500">
                Suggested keys: {Object.values(CONFIG_KEYS).join(', ')}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Type
              </label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as ConfigType })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="text">Text</option>
                <option value="url">URL</option>
                <option value="markdown">Markdown</option>
                <option value="json">JSON</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Value
            </label>
            {formData.type === 'markdown' || formData.type === 'json' ? (
              <textarea
                value={formData.value}
                onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                rows={6}
                placeholder={
                  formData.type === 'json'
                    ? '["https://example.com/group1", "https://example.com/group2"]'
                    : '# Description\n\nEnter your markdown content here...'
                }
                required
              />
            ) : (
              <input
                type={formData.type === 'url' ? 'url' : 'text'}
                value={formData.value}
                onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={formData.type === 'url' ? 'https://example.com' : 'Enter value'}
                required
              />
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description (Optional)
            </label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Brief description of this configuration"
            />
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              {editingKey ? 'Update' : 'Add'} Configuration
            </button>
            {editingKey && (
              <button
                type="button"
                onClick={handleCancel}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Configurations List */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold">Existing Configurations</h2>
        </div>

        {configs.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No configurations yet. Add your first configuration above.
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {configs.map((config) => (
              <div key={config.id} className="p-6 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-lg font-semibold">{config.key}</h3>
                      <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded">
                        {config.type}
                      </span>
                    </div>
                    {config.description && (
                      <p className="text-sm text-gray-600 mb-2">{config.description}</p>
                    )}
                    {renderValuePreview(config)}
                    <div className="mt-2 text-xs text-gray-400">
                      Updated: {new Date(config.updatedAt).toLocaleString()}
                    </div>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={() => handleEdit(config)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                      title="Edit"
                    >
                      <Icon icon="mdi:pencil" className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleDelete(config.key)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                      title="Delete"
                    >
                      <Icon icon="mdi:delete" className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

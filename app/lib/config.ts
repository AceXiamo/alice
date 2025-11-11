/**
 * Configuration management utilities
 */

export type ConfigType = 'url' | 'markdown' | 'text' | 'json';

export interface Configuration {
  id: string;
  key: string;
  value: string;
  type: ConfigType;
  description?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ConfigInput {
  key: string;
  value: string;
  type: ConfigType;
  description?: string;
}

/**
 * Predefined configuration keys for the application
 */
export const CONFIG_KEYS = {
  DISCUSSION_GROUPS: 'discussion_groups',
  SITE_DESCRIPTION: 'site_description',
  SITE_LOGO: 'site_logo',
  FOOTER_TEXT: 'footer_text',
} as const;

/**
 * Fetch all configurations from the API
 */
export async function fetchConfigurations(): Promise<Configuration[]> {
  const response = await fetch('/api/config');
  if (!response.ok) {
    throw new Error('Failed to fetch configurations');
  }
  const data = await response.json();
  return data.configs;
}

/**
 * Fetch a specific configuration by key
 */
export async function fetchConfiguration(key: string): Promise<Configuration | null> {
  const response = await fetch(`/api/config?key=${encodeURIComponent(key)}`);
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error('Failed to fetch configuration');
  }
  const data = await response.json();
  return data.config;
}

/**
 * Create or update a configuration
 */
export async function saveConfiguration(config: ConfigInput): Promise<Configuration> {
  const response = await fetch('/api/config', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(config),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to save configuration');
  }

  const data = await response.json();
  return data.config;
}

/**
 * Delete a configuration by key
 */
export async function deleteConfiguration(key: string): Promise<void> {
  const response = await fetch('/api/config', {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ key }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete configuration');
  }
}

/**
 * Parse JSON configuration value
 */
export function parseJsonConfig<T = any>(config: Configuration | null): T | null {
  if (!config || config.type !== 'json') {
    return null;
  }
  try {
    return JSON.parse(config.value);
  } catch {
    return null;
  }
}

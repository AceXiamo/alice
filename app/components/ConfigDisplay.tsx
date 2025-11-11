/**
 * Configuration Display Component
 * Displays configurations like discussion groups and site description
 */
import { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { fetchConfiguration, CONFIG_KEYS, getDiscussionGroups } from '../lib/config';
import type { Configuration } from '../lib/config';

interface ConfigDisplayProps {
  configKey: string;
  fallback?: React.ReactNode;
}

/**
 * Display a markdown configuration
 */
export function MarkdownConfig({ configKey, fallback }: ConfigDisplayProps) {
  const [config, setConfig] = useState<Configuration | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchConfiguration(configKey)
      .then(setConfig)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [configKey]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-gray-500">
        <Icon icon="svg-spinners:ring-resize" className="w-4 h-4" />
        <span>Loading...</span>
      </div>
    );
  }

  if (!config) {
    return <>{fallback}</>;
  }

  return (
    <div className="prose prose-sm max-w-none">
      <div dangerouslySetInnerHTML={{ __html: markdownToHtml(config.value) }} />
    </div>
  );
}

/**
 * Display discussion groups as a list of links
 */
export function DiscussionGroups({ fallback }: Omit<ConfigDisplayProps, 'configKey'>) {
  const [config, setConfig] = useState<Configuration | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchConfiguration(CONFIG_KEYS.DISCUSSION_GROUPS)
      .then(setConfig)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-gray-500">
        <Icon icon="svg-spinners:ring-resize" className="w-4 h-4" />
        <span>Loading discussion groups...</span>
      </div>
    );
  }

  const groups = getDiscussionGroups(config);

  if (groups.length === 0) {
    return <>{fallback}</>;
  }

  return (
    <div className="space-y-2">
      <h3 className="text-lg font-semibold">Discussion Groups</h3>
      <ul className="space-y-2">
        {groups.map((url, index) => (
          <li key={index}>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-blue-600 hover:text-blue-700 hover:underline"
            >
              <Icon icon="mdi:link-variant" className="w-4 h-4" />
              <span>{extractDomain(url)}</span>
              <Icon icon="mdi:open-in-new" className="w-3 h-3" />
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Display a URL configuration as a link
 */
export function UrlConfig({
  configKey,
  fallback,
  children,
}: ConfigDisplayProps & { children?: (url: string) => React.ReactNode }) {
  const [config, setConfig] = useState<Configuration | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchConfiguration(configKey)
      .then(setConfig)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [configKey]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-gray-500">
        <Icon icon="svg-spinners:ring-resize" className="w-4 h-4" />
      </div>
    );
  }

  if (!config || config.type !== 'url') {
    return <>{fallback}</>;
  }

  if (children) {
    return <>{children(config.value)}</>;
  }

  return (
    <a
      href={config.value}
      target="_blank"
      rel="noopener noreferrer"
      className="text-blue-600 hover:underline"
    >
      {config.value}
    </a>
  );
}

/**
 * Generic configuration display
 */
export function ConfigValue({ configKey, fallback }: ConfigDisplayProps) {
  const [config, setConfig] = useState<Configuration | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchConfiguration(configKey)
      .then(setConfig)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [configKey]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-gray-500">
        <Icon icon="svg-spinners:ring-resize" className="w-4 h-4" />
      </div>
    );
  }

  if (!config) {
    return <>{fallback}</>;
  }

  return <span>{config.value}</span>;
}

// Utility functions

/**
 * Simple markdown to HTML converter (basic implementation)
 * For production, consider using a library like marked or remark
 */
function markdownToHtml(markdown: string): string {
  let html = markdown;

  // Headers
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

  // Bold
  html = html.replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>');

  // Italic
  html = html.replace(/\*(.*?)\*/gim, '<em>$1</em>');

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/gim, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

  // Line breaks
  html = html.replace(/\n/gim, '<br>');

  return html;
}

/**
 * Extract domain from URL
 */
function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace('www.', '');
  } catch {
    return url;
  }
}

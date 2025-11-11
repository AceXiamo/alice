# Configuration System Documentation

The Alice project now includes a flexible configuration management system for storing and managing website settings such as discussion groups, site descriptions, and other configurable content.

## Features

- **Database-backed Configuration**: All configurations are stored in PostgreSQL using Prisma ORM
- **Multiple Data Types**: Support for text, URLs, markdown, and JSON configurations
- **Admin Interface**: Web-based UI for managing configurations at `/admin/config`
- **API Endpoints**: RESTful API for programmatic access
- **Type-safe Client**: TypeScript utilities for accessing configurations

## Database Schema

The configuration table includes:

- `id`: Unique identifier (cuid)
- `key`: Unique configuration key (e.g., "discussion_groups")
- `value`: Configuration value (stored as text)
- `type`: Data type ("url", "markdown", "text", "json")
- `description`: Optional description of the configuration
- `createdAt`: Creation timestamp
- `updatedAt`: Last update timestamp

## Setup

### 1. Run Database Migration

Before using the configuration system, apply the database migration:

```bash
npx prisma migrate deploy
```

Or for development:

```bash
npx prisma migrate dev
```

### 2. Access the Admin Interface

Navigate to `/admin/config` in your browser to access the configuration management interface.

## Predefined Configuration Keys

The system includes predefined keys for common configurations:

- `discussion_groups`: Discussion group image URL (URL type) - displays as an image in the UI
- `site_description`: Site description text (Markdown type)
- `site_logo`: Logo image URL (URL type)
- `footer_text`: Footer text (Text or Markdown type)

## API Usage

### Fetch All Configurations

```javascript
GET /api/config

Response:
{
  "configs": [
    {
      "id": "...",
      "key": "discussion_groups",
      "value": "[\"https://example.com/group1\"]",
      "type": "json",
      "description": "Discussion group links",
      "createdAt": "...",
      "updatedAt": "..."
    }
  ]
}
```

### Fetch Specific Configuration

```javascript
GET /api/config?key=discussion_groups

Response:
{
  "config": {
    "id": "...",
    "key": "discussion_groups",
    "value": "[\"https://example.com/group1\"]",
    "type": "json",
    ...
  }
}
```

### Create/Update Configuration

```javascript
POST /api/config
Content-Type: application/json

{
  "key": "discussion_groups",
  "value": "[\"https://discord.gg/example\", \"https://forum.example.com\"]",
  "type": "json",
  "description": "Links to community discussion groups"
}

Response:
{
  "success": true,
  "config": { ... }
}
```

### Delete Configuration

```javascript
DELETE /api/config
Content-Type: application/json

{
  "key": "discussion_groups"
}

Response:
{
  "success": true,
  "message": "Configuration deleted"
}
```

## Client-side Usage

### Using Utility Functions

```typescript
import {
  fetchConfiguration,
  saveConfiguration,
  deleteConfiguration,
  CONFIG_KEYS,
  getDiscussionGroups,
} from '~/lib/config';

// Fetch a configuration
const config = await fetchConfiguration(CONFIG_KEYS.DISCUSSION_GROUPS);

// Get discussion groups as an array
const groups = getDiscussionGroups(config);

// Save a configuration
await saveConfiguration({
  key: 'site_description',
  value: '# Welcome to Alice\n\nAn AI chat companion',
  type: 'markdown',
  description: 'Main site description',
});

// Delete a configuration
await deleteConfiguration('old_config_key');
```

### Using Display Components

```tsx
import { DiscussionGroups, MarkdownConfig } from '~/components/ConfigDisplay';

function MyPage() {
  return (
    <div>
      {/* Display discussion groups */}
      <DiscussionGroups fallback={<p>No discussion groups configured</p>} />

      {/* Display markdown content */}
      <MarkdownConfig
        configKey="site_description"
        fallback={<p>No description available</p>}
      />
    </div>
  );
}
```

## Configuration Types

### Text
Simple text values:
```json
{
  "key": "footer_text",
  "value": "© 2025 Alice AI. All rights reserved.",
  "type": "text"
}
```

### URL
Single URL values:
```json
{
  "key": "site_logo",
  "value": "https://example.com/logo.png",
  "type": "url"
}
```

### Markdown
Rich text content with markdown formatting:
```json
{
  "key": "site_description",
  "value": "# Welcome\n\nThis is **Alice**, your AI companion.",
  "type": "markdown"
}
```

### JSON
Structured data (arrays, objects):
```json
{
  "key": "discussion_groups",
  "value": "[\"https://discord.gg/alice\", \"https://forum.alice.ai\"]",
  "type": "json"
}
```

## Examples

### Adding Discussion Groups

1. Navigate to `/admin/config`
2. Fill in the form:
   - **Key**: `discussion_groups`
   - **Type**: `URL`
   - **Value**: `https://example.com/discussion-groups-qr.png`
   - **Description**: Discussion groups QR code or image
3. Click "Add Configuration"

The discussion groups image will be displayed when users click the "讨论组" button in the main interface.

### Adding Site Description

1. Navigate to `/admin/config`
2. Fill in the form:
   - **Key**: `site_description`
   - **Type**: `Markdown`
   - **Value**:
     ```markdown
     # Welcome to Alice

     Alice is your voice-first AI chat companion, designed to provide natural conversations with advanced speech recognition and text-to-speech capabilities.

     ## Features
     - Voice-first interaction
     - Natural conversations
     - Persistent chat history
     ```
   - **Description**: Main site description shown on homepage
3. Click "Add Configuration"

## Best Practices

1. **Use predefined keys**: Stick to the predefined configuration keys in `CONFIG_KEYS` when possible
2. **Validate JSON**: Ensure JSON values are properly formatted before saving
3. **Meaningful descriptions**: Always add descriptions to help other developers understand the purpose
4. **Type consistency**: Don't change the type of an existing configuration without updating all usages
5. **Fallback content**: Always provide fallback content when using display components

## Troubleshooting

### Configuration not appearing
- Check that the database migration has been run
- Verify the configuration was saved successfully in `/admin/config`
- Check browser console for any API errors

### JSON parsing errors
- Ensure JSON values are properly formatted
- Use a JSON validator before saving
- Check the browser console for detailed error messages

### Display components not rendering
- Verify the configuration key exists in the database
- Check that the configuration type matches the component being used
- Ensure fallback content is provided

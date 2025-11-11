-- Insert sample configurations for Alice website
-- Run these SQL statements in your PostgreSQL database

-- 1. Discussion Groups (Image URL)
INSERT INTO "configurations" ("id", "key", "value", "type", "description", "createdAt", "updatedAt")
VALUES (
  'clr1a2b3c4d5e6f7g8h9i0j1',
  'discussion_groups',
  'https://example.com/discussion-groups-qr.png',
  'url',
  'Discussion groups QR code or image',
  NOW(),
  NOW()
);

-- 2. Site Description (Markdown)
INSERT INTO "configurations" ("id", "key", "value", "type", "description", "createdAt", "updatedAt")
VALUES (
  'clr2b3c4d5e6f7g8h9i0j1k2',
  'site_description',
  '# Welcome to Alice

Alice is your voice-first AI chat companion, designed to provide natural conversations with advanced speech recognition and text-to-speech capabilities.

## Features
- **Voice-first interaction** - Natural speech recognition and synthesis
- **Persistent chat history** - Your conversations are saved and accessible
- **Modern UI** - Beautiful, responsive interface with smooth animations
- **Real-time responses** - Fast and intelligent AI responses

## Get Started
Simply click the microphone button or type your message to start chatting with Alice.',
  'markdown',
  'Main site description displayed on homepage',
  NOW(),
  NOW()
);

-- 3. Site Logo URL
INSERT INTO "configurations" ("id", "key", "value", "type", "description", "createdAt", "updatedAt")
VALUES (
  'clr3c4d5e6f7g8h9i0j1k2l3',
  'site_logo',
  'https://example.com/alice-logo.png',
  'url',
  'Main site logo image URL',
  NOW(),
  NOW()
);

-- 4. Footer Text (Markdown)
INSERT INTO "configurations" ("id", "key", "value", "type", "description", "createdAt", "updatedAt")
VALUES (
  'clr4d5e6f7g8h9i0j1k2l3m4',
  'footer_text',
  '© 2025 Alice AI. Built with ❤️ by the community.',
  'text',
  'Footer copyright text',
  NOW(),
  NOW()
);

-- 5. Contact Email
INSERT INTO "configurations" ("id", "key", "value", "type", "description", "createdAt", "updatedAt")
VALUES (
  'clr5e6f7g8h9i0j1k2l3m4n5',
  'contact_email',
  'hello@alice.ai',
  'text',
  'Contact email address',
  NOW(),
  NOW()
);

-- 6. About Text (Markdown)
INSERT INTO "configurations" ("id", "key", "value", "type", "description", "createdAt", "updatedAt")
VALUES (
  'clr6f7g8h9i0j1k2l3m4n5o6',
  'about_text',
  '## About Alice

Alice is an open-source AI chat assistant that focuses on providing a natural, voice-first interaction experience.

### Technology Stack
- **Frontend**: React Router, TailwindCSS, Framer Motion
- **Backend**: Node.js, Prisma ORM
- **AI**: Google Gemini, OpenAI
- **Database**: PostgreSQL

### Community
Join our growing community of users and contributors!',
  'markdown',
  'About page content',
  NOW(),
  NOW()
);

-- 7. Social Links (JSON)
INSERT INTO "configurations" ("id", "key", "value", "type", "description", "createdAt", "updatedAt")
VALUES (
  'clr7g8h9i0j1k2l3m4n5o6p7',
  'social_links',
  '{
    "github": "https://github.com/AceXiamo/alice",
    "twitter": "https://twitter.com/alice_ai",
    "discord": "https://discord.gg/alice"
  }',
  'json',
  'Social media links',
  NOW(),
  NOW()
);

-- 8. Feature Flags (JSON)
INSERT INTO "configurations" ("id", "key", "value", "type", "description", "createdAt", "updatedAt")
VALUES (
  'clr8h9i0j1k2l3m4n5o6p7q8',
  'features',
  '{
    "voice_chat": true,
    "text_to_speech": true,
    "chat_history": true,
    "dark_mode": false
  }',
  'json',
  'Feature flags for enabling/disabling features',
  NOW(),
  NOW()
);

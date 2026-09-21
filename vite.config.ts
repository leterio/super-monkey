import fs from 'fs';
import { defineConfig } from 'vite';
import monkey from 'vite-plugin-monkey';
import { version } from './package.json' with { type: 'json' };

const REPO_URL = 'https://github.com/leterio/super-monkey';

export default defineConfig(({ command }) => ({
  plugins: [
    monkey({
      entry: 'src/main.ts',
      userscript: {
        namespace: REPO_URL,
        name: 'SuperMonkey',
        description:
          'An all-in-one userscript for managing and downloading web resources, tracking history, customizing pages, and more.',
        author: 'Vinicius Leterio',
        version,
        homepageURL: REPO_URL,
        updateURL: `${REPO_URL}/releases/latest/download/super-monkey.user.js`,
        downloadURL: `${REPO_URL}/releases/latest/download/super-monkey.user.js`,
        supportURL: `${REPO_URL}/issues`,
        match: [
          'http://*/*',
          'https://*/*',
        ],
        connect: ['*'],
        noframes: true,
        'run-at': 'document-body',
      },
    })
  ],
  server: {
    host: 'localhost',
    hmr: true,
    cors: true,
    ...(command === 'serve'
      ? {
        https: {
          key: fs.readFileSync('./certs/key.pem'),
          cert: fs.readFileSync('./certs/cert.pem'),
        },
      }
      : {}),
  },
}));

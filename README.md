# WavexOne

Expo / React Native trading application for iOS, Android, and web.

## Development

```sh
npm ci
npm start
```

The default backend connects to the live service. Set
`EXPO_PUBLIC_WAVEX_BACKEND=mock` for fixture data during local development.
Keep environment files and credentials out of Git.

## Checks

```sh
npm run lint
npm run typecheck
npm test -- --runInBand
```

## Branding

See [the branding guide](docs/BRANDING.md) for the logo, colours, typography,
assets, and shared design tokens.

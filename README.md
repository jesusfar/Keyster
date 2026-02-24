# 🗝️ Keyster

Keyster is a modern, intuitive application designed to test and validate API keys across various major AI providers. Beyond simple validation, Keyster offers an integrated chat interface, allowing users to select specific AI models and interact with them directly from the app.

## ⚡ Version 2.0 - Enhanced Edition

This version includes major architectural improvements, performance optimizations, and enhanced developer experience. See [IMPROVEMENTS.md](IMPROVEMENTS.md) for details.

## ✨ Features

- **Multi-Provider Support**: Validate and manage API keys for 14+ AI platforms:
  - Anthropic, OpenAI, Google Gemini, OpenRouter
  - xAI, Groq, Cerebras, Mistral AI
  - Cohere, Together AI, Replicate, Hugging Face
  - Deepseek, Fireworks AI
- **Multi-Source Scanner**: Scan for exposed API keys across:
  - GitHub (Code, Gists, Commits, Issues)
  - GitLab, Sourcegraph, grep.app, API Radar, Hugging Face
- **Model Selection**: Dynamically fetch and select available models for each connected provider
- **Integrated Interactive Chat**: Start conversations with AI models seamlessly
- **Sleek UI/UX**: Modern, accessible interface with WCAG AA compliance
- **Production Ready**: Code splitting, error handling, and comprehensive testing

## 🚀 Tech Stack

- **Frontend**: [React 19](https://react.dev/) with hooks and Suspense
- **Build Tool**: [Vite](https://vitejs.dev/) with code splitting
- **Language**: [TypeScript](https://www.typescriptlang.org/) with strict type safety
- **Testing**: [Vitest](https://vitest.dev/) with 33+ unit tests
- **Styling**: Modern Vanilla CSS with accessibility focus

## 🛠️ Getting Started

Follow these instructions to get a copy of the project up and running on your local machine.

### Prerequisites

Ensure you have [Node.js](https://nodejs.org/) (version 18+ recommended) installed on your system.

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/jesusfar/Keyster.git
   ```
2. Navigate to the project directory:
   ```bash
   cd Keyster
   ```
3. Install the required dependencies:
   ```bash
   npm install
   ```

### Running the Application

To start the Vite development server:

```bash
npm run dev
```

The application will be accessible at `http://localhost:5173` (or the alternative port specified by Vite in your terminal).

### Building for Production

To bundle the application for production deployment:

```bash
npm run build
```

The optimized and minified files will be generated in the `dist` directory.

### Running Tests

To run the test suite:

```bash
# Run all tests
npm test

# Run tests with UI
npm run test:ui

# Generate coverage report
npm run test:coverage
```

## 📚 Documentation

- [IMPROVEMENTS.md](IMPROVEMENTS.md) - Detailed list of all improvements and optimizations
- [SETUP.md](SETUP.md) - Setup instructions and troubleshooting
- [Architecture](src/lib/README.md) - Code architecture and module documentation

## 🎯 Key Improvements in v2.0

- ✅ **Modular Architecture**: Scanner split into 8+ focused modules
- ✅ **Type Safety**: 95% type coverage with proper type guards
- ✅ **Error Handling**: Comprehensive error handling with custom error types
- ✅ **Performance**: Code splitting reduces initial bundle by ~40%
- ✅ **Testing**: 33 unit tests covering critical utilities
- ✅ **Accessibility**: WCAG AA compliant with proper ARIA labels
- ✅ **Developer Experience**: Centralized config, conditional logging
- ✅ **Concurrency Control**: Promise pools and batch processing

## 🤝 Contributing

Contributions, issues, and feature requests are welcome! Feel free to check the [issues page](https://github.com/jesusfar/Keyster/issues).

Before contributing:
1. Review the [IMPROVEMENTS.md](IMPROVEMENTS.md) to understand the architecture
2. Run `npm test` to ensure all tests pass
3. Follow the existing code style and patterns

## 📄 License

This project is tailored for Keyster. License details to be added.

---

**Made with ❤️ by Jesus | Enhanced with 🤖 Claude Code**

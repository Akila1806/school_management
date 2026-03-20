# School Management UI

A modern, VS Code-inspired React application with split-screen layout, theme switching, and tab-based navigation.

## Features

### 🎨 Theme Support
- **Light Mode**: Clean, bright interface for daytime use
- **Dark Mode**: Easy on the eyes for extended coding sessions
- **Theme Toggle**: Switch between themes with a single click in the tab bar

### 📑 VS Code-Style Tabs
- **Fresh Start**: Application begins with greeting screen (no tabs)
- **On-Demand Tabs**: Tabs created only when users choose to open something
- **New Tab Creation**: Each "Create Student" click opens a new tab
- **Unique Tabs**: "New Student 1", "New Student 2", etc.
- **Close Buttons**: Close any tab with × button (including Dashboard)
- **Welcome Return**: Closing all tabs returns to greeting screen
- **Modified Indicators**: See unsaved changes with dot indicators
- **Clean Interface**: No unnecessary empty tabs or clutter

### 📱 Split Layout (70/30)
- **Resizable Panels**: Drag the divider to adjust split ratio
- **Main Content Area**: 70% for primary content and forms
- **Chat Panel**: 30% for AI assistant and communication
- **Minimum Widths**: Prevents panels from becoming too small

### 🤖 Redesigned Chat UI
- **Modern Design**: Clean, professional chat interface
- **Better Message Layout**: Improved avatars and message bubbles
- **Enhanced Suggestions**: Quick action buttons for common tasks
- **Improved Data Display**: Better table formatting and export options

### 📝 Integrated Student Registration
- **Single Form Interface**: Clean, integrated form within the Students tab
- **No Modal Dialogs**: Form is part of the main interface, not a popup
- **Real-time Validation**: Form validation with error messages
- **Auto-calculated Fields**: Age automatically calculated from date of birth
- **Recently Added List**: Shows the last 5 students added
- **Form Reset**: Clear form functionality with confirmation
- **Responsive Design**: Adapts to different screen sizes

### 🎯 Application Startup
- **Welcome First**: Application starts with a beautiful greeting screen
- **No Default Tabs**: Clean slate with no tabs initially open
- **User Choice**: Users choose what to open first
- **Tab Creation**: All screens (Dashboard, Students) open as closable tabs
- **Fresh Experience**: Professional onboarding for new users

## Usage

### Theme Switching
Click the theme toggle button (🌙/☀️) in the top-right corner of the tab bar to switch between light and dark modes.

### Application Startup
- **Welcome Screen**: Application starts with a professional greeting screen
- **Feature Overview**: Shows available features (Dashboard, Students, AI Assistant)
- **Quick Start**: Easy buttons to open Dashboard or create students
- **Clean Slate**: No tabs open initially - user controls what to open

### Tab Management
- Click on tabs to switch between views
- Use the × button to close any tab (including Dashboard)
- Each "Create Student" click opens a new numbered tab
- Multiple student registration forms can be open simultaneously
- When all tabs are closed, returns to the welcome greeting screen
- Tab bar only appears when tabs are open

### Split Layout
- Drag the vertical divider between panels to resize
- Left panel: Main content area with tabs (70%)
- Right panel: Enhanced chat and AI assistant (30%)

### Chat Interface
- Use quick action buttons for common tasks
- Type natural language queries
- Export data directly from chat responses
- Clean, modern message layout

### Student Registration
- **Single Tab Interface**: One Students tab for all student-related work
- **Integrated Form**: Full-width form interface, not a modal
- **Smart Validation**: Real-time form validation and error feedback
- **Recently Added**: View the last 5 students added to the system
- **Auto-calculations**: Age automatically calculated from birth date
- **Form Management**: Clear form with confirmation dialog

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Architecture

- **React 18** with TypeScript
- **CSS Modules** for component styling
- **Context API** for theme management
- **Custom Hooks** for state management
- **Modular Components** for maintainability

## Components

- `ThemeProvider`: Global theme state management
- `TabBar`: VS Code-style tab navigation (no empty tabs)
- `SplitLayout`: Resizable split-screen layout
- `ChatPanel`: Enhanced AI assistant interface
- `StudentForm`: Improved form with validation and sections
- `Dashboard`: Main dashboard view